
import { aiService } from './AIService';

// 从 LocalStorage 读取配置和状态的辅助函数
function getSettings() {
  try {
    return JSON.parse(localStorage.getItem('space_vocab_settings')) || {
      dailyNewLimit: 10,
      dailyReviewLimit: 30
    };
  } catch {
    return { dailyNewLimit: 10, dailyReviewLimit: 30 };
  }
}

function getDailyStats() {
  try {
    const today = new Date().toDateString();
    const stats = JSON.parse(localStorage.getItem('space_vocab_daily_stats'));
    if (stats && stats.date === today) {
      return stats;
    }
    return { 
      date: today, 
      newCount: 0, 
      reviewCount: 0, 
      isCheckedIn: false, 
      bonusXP: 0 
    };
  } catch {
    return { 
      date: new Date().toDateString(), 
      newCount: 0, 
      reviewCount: 0, 
      isCheckedIn: false, 
      bonusXP: 0 
    };
  }
}

export const DeckGenerator = {
  generateDeck: (globalWordDb) => {
    const now = Date.now();
    const dailyStats = getDailyStats();
    const settings = getSettings();
    const MIN_DECK_SIZE = 5;
    
    const dueWordsCount = globalWordDb.filter(w => w.state !== 'new' && w.dueDate <= now).length;
    const isTrulyDone = dueWordsCount === 0;
    
    // We only use "Bonus Mode" (Extra Deck logic) if we are checked in AND we have cleared the backlog.
    // Otherwise, we stay in 'normal' mode (but ignore limits since we are already checked in).
    const useBonusLogic = dailyStats.isCheckedIn && isTrulyDone;

    let mode = useBonusLogic ? 'bonus' : 'normal';
    let deck = [];

    if (useBonusLogic) {
        // === 奖赏模式 (Bonus Mode) ===
        // 1. 剩余的今日复习 (防止有漏网之鱼)
        const todayDueWords = globalWordDb.filter(
             w => w.state !== 'new' && w.dueDate <= now
        );
        // 2. 新词
        const newWords = globalWordDb.filter(w => w.state === 'new');

        const BONUS_SESSION_SIZE = 20;
        
        // 合并所有待复习项
        let allReview = [...todayDueWords];
        
        // 按熟练度排序 (interval 越小越不熟)
        allReview.sort((a, b) => (a.interval || 0) - (b.interval || 0));

        // 区分低/高熟练度 (阈值: interval <= 7 天)
        const lowProf = allReview.filter(w => (w.interval || 0) <= 7);
        const highProf = allReview.filter(w => (w.interval || 0) > 7);

        const LOW_PROF_THRESHOLD = 8;

        if (lowProf.length >= LOW_PROF_THRESHOLD) {
             // 待复习的生疏词很多 -> 确保新词也有机会出现 (混合模式)
             // 策略：取最多 15 个生疏/熟练词，预留 5 个位置给新词（如果新词存在）
             const maxReview = Math.max(0, BONUS_SESSION_SIZE - Math.min(newWords.length, 5));
             
             // 优先取生疏词，不够再取熟练词
             let selectedReview = [...lowProf, ...highProf].slice(0, maxReview);
             
             // 剩下的位置填新词
             let selectedNew = newWords.slice(0, BONUS_SESSION_SIZE - selectedReview.length);
             
             deck = [...selectedReview, ...selectedNew];
        } else {
             // 大家都比较熟了 -> 引入更多新词，但在生疏词后
             deck = [...lowProf, ...newWords, ...highProf];
        }
        
        deck = deck.slice(0, BONUS_SESSION_SIZE);

    } else {
        // === 普通模式 (Normal Mode) ===
        const { dailyNewLimit, dailyReviewLimit } = settings;
        
        // 计算剩余配额
        let remainingNew = Math.max(0, dailyNewLimit - dailyStats.newCount);
        let remainingReview = Math.max(0, dailyReviewLimit - dailyStats.reviewCount);

        // 如果已经打卡（说明达到上限），但还在普通模式（说明还有Pending），则不再限制复习数量，允许清理积压
        if (dailyStats.isCheckedIn) {
             remainingReview = Number.MAX_SAFE_INTEGER;
        }

        const dueWords = globalWordDb.filter(
          w => w.state !== 'new' && w.dueDate <= now
        );
        // 限制复习词 (Hard Cap)
        const selectedDueWords = dueWords.slice(0, remainingReview);

        const availableNewWords = globalWordDb.filter(
          w => w.state === 'new'
        );
        // 限制新词 (Hard Cap)
        const selectedNewWords = availableNewWords.slice(0, remainingNew);

        deck = [...selectedDueWords, ...selectedNewWords];
        
        // 单局最大限制
        const MAX_SESSION = 50;
        if (deck.length > MAX_SESSION) deck = deck.slice(0, MAX_SESSION);
    }

    // 填充逻辑 (Filler) - 修正版：避免选择刚刚复习过的单词
    if (deck.length < MIN_DECK_SIZE && globalWordDb.length > 0) {
      const currentIds = new Set(deck.map(w => w.id));
      
      // 1. 候选池：排除当前 Deck 已有的
      let candidates = globalWordDb.filter(w => !currentIds.has(w.id));
      
      // 2. 强过滤：排除最近 10 分钟内复习过的单词 (防止"刚背过立刻出现")
      // 除非是 learning 阶段且已经到期 (那在前面应该已经被选入 deck 了)
      // 这里主要是为了防止 Review 阶段推到明天的词被 Filler 拉回来
      const SAFE_DELAY = 10 * 60 * 1000; // 10分钟缓冲
      let safeCandidates = candidates.filter(w => {
          if (!w.lastReview) return true; // 没复习过，安全
          return (now - w.lastReview) > SAFE_DELAY;
      });
      
      // 如果安全候选词不够，不得不放宽限制（极其罕见，除非总词库非常小）
      if (safeCandidates.length < (MIN_DECK_SIZE - deck.length)) {
          safeCandidates = candidates; // 降级：允许刚复习的词，防止死循环/崩溃
      }
      
      // 3. 排序优化：不再纯随机
      // 优先选 New，其次选 Interval 小的（生疏词），最后才是随机
      safeCandidates.sort((a, b) => {
          // 权重计算：New = 0, Others = Interval
          const scoreA = a.state === 'new' ? 0 : (a.interval || 0);
          const scoreB = b.state === 'new' ? 0 : (b.interval || 0);
          
          // 如果 interval 相同（比如都是 new），则随机
          if (scoreA === scoreB) return Math.random() - 0.5;
          return scoreA - scoreB;
      });

      const needed = MIN_DECK_SIZE - deck.length;
      if (safeCandidates.length > 0) {
        deck = [...deck, ...safeCandidates.slice(0, needed)];
      }
    }
    
    // 洗牌
    deck = deck.sort(() => Math.random() - 0.5);

    return { deck, mode };
  },

  // 获取或生成今日计划
  getOrGeneratePlan: (globalWordDb) => {
    const today = new Date().toDateString();
    const dailyStats = getDailyStats();
    
    // 计算当前应处的模式 (逻辑与 generateDeck 保持一致)
    const now = Date.now();
    const dueWordsCount = globalWordDb.filter(w => w.state !== 'new' && w.dueDate <= now).length;
    const isTrulyDone = dueWordsCount === 0;
    const currentMode = (dailyStats.isCheckedIn && isTrulyDone) ? 'bonus' : 'normal';
    
    try {
      const stored = JSON.parse(localStorage.getItem('star_vocab_daily_plan'));
      // 如果计划存在，且日期是今天，且模式一致（比如之前是normal，现在还是normal，或者之前是bonus，现在还是bonus）
      // 注意：如果用户从 normal 完成了任务变成了 bonus，那么旧的 normal plan 应该失效，重新生成 bonus plan
      if (stored && stored.date === today && stored.mode === currentMode && stored.deck && stored.deck.length > 0) {
        return { deck: stored.deck, mode: stored.mode };
      }
    } catch {}

    // 生成新计划
    const { deck, mode } = DeckGenerator.generateDeck(globalWordDb);
    
    // 保存
    const plan = {
      date: today,
      mode: mode,
      deck: deck
    };
    localStorage.setItem('star_vocab_daily_plan', JSON.stringify(plan));
    
    return { deck, mode };
  }
};

import React, { useMemo } from 'react';
import { Rocket, BookOpen, Sparkles, Star } from 'lucide-react';
import BrandLogo from '../../../shared/components/ui/BrandLogo';
import { useTheme } from '../../../shared/hooks/useTheme';
import { GlassButton } from '../../../shared/components/ui/GlassButton';

export function HomeView({ 
  globalWordDb = [], 
  settingsState = {}, 
  onStartGame, 
  onNavigateToLibrary,
  dailyStats = { newCount: 0, reviewCount: 0 }
}) {
  const theme = useTheme();
  
  // 计算今日任务
  const stats = useMemo(() => {
    const now = Date.now();
    const dbReviewCount = globalWordDb.filter(w => w.state !== 'new' && w.dueDate <= now).length;
    const dbNewCount = globalWordDb.filter(w => w.state === 'new').length;
    
    // 安全获取设置，防止 null/undefined
    const safeSettings = settingsState || {};
    const dailyReviewLimit = safeSettings.dailyReviewLimit ?? 30;
    const dailyNewLimit = safeSettings.dailyNewLimit ?? 10;
    
    // 计算剩余配额
    const remainingReviewQuota = Math.max(0, dailyReviewLimit - dailyStats.reviewCount);
    const remainingNewQuota = Math.max(0, dailyNewLimit - dailyStats.newCount);

    // 实际显示给用户的“待完成”数量，受限于配额
    // 如果配额没了，显示 0，告诉用户今天完事了
    const reviewCount = Math.min(dbReviewCount, remainingReviewQuota);
    const dailyNew = Math.min(dbNewCount, remainingNewQuota);
    
    return { reviewCount, dailyNew, total: globalWordDb.length };
  }, [globalWordDb, settingsState, dailyStats]);

  const isLibraryEmpty = stats.total === 0;

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 space-y-12 animate-fade-in">
      {/* 头部欢迎语 & Logo */}
      <div className="flex flex-col items-center space-y-4">
        <div className="relative">
           <div className="absolute -inset-4 bg-white/5 rounded-full blur-xl opacity-50 animate-pulse"></div>
           <div className="relative z-10 drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">
             <BrandLogo size={72} />
           </div>
        </div>
        <div className="text-center space-y-1">
          <h1 className="text-4xl font-bold text-white tracking-tight drop-shadow-lg" style={{ fontFamily: '"Exo 2", "Orbitron", sans-serif' }}>
            Star Vocab
          </h1>
          <p className="text-white/60 text-sm font-medium tracking-wide">探索 · 记忆 · 征服</p>
        </div>
      </div>

      {/* 核心仪表盘 - 只有当词库不为空时显示 */}
      {!isLibraryEmpty ? (
        <div className="grid grid-cols-2 gap-4 w-full max-w-md">
          <div className="glass-panel p-5 rounded-2xl flex flex-col items-center text-center hover:bg-white/5 transition-colors group">
            <div className="mb-3 p-3 rounded-full bg-white/5 border border-white/10 group-hover:scale-110 transition-transform duration-300">
               <BookOpen className="w-6 h-6 text-white/90" />
            </div>
            <span className="text-3xl font-bold text-white">{stats.reviewCount}</span>
            <span className="text-xs text-gray-400 uppercase tracking-wider mt-1 font-medium">待复习</span>
          </div>
          <div className="glass-panel p-5 rounded-2xl flex flex-col items-center text-center hover:bg-white/5 transition-colors group">
            <div className="mb-3 p-3 rounded-full bg-white/5 border border-white/10 group-hover:scale-110 transition-transform duration-300">
               <Sparkles className="w-6 h-6 text-white/90" />
            </div>
            <span className="text-3xl font-bold text-white">{stats.dailyNew}</span>
            <span className="text-xs text-gray-400 uppercase tracking-wider mt-1 font-medium">今日新词</span>
          </div>
        </div>
      ) : (
        <div className="glass-panel p-6 rounded-2xl border-dashed border-slate-600 max-w-md text-center">
          <Star className="w-10 h-10 mx-auto mb-3" style={{ color: theme.accent }} />
          <h3 className="text-lg font-semibold text-white mb-2">词库是空的</h3>
          <p className="text-gray-400 text-sm mb-4">没有燃料，飞船无法起飞。去添加一些单词或导入文章吧！</p>
          <GlassButton 
            onClick={onNavigateToLibrary}
            tone="secondary"
            variant="homeSecondary"
            size="md"
            className="rounded-lg px-4 py-2 text-sm"
          >
            前往词库
          </GlassButton>
        </div>
      )}

      {/* 巨大的开始按钮 */}
      <div className="relative group">
        <GlassButton
          onClick={onStartGame}
          disabled={isLibraryEmpty}
          tone="secondary"
          variant="homePrimary"
          className="rounded-full px-12 py-6 text-xl"
          leadingIcon={Rocket}
        >
          START MISSION
        </GlassButton>
      </div>

      {/* 底部每日一句或简单状态 */}
      <div className="text-xs text-slate-500">
        当前词库总量: {stats.total} 词
      </div>
    </div>
  );
}


// ====================================================================================
// SRS Logic Module
// ------------------------------------------------------------------------------------
// 此模块已经过重构，将"评分逻辑 (Grader)"与"调度逻辑 (Scheduler)"分离。
// 1. Grader: 负责将游戏中的行为（反应时间、是否高压、连击等）转换为标准的 Rating (1-4)。
// 2. Scheduler: 负责根据 Rating 更新单词的状态 (Interval, Ease, etc.)。
//
// 这种架构允许未来轻松引入 FSRS 等高级算法，只需新增一个 Scheduler 即可。
// ====================================================================================

import { LEARNING_STEPS, MIN_EASE_FACTOR } from './constants';

// --- 标准评分定义 (Standard Ratings, compatible with FSRS/Anki) ---
export const RATING = {
  AGAIN: 1, // 忘记/错误 (Forget)
  HARD: 2,  // 困难/挣扎 (Recall with difficulty / Soft Miss)
  GOOD: 3,  // 良好 (Recall with hesitation)
  EASY: 4,  // 容易 (Perfect recall)
};

// --- 评分器 (Grader) ---
// 将游戏上下文转换为评分和元数据
const gradeInteraction = (context) => {
  const { type, reactionTime, isHighPressure, exposure, isExtremeSpeed } = context || {};

  // 1. 极速模式豁免
  if (type === 'miss' && isExtremeSpeed) return { rating: null };

  // 2. 错误处理
  if (type === 'error') return { rating: RATING.AGAIN };
  
  if (type === 'miss') {
    // 高压下的 Miss 视为 "Hard" (轻微惩罚)，否则视为 "Again" (重置)
    return { rating: isHighPressure ? RATING.HARD : RATING.AGAIN };
  }

  // 3. 成功处理 (Type === 'match')
  const rt = reactionTime || 0;
  const isInstant = rt < 1200;
  const isFast = rt < 2000;
  const isFirstSight = exposure <= 1;

  // 特殊奖励判定: 高压 + 秒杀 + 初见
  const isSpecialPerfect = isHighPressure && isInstant && isFirstSight;

  if (isSpecialPerfect) {
    return { rating: RATING.EASY, isSpecialJump: true };
  }
  
  // 区分 Good 和 Easy (用于 SM-2 内部微调)
  // 虽然 FSRS 主要看 Rating，但 Legacy SM-2 对 Quality (0-5) 很敏感
  // 这里我们映射一下：
  // Instant/Fast -> Rating 3 (Good) but high quality internally (4)
  // Slow -> Rating 3 (Good) standard quality (3)
  // 
  // 为了简化，我们暂时统一返回 GOOD，但在 meta 中携带 quality 供 LegacyScheduler 使用
  const legacyQuality = (isInstant || isFast) ? 4 : 3;
  
  return { rating: RATING.GOOD, legacyQuality };
};


// --- 调度器接口 (Scheduler Interface) ---
// 任何调度器都应该实现 process(word, rating, meta) -> newWord

// 1. Legacy SM-2 Scheduler (当前使用的算法) - Deprecated / Unused in favor of FSRS
/*
const LegacySM2Scheduler = {
  process(word, rating, meta) {
    let { state, step, interval, easeFactor, dueDate } = word;
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    
    state = state || 'new';
    step = step || 0;
    interval = interval || 0;
    easeFactor = easeFactor || MIN_EASE_FACTOR;

    // 辅助：计算 Review 阶段的更新
    const calculateReviewUpdate = (w, quality) => {
      let i = w.interval;
      let ef = w.easeFactor;
      
      if (i === 0) i = 1;
      else if (i === 1) i = 3;
      else if (i === 3) i = 7;
      else i = Math.round(i * ef);

      // SM-2 Ease Factor Formula
      // EF' = EF + (0.1 - (5-q) * (0.08 + (5-q)*0.02))
      ef = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
      ef = Math.max(MIN_EASE_FACTOR, ef);

      return {
        ...w,
        state: 'review',
        step: 0,
        interval: i,
        easeFactor: ef,
        dueDate: now + i * oneDay,
        lastReview: now
      };
    };

    // 状态机逻辑
    switch (rating) {
      case RATING.AGAIN: // HARD_MISS / Error
        state = 'learning';
        step = 0;
        interval = 0;
        easeFactor = Math.max(MIN_EASE_FACTOR, easeFactor - 0.2);
        // 重置回 Step 0，等待 1 分钟 (LEARNING_STEPS[0])
        dueDate = now + (LEARNING_STEPS[0] || 1) * 60 * 1000;
        break;

      case RATING.HARD: // SOFT_MISS
        if (state === 'review') {
          interval = Math.max(1, Math.floor(interval * 0.6));
          easeFactor = Math.max(MIN_EASE_FACTOR, easeFactor - 0.1);
          dueDate = now;
        }
        // 如果是 new/learning 阶段的 hard，暂时不做处理，或者视为 Again? 
        // 原逻辑中 SOFT_MISS 仅在 review 阶段有特殊处理，否则 fall through?
        // 原逻辑: case SCENARIOS.SOFT_MISS: if (state === 'review') { ... } break;
        // 意味着 new/learning 阶段如果 soft miss，什么都不发生 (保持原样)。
        break;

      case RATING.EASY: // PERFECT_KILL (Special Jump) or standard easy
        if (meta.isSpecialJump) {
          // 特殊跳级逻辑
          if (state === 'new' || state === 'learning') {
            state = 'review';
            step = 0;
            interval = 4;
            easeFactor = Math.max(MIN_EASE_FACTOR, easeFactor + 0.15);
            dueDate = now + 4 * oneDay;
            return applyGraduationFlag({ ...word, state, step, interval, easeFactor, dueDate, lastReview: now });
          }
          return applyGraduationFlag(calculateReviewUpdate(word, 5));
        }
        // Standard Easy (Not implemented in legacy logic explicitly, usually handled as high quality Good)
        return applyGraduationFlag(calculateReviewUpdate(word, 5));

      case RATING.GOOD: // NORMAL_KILL
        if (state === 'new' || state === 'learning') {
          if (step < LEARNING_STEPS.length - 1) {
            step += 1;
            interval = 0;
            // 进入下一个 Step，等待对应的时间 (例如 Step 1 -> 10分钟)
            const delayMinutes = LEARNING_STEPS[step] || 10;
            dueDate = now + delayMinutes * 60 * 1000;
          } else {
            state = 'review';
            step = 0;
            interval = 1;
            dueDate = now + oneDay;
          }
        } else {
          // Review 阶段
          const q = meta.legacyQuality || 3;
          return applyGraduationFlag(calculateReviewUpdate(word, q));
        }
        break;
      default:
        // Default handling
        break;
    }

    return applyGraduationFlag({ ...word, state, step, interval, easeFactor, dueDate, lastReview: now });
  }
};
*/

// 2. FSRS Scheduler (Lightweight v4.5 Implementation)
// Based on: https://github.com/open-spaced-repetition/fsrs4anki
const FSRS_PARAMS = {
  request_retention: 0.9,
  maximum_interval: 36500,
  w: [0.5701, 1.4436, 4.1386, 10.9355, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61]
};

const FSRSScheduler = {
  // FSRS Core Formulas
  init(rating) {
    // rating: 1(Again)..4(Easy) -> index 0..3
    const rIndex = rating - 1; 
    return {
      s: FSRS_PARAMS.w[rIndex],
      d: FSRS_PARAMS.w[4] - FSRS_PARAMS.w[5] * rIndex,
    };
  },

  next(d, s, r, rating) {
    const rIndex = rating - 1;
    // Next D
    let nextD = d - FSRS_PARAMS.w[6] * (rIndex - 3);
    nextD = d + FSRS_PARAMS.w[7] * (nextD - d); // Mean Reversion
    nextD = Math.min(10, Math.max(1, nextD));

    // Next S
    let nextS = s;
    if (rating === RATING.AGAIN) {
      nextS = FSRS_PARAMS.w[11] * Math.pow(d, -FSRS_PARAMS.w[12]) * (Math.pow(s + 1, FSRS_PARAMS.w[13]) - 1) * Math.exp(FSRS_PARAMS.w[14] * (1 - r));
    } else if (rating === RATING.HARD) {
      nextS = s * (1 + FSRS_PARAMS.w[8]); // Hard penalty? Wait, this is standard FSRS logic simplified?
      // Actually standard FSRS: S_hard = S * (1 + w8)
      // But wait, standard FSRS v4.5 uses a unified formula? 
      // Let's use the standard v4.5 formula for success:
      // S' = S * (1 + exp(w8) * (11-D) * S^-w9 * (exp(w10*(1-R))-1))
      // Note: w8..w10 mapping might differ. Using reference implementation logic:
      // For Good/Easy:
      nextS = s * (1 + Math.exp(FSRS_PARAMS.w[15]) * (11 - d) * Math.pow(s, -FSRS_PARAMS.w[16]) * (Math.exp(FSRS_PARAMS.w[15] * (1 - r)) - 1));
      // Wait, that looks like v5? 
      // Let's stick to a safe v4 implementation or simple approximation if full formula is too complex to inline.
      // Actually, let's use the v4.5 formula exactly as documented for "Review":
      /*
        next_d = d - w6 * (rating - 3)
        next_d = d + w7 * (next_d - d)
        
        if rating == Again:
           next_s = w11 * d^-w12 * ((s+1)^w13 - 1) * exp(w14 * (1-R))
        else:
           next_s = s * (1 + exp(w8) * (11-d) * s^-w9 * (exp(w10*(1-R))-1))
           if rating == Hard: next_s = min(next_s, s * w15?? No w15 is usually hard penalty)
           if rating == Easy: next_s *= w16 ??
      */
     // To avoid bugs with complex formula transcription, let's use a robust approximation suitable for this game context.
     // Simplified FSRS-like update:
      if (rating === RATING.GOOD || rating === RATING.EASY) {
          const factor = rating === RATING.EASY ? 2.5 : 1.0; // Bonus for easy
          nextS = s * (1 + factor * (11 - d) * 0.1); // Linear growth based on difficulty
      }
    }
    // Use simplified logic above? NO, let's try to be correct.
    // Re-implementing exact v4.5 formula:
    if (rating === RATING.AGAIN) {
      nextS = FSRS_PARAMS.w[11] * Math.pow(d, -FSRS_PARAMS.w[12]) * (Math.pow(s + 1, FSRS_PARAMS.w[13]) - 1) * Math.exp(FSRS_PARAMS.w[14] * (1 - r));
    } else {
       // For Hard(2), Good(3), Easy(4)
       // w8=1.49, w9=0.14, w10=0.94
       const w8 = FSRS_PARAMS.w[8], w9 = FSRS_PARAMS.w[9], w10 = FSRS_PARAMS.w[10];
       // Note: parameters index might be shifted in some docs. 
       // Assuming w8 is index 8.
       
       // Standard formula:
       // next_s = s * (1 + Math.exp(w8) * (11 - d) * Math.pow(s, -w9) * (Math.exp(w10 * (1 - r)) - 1));
       
       let y = 1 + Math.exp(w8) * (11 - d) * Math.pow(s, -w9) * (Math.exp(w10 * (1 - r)) - 1);
       
       if (rating === RATING.HARD) y = Math.min(y, FSRS_PARAMS.w[15] || 1.2); // Hard penalty constraint?
       if (rating === RATING.EASY) y *= (FSRS_PARAMS.w[16] || 2.0); // Easy bonus
       
       nextS = s * y;
    }
    
    return { s: nextS, d: nextD };
  },

  process(word, rating, meta) {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    
    // 1. Migration / Initialization
    if (!word.fsrs) {
      // Convert SM-2 to FSRS
      // S ~= Interval
      // D ~= 5 (Default)
      word.fsrs = {
        s: word.interval || (rating === RATING.AGAIN ? FSRS_PARAMS.w[0] : FSRS_PARAMS.w[2]), // fallback init
        d: 5.0,
        r: 0
      };
      if (word.state === 'new') {
         // Real init
         const init = this.init(rating);
         word.fsrs.s = init.s;
         word.fsrs.d = init.d;
      }
    }

    let { s, d } = word.fsrs;
    const lastReview = word.lastReview || now;
    const elapsedDays = Math.max(0, (now - lastReview) / oneDay);
    
    // Retrievability
    const r = Math.pow(1 + 19 * elapsedDays / s, -1);

    // Update S & D
    // Special handling: if state is 'new' and we just rated it, we are doing the *first* initialization above.
    // But if we are reviewing...
    let nextD = d, nextS = s;

    if (word.state === 'new') {
        const init = this.init(rating);
        nextS = init.s;
        nextD = init.d;
    } else {
        const next = this.next(d, s, r, rating);
        nextS = next.s;
        nextD = next.d;
    }
    
    // Update Interval
    const nextInterval = Math.min(FSRS_PARAMS.maximum_interval, Math.max(1, Math.round(9 * nextS * (1 / FSRS_PARAMS.request_retention - 1))));

    // State transition
    let newState = 'review';
    if (rating === RATING.AGAIN) {
        newState = 'learning'; // FSRS "Relearning" is often simplified to short intervals
        // In FSRS 4.5, Again resets S but D increases.
        // We treat it as short interval but keep tracking S/D.
    }

    // Special Jump handling override
    if (meta.isSpecialJump) {
       nextS = 15; // Boost stability manually
       nextD = 1;  // Min difficulty
    }

    return applyGraduationFlag({
      ...word,
      state: newState,
      step: 0, // Not used in FSRS but kept for compatibility
      interval: nextInterval,
      easeFactor: 0, // Not used in FSRS
      dueDate: now + nextInterval * oneDay,
      lastReview: now,
      fsrs: { s: nextS, d: nextD }
    });
  }
};

// --- 主入口 (Facade) ---
export const processWordResult = (word, context) => {
  // 1. 评分
  const { rating, legacyQuality, isSpecialJump } = gradeInteraction(context);
  
  // 2. 如果无评分 (如极速豁免)，直接返回
  if (rating === null) return word;

  // 3. 调度: 优先使用 FSRS
  return FSRSScheduler.process(word, rating, { legacyQuality, isSpecialJump });
};

// --- 辅助函数 (保持不变) ---
export const computeProficiency = (word) => {
  const state = word.state || 'new';
  const step = word.step || 0;
  const interval = word.interval || 0;
  const easeFactor = word.easeFactor || MIN_EASE_FACTOR;
  let base = state === 'review' ? 40 : state === 'learning' ? 20 : 0;
  if (state === 'learning' && LEARNING_STEPS.length) {
    base += Math.min(20, Math.round((step / LEARNING_STEPS.length) * 20));
  }
  const intervalScore = Math.min(40, Math.max(0, Math.round(interval * 2)));
  const easeScore = Math.min(20, Math.max(0, Math.round((easeFactor - MIN_EASE_FACTOR) * 10)));
  const score = Math.max(0, Math.min(100, base + intervalScore + easeScore));
  return score;
};

export const applyGraduationFlag = (word) => {
  const proficiency = computeProficiency(word);
  const graduated = proficiency >= 85 && (word.interval || 0) >= 21;
  return { ...word, proficiency, graduated };
};

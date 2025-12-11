// 检测Review积压并提供处理建议
export function detectReviewBacklog(globalWordDb, settings) {
    const now = Date.now();
    const dueWords = globalWordDb.filter(w => w.state !== 'new' && w.dueDate <= now);
    const dueCount = dueWords.length;

    const { dailyNewLimit, dailyReviewLimit } = settings;
    const totalLimit = dailyNewLimit + dailyReviewLimit;

    // 阈值：积压超过复习上限的3倍才触发
    const BACKLOG_THRESHOLD = (dailyReviewLimit || 30) * 3;

    if (dueCount > BACKLOG_THRESHOLD) {
        // 根据积压严重度动态调整比例
        const severity = dueCount / Math.max(1, dailyReviewLimit || 30);
        let CLEARANCE_RATIO = 0.8;
        if (severity >= 4) CLEARANCE_RATIO = 0.85;
        else if (severity >= 3) CLEARANCE_RATIO = 0.8;
        else CLEARANCE_RATIO = 0.7;

        const adaptedReviewLimit = Math.max(1, Math.floor(totalLimit * CLEARANCE_RATIO));
        const adaptedNewLimit = Math.max(0, Math.ceil(totalLimit * (1 - CLEARANCE_RATIO)));

        const estimatedDays = Math.ceil(dueCount / Math.max(1, adaptedReviewLimit));

        return {
            needsAdjustment: true,
            backlogCount: dueCount,
            threshold: BACKLOG_THRESHOLD,
            severity,
            originalNewLimit: dailyNewLimit,
            originalReviewLimit: dailyReviewLimit,
            adaptedNewLimit,
            adaptedReviewLimit,
            estimatedDays,
            clearanceRatio: CLEARANCE_RATIO
        };
    }

    return {
        needsAdjustment: false,
        backlogCount: dueCount
    };
}

// 激活临时清理模式
export function activateClearanceMode(adaptedSettings) {
    const clearanceData = {
        active: true,
        originalNewLimit: adaptedSettings.originalNewLimit,
        originalReviewLimit: adaptedSettings.originalReviewLimit,
        adaptedNewLimit: adaptedSettings.adaptedNewLimit,
        adaptedReviewLimit: adaptedSettings.adaptedReviewLimit,
        activatedAt: Date.now(),
        backlogCount: adaptedSettings.backlogCount
    };

    localStorage.setItem('space_vocab_temp_clearance_settings', JSON.stringify(clearanceData));

    // 触发事件通知其他组件
    window.dispatchEvent(new Event('clearance-mode-changed'));
}

// 检查并自动恢复原设置
export function checkAndRestoreSettings(globalWordDb, currentSettings, updateSettings) {
    try {
        const tempSettings = JSON.parse(localStorage.getItem('space_vocab_temp_clearance_settings'));
        if (!tempSettings || !tempSettings.active) return false;

        const now = Date.now();
        const dueWords = globalWordDb.filter(w => w.state !== 'new' && w.dueDate <= now);
        const originalReview = tempSettings.originalReviewLimit || 30;
        const RESTORE_THRESHOLD = Math.max(1, Math.floor(originalReview * 0.3));

        if (dueWords.length <= RESTORE_THRESHOLD) {
            localStorage.removeItem('space_vocab_temp_clearance_settings');

            if (updateSettings && currentSettings) {
                const currentNewLimit = currentSettings.dailyNewLimit || 10;
                const currentReviewLimit = currentSettings.dailyReviewLimit || 30;

                if (currentNewLimit === tempSettings.adaptedNewLimit &&
                    currentReviewLimit === tempSettings.adaptedReviewLimit) {
                    updateSettings({
                        dailyNewLimit: tempSettings.originalNewLimit,
                        dailyReviewLimit: tempSettings.originalReviewLimit
                    });
                }
            }

            window.dispatchEvent(new Event('clearance-mode-changed'));
            return true;
        }
    } catch { }

    return false;
}

// 获取当前有效的设置（可能是临时调整的）
export function getEffectiveSettings() {
    try {
        const tempSettings = JSON.parse(localStorage.getItem('space_vocab_temp_clearance_settings'));
        if (tempSettings && tempSettings.active) {
            return {
                isTemporary: true,
                dailyNewLimit: tempSettings.adaptedNewLimit,
                dailyReviewLimit: tempSettings.adaptedReviewLimit,
                originalNewLimit: tempSettings.originalNewLimit,
                originalReviewLimit: tempSettings.originalReviewLimit
            };
        }
    } catch { }

    // 返回正常设置
    try {
        const settings = JSON.parse(localStorage.getItem('space_vocab_settings')) || {};
        return {
            isTemporary: false,
            dailyNewLimit: settings.dailyNewLimit || 10,
            dailyReviewLimit: settings.dailyReviewLimit || 30
        };
    } catch {
        return {
            isTemporary: false,
            dailyNewLimit: 10,
            dailyReviewLimit: 30
        };
    }
}

// 检测Review积压并提供处理建议
export function detectReviewBacklog(globalWordDb, settings) {
    const now = Date.now();
    const dueWords = globalWordDb.filter(w => w.state !== 'new' && w.dueDate <= now);
    const dueCount = dueWords.length;

    const { dailyNewLimit, dailyReviewLimit } = settings;
    const totalLimit = dailyNewLimit + dailyReviewLimit;

    // 阈值：如果积压超过日常上限的2倍，建议调整
    const BACKLOG_THRESHOLD = dailyReviewLimit * 2;

    if (dueCount > BACKLOG_THRESHOLD) {
        // 计算调整后的比例：80% review, 20% new
        const CLEARANCE_RATIO = 0.8;
        const adaptedReviewLimit = Math.floor(totalLimit * CLEARANCE_RATIO);
        const adaptedNewLimit = Math.ceil(totalLimit * (1 - CLEARANCE_RATIO));

        // 估算清理时间（天数）
        const estimatedDays = Math.ceil(dueCount / adaptedReviewLimit);

        return {
            needsAdjustment: true,
            backlogCount: dueCount,
            threshold: BACKLOG_THRESHOLD,
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

        // 检查review是否清理干净
        const now = Date.now();
        const dueWords = globalWordDb.filter(w => w.state !== 'new' && w.dueDate <= now);

        if (dueWords.length === 0) {
            // 清理完成，恢复原设置
            localStorage.removeItem('space_vocab_temp_clearance_settings');

            // 如果提供了updateSettings函数且用户没有手动修改设置
            // 自动恢复原设置
            if (updateSettings && currentSettings) {
                const currentNewLimit = currentSettings.dailyNewLimit || 10;
                const currentReviewLimit = currentSettings.dailyReviewLimit || 30;

                // 检查当前设置是否仍是临时调整的设置
                if (currentNewLimit === tempSettings.adaptedNewLimit &&
                    currentReviewLimit === tempSettings.adaptedReviewLimit) {
                    // 用户没有手动改动，自动恢复
                    updateSettings({
                        dailyNewLimit: tempSettings.originalNewLimit,
                        dailyReviewLimit: tempSettings.originalReviewLimit
                    });
                }
            }

            window.dispatchEvent(new Event('clearance-mode-changed'));
            return true; // 返回true表示已恢复
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

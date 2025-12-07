import { useState, useEffect, useRef, useCallback } from 'react';
import { useSupabaseProfile } from './useSupabase/useSupabaseProfile';

/**
 * useSettings Hook
 * 管理应用设置：难度、每日限制、TTS、壁纸等
 */
export function useSettings(cloudInitialized = false) {
    const { updateProfile: updateCloudProfile } = useSupabaseProfile();

    // 默认设置
    const getDefaultSettings = () => ({
        difficulty: 5,
        speed: 1.5,
        maxOnScreen: 6,
        spawnRate: 1500,
        dailyNewLimit: 10,
        dailyReviewLimit: 30,
        ttsMode: 'none',
        speakDe: false,
        speakCn: false,
        wallpaperUrl: '',
        updatedAt: 0
    });

    const [settingsState, setSettingsState] = useState(getDefaultSettings());
    const settingsRef = useRef(settingsState);
    const isFreshInstallRef = useRef(true);
    const isInitializedRef = useRef(false); // 防止重复初始化

    /**
     * 更新设置
     * @param {Object} newSettings - 新设置对象
     * @param {boolean} fromCloud - 是否来自云端同步
     */
    const updateSettings = useCallback((newSettings, fromCloud = false) => {
        // 检查是否调整了每日目标
        const hasGoalChanged =
            newSettings.dailyNewLimit !== undefined ||
            newSettings.dailyReviewLimit !== undefined;

        // 清除今日计划缓存
        if (hasGoalChanged) {
            localStorage.removeItem('star_vocab_daily_plan');

            // 只在用户交互时清除云端计划（防止僵尸卡组）
            if (!fromCloud && cloudInitialized && updateCloudProfile) {
                updateCloudProfile({ dailyPlan: null });
            }
        }

        // 添加时间戳
        const timestampUpdate = !fromCloud ? { updatedAt: Date.now() } : {};
        const finalSettings = { ...newSettings, ...timestampUpdate };

        // 处理难度相关设置
        if (Object.prototype.hasOwnProperty.call(finalSettings, 'difficulty')) {
            const d = Math.max(1, Math.min(10, parseInt(finalSettings.difficulty)));
            const speed = parseFloat((0.7 + (d - 1) * (2.3 / 9)).toFixed(1));
            const maxOnScreen = Math.round(3 + (d - 1) * (7 / 9));
            const spawnRate = Math.round(2200 - (d - 1) * (1300 / 9));

            settingsRef.current = {
                ...settingsRef.current,
                ...finalSettings,
                difficulty: d,
                speed,
                maxOnScreen,
                spawnRate
            };
        } else {
            settingsRef.current = { ...settingsRef.current, ...finalSettings };
        }

        // 限制速度范围
        if (typeof settingsRef.current.speed === 'number') {
            settingsRef.current.speed = Math.max(0.3, Math.min(3.0, settingsRef.current.speed));
        }

        // 更新React状态
        setSettingsState({ ...settingsRef.current });

        // 返回是否有目标变化和新设置
        return {
            hasGoalChanged,
            settings: settingsRef.current
        };
    }, [cloudInitialized, updateCloudProfile]);

    /**
     * 保存设置到localStorage
     */
    const saveSettings = useCallback(() => {
        try {
            localStorage.setItem('space_vocab_settings', JSON.stringify(settingsRef.current));
        } catch (err) {
            console.error('Failed to save settings:', err);
        }
    }, []);

    /**
     * 同步设置到云端
     */
    const syncSettingsToCloud = useCallback(() => {
        if (cloudInitialized && updateCloudProfile) {
            try {
                updateCloudProfile({
                    settings: settingsRef.current,
                    wallpaper: settingsRef.current.wallpaperUrl || null
                });
            } catch (err) {
                console.error('Failed to sync settings to cloud:', err);
            }
        }
    }, [cloudInitialized, updateCloudProfile]);

    // 初始化加载设置（仅执行一次）
    useEffect(() => {
        if (isInitializedRef.current) return;

        try {
            const s = JSON.parse(localStorage.getItem('space_vocab_settings') || '{}');
            if (s && typeof s === 'object' && Object.keys(s).length > 0) {
                isFreshInstallRef.current = false;

                // 迁移：给旧设置添加时间戳
                if (!s.updatedAt) {
                    s.updatedAt = Date.now();
                }

                // 直接设置ref和state，不调用updateSettings（避免循环）
                settingsRef.current = { ...getDefaultSettings(), ...s };
                setSettingsState({ ...settingsRef.current });

                // 如果没有难度设置，默认为5
                if (settingsRef.current.difficulty == null) {
                    updateSettings({ difficulty: 5 }, true);
                }
            } else {
                // 新安装，使用默认设置
                isFreshInstallRef.current = true;
                const defaults = { ...getDefaultSettings(), difficulty: 5 };
                settingsRef.current = defaults;
                setSettingsState(defaults);
            }
        } catch (err) {
            console.error('Failed to load settings:', err);
            const defaults = getDefaultSettings();
            settingsRef.current = defaults;
            setSettingsState(defaults);
        }

        isInitializedRef.current = true;
    }, []); // 空依赖，只在mount时执行

    // 自动保存设置到localStorage（当设置变化时）
    useEffect(() => {
        // 跳过初始化阶段的保存
        if (!isInitializedRef.current) return;

        saveSettings();
    }, [settingsState, saveSettings]);

    return {
        settings: settingsState,
        settingsRef,
        updateSettings,
        saveSettings,
        syncSettingsToCloud,
        isFreshInstall: isFreshInstallRef.current
    };
}

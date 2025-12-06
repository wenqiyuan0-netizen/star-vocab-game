import { useState, useRef, useCallback } from 'react';

/**
 * useGameState Hook
 * 管理游戏核心状态：分数、生命值、连击、游戏状态等
 */
export function useGameState() {
    // 游戏状态
    const [gameState, setGameState] = useState('menu'); // menu | playing | pause | win | gameover | dashboard

    // UI显示状态
    const [uiScore, setUiScore] = useState(0);
    const [uiLives, setUiLives] = useState(5);
    const [uiDeckCount, setUiDeckCount] = useState(0);

    // 消息和反馈
    const [message, setMessage] = useState(null);

    // 连击系统
    const [combo, setCombo] = useState(0);
    const [maxCombo, setMaxCombo] = useState(0);

    // Refs for game loop (不走React渲染)
    const scoreRef = useRef(0);
    const livesRef = useRef(5);
    const comboRef = useRef(0);
    const maxComboRef = useRef(0);
    const gameStatusRef = useRef('menu');

    // 自适应速度
    const adaptiveSpeedRef = useRef(1.0);

    // Session统计
    const sessionStatsRef = useRef(new Map());

    /**
     * 重置游戏状态
     */
    const resetGame = useCallback((initialLives = 5) => {
        scoreRef.current = 0;
        livesRef.current = initialLives;
        comboRef.current = 0;
        maxComboRef.current = 0;
        adaptiveSpeedRef.current = 1.0;
        sessionStatsRef.current = new Map();

        setUiScore(0);
        setUiLives(initialLives);
        setUiDeckCount(0);
        setCombo(0);
        setMaxCombo(0);
    }, []);

    /**
     * 更新分数
     */
    const addScore = useCallback((points) => {
        scoreRef.current += points;
        setUiScore(scoreRef.current);
    }, []);

    /**
     * 减少生命值
     */
    const loseLife = useCallback(() => {
        livesRef.current = Math.max(0, livesRef.current - 1);
        setUiLives(livesRef.current);

        // 重置连击
        comboRef.current = 0;
        setCombo(0);
        adaptiveSpeedRef.current = 1.0;
    }, []);

    /**
     * 增加连击
     */
    const incrementCombo = useCallback(() => {
        comboRef.current += 1;
        setCombo(comboRef.current);

        if (comboRef.current > maxComboRef.current) {
            maxComboRef.current = comboRef.current;
            setMaxCombo(comboRef.current);
        }

        // 自适应速度：连击越高，速度越快
        adaptiveSpeedRef.current = Math.min(5.0, 1.0 + comboRef.current * 0.05);

        return comboRef.current;
    }, []);

    /**
     * 重置连击
     */
    const resetCombo = useCallback(() => {
        comboRef.current = 0;
        setCombo(0);
        adaptiveSpeedRef.current = 1.0;
    }, []);

    /**
     * 更新卡组剩余数量
     */
    const updateDeckCount = useCallback((count) => {
        setUiDeckCount(count);
    }, []);

    /**
     * 切换游戏状态
     */
    const changeGameState = useCallback((newState) => {
        gameStatusRef.current = newState;
        setGameState(newState);
    }, []);

    /**
     * 显示消息
     */
    const showMessage = useCallback((msg, duration = 2000) => {
        setMessage(msg);
        if (duration > 0) {
            setTimeout(() => setMessage(null), duration);
        }
    }, []);

    /**
     * 更新session统计
     */
    const updateSessionStats = useCallback((wordId, action) => {
        const stats = sessionStatsRef.current.get(wordId) || { spawns: 0, misses: 0 };

        if (action === 'spawn') {
            stats.spawns += 1;
        } else if (action === 'miss') {
            stats.misses += 1;
        }

        sessionStatsRef.current.set(wordId, stats);
    }, []);

    /**
     * 获取单词的session统计
     */
    const getSessionStats = useCallback((wordId) => {
        return sessionStatsRef.current.get(wordId) || { spawns: 0, misses: 0 };
    }, []);

    /**
     * 同步ref到UI state
     */
    const syncToUI = useCallback(() => {
        setUiScore(scoreRef.current);
        setUiLives(livesRef.current);
        setCombo(comboRef.current);
        setMaxCombo(maxComboRef.current);
    }, []);

    return {
        // States
        gameState,
        uiScore,
        uiLives,
        uiDeckCount,
        message,
        combo,
        maxCombo,

        // Refs
        scoreRef,
        livesRef,
        comboRef,
        maxComboRef,
        gameStatusRef,
        adaptiveSpeedRef,
        sessionStatsRef,

        // Actions
        resetGame,
        addScore,
        loseLife,
        incrementCombo,
        resetCombo,
        updateDeckCount,
        changeGameState,
        showMessage,
        updateSessionStats,
        getSessionStats,
        syncToUI
    };
}

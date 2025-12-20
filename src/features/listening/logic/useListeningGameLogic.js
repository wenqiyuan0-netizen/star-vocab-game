import { useState, useEffect, useCallback, useRef } from 'react';
import { listeningRepo } from '../services/ListeningRepository';
import { selectNextWord, buildClozeChallenge } from './ListeningEngine';
import { MaterialGenerator } from '../services/MaterialGenerator';

export function useListeningGameLogic(userId, globalWordDb) {
    const [view, setView] = useState('hub'); // hub, gamble, practice, materials
    const [loading, setLoading] = useState(true);
    
    // Data State
    const [wallet, setWallet] = useState({ balance: 0 });
    const [activeChallenge, setActiveChallenge] = useState(null);
    const [materials, setMaterials] = useState([]);
    
    // UI State
    const [notification, setNotification] = useState(null);
    const [currentWordChallenge, setCurrentWordChallenge] = useState(null);

    const initializedRef = useRef(false);

    const loadData = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        try {
            // 1. Check Expiry First
            const expiryResult = await listeningRepo.checkExpiryRPC();
            if (expiryResult?.penalty_applied) {
                    setNotification({ type: 'warning', message: '上次挑战未完成，收益已折半。' });
            }

            // 2. Parallel fetch
            const [remoteWallet, remoteChallenge, remoteMaterials] = await Promise.all([
                listeningRepo.getRemoteWallet(userId),
                listeningRepo.getActiveRemoteChallenge(userId),
                listeningRepo.getRemoteMaterials(userId)
            ]);

            setWallet(remoteWallet || { balance: 0 });
            setActiveChallenge(remoteChallenge);
            setMaterials(remoteMaterials || []);

        } catch (err) {
            console.error("Failed to load listening data:", err);
            setNotification({ type: 'error', message: '数据加载失败，请检查网络' });
        } finally {
            setLoading(false);
        }
    }, [userId]);

    // Initial load
    useEffect(() => {
        loadData();
    }, [loadData]);

    // Helper to generate word challenge (Gamble Mode)
    const generateWordChallenge = useCallback((wordDb) => {
        const word = selectNextWord(wordDb, null, null);
        if (word) {
            // Determine difficulty based on proficiency (0-100)
            let difficulty = 0;
            if (word.proficiency > 70) difficulty = 2; // Hard (Translation)
            else if (word.proficiency > 30) difficulty = 1; // Normal (Full Word)
            // 0-30: Easy (Partial)
            
            return buildClozeChallenge(word, difficulty);
        }
        return null;
    }, []);

    // Auto-generate word challenge if in gamble mode
    useEffect(() => {
        if (view === 'gamble' && !currentWordChallenge && globalWordDb && globalWordDb.length > 0) {
            const challenge = generateWordChallenge(globalWordDb);
            if (challenge) {
                setCurrentWordChallenge(challenge);
            }
        }
    }, [view, currentWordChallenge, globalWordDb, generateWordChallenge]);

    // --- Actions ---

    // 1. Submit Word Result (Earn Points)
    const submitResult = useCallback(async (isCorrect, wordLength, multiplier) => {
        if (!userId || !currentWordChallenge?.word) return;

        // Optimistic UI Update (optional, but safer to wait for RPC in this critical financial logic)
        // const earned = isCorrect ? Math.ceil(wordLength * multiplier) : 0;
        
        try {
            // Calculate earned amount based on rules
            // Base: Word Length * Multiplier
            // Penalty: If wallet has penaltyMultiplier (0.5), apply it.
            let earned = 0;
            if (isCorrect) {
                const base = Math.ceil(wordLength * multiplier);
                const penalty = wallet?.penalty_multiplier || 1.0; // Note snake_case from DB
                earned = Math.floor(base * penalty);
            }

            const finalResult = await listeningRepo.submitReviewRPC(
                currentWordChallenge.word.id,
                isCorrect ? 3 : 1,
                0,
                earned
            );
            
            if (finalResult && finalResult.success) {
                setWallet(prev => ({ ...prev, balance: finalResult.new_balance }));
            }
            
            // Generate next
            const next = generateWordChallenge(globalWordDb);
            setCurrentWordChallenge(next);

        } catch (err) {
            console.error("Failed to submit review:", err);
            setNotification({ type: 'error', message: '提交结果失败' });
        }
    }, [userId, wallet, currentWordChallenge, globalWordDb, generateWordChallenge]);

    // 2. Start Challenge (Spend Points -> Create Podcast)
    const startChallenge = useCallback(async (cost, topic = "General") => {
        if (wallet.balance < cost) {
            setNotification({ type: 'error', message: '积分不足' });
            return;
        }

        setLoading(true);
        try {
            // 1. Generate Material Content (Frontend or Backend?)
            // User said: "利用gemini语音合成"
            // Ideally, we generate text here, then get audio. 
            // For now, let's assume MaterialGenerator does the heavy lifting of text generation.
            const materialContent = await MaterialGenerator.generateContent(topic); // Returns { title, transcript: [...] }
            
            // 2. Get Audio (Mock or Real)
            const audioUrl = "https://example.com/audio.mp3"; // Placeholder
            
            // 3. Call RPC to deduct balance and create challenge record
            const result = await listeningRepo.startChallengeRPC(
                cost,
                materialContent,
                audioUrl
            );

            if (result.success) {
                // Update local state
                const newChallenge = {
                    id: result.challenge_id,
                    user_id: userId,
                    transcript: materialContent,
                    audio_url: audioUrl,
                    status: 'pending',
                    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                };
                
                setActiveChallenge(newChallenge);
                setWallet(prev => ({ ...prev, balance: prev.balance - cost }));
                setView('practice');
            } else {
                setNotification({ type: 'error', message: result.error || '开启挑战失败' });
            }

        } catch (err) {
            console.error("Failed to start challenge:", err);
            setNotification({ type: 'error', message: '开启挑战失败' });
        } finally {
            setLoading(false);
        }
    }, [userId, wallet]);

    // 3. Complete Challenge (Save to Materials)
    const completeChallenge = useCallback(async () => {
        if (!activeChallenge) return;

        setLoading(true);
        try {
            const result = await listeningRepo.completeChallengeRPC(
                activeChallenge.id,
                activeChallenge.transcript?.title || "Listening Practice",
                120 // Duration placeholder
            );

            if (result.success) {
                setNotification({ type: 'success', message: '挑战完成！已归档至材料库。' });
                setActiveChallenge(null);
                
                // Refresh materials
                const newMaterials = await listeningRepo.getRemoteMaterials(userId);
                setMaterials(newMaterials);
                
                setView('materials');
            } else {
                setNotification({ type: 'error', message: result.error || '提交失败' });
            }
        } catch (err) {
            console.error("Failed to complete challenge:", err);
            setNotification({ type: 'error', message: '提交失败' });
        } finally {
            setLoading(false);
        }
    }, [userId, activeChallenge]);

    // Navigation Wrappers
    const goToMaterials = () => setView('materials');
    const goToHub = () => setView('hub');
    const goToGamble = () => setView('gamble');
    const goToPractice = () => {
        if (activeChallenge) setView('practice');
        else setNotification({ type: 'warning', message: '当前没有进行中的挑战' });
    };

    const clearNotification = () => setNotification(null);

    // Skip/Next Word
    const nextWord = useCallback(() => {
        const next = generateWordChallenge(globalWordDb);
        setCurrentWordChallenge(next);
    }, [globalWordDb, generateWordChallenge]);

    return {
        view,
        loading,
        wallet,
        activeChallenge,
        materials,
        notification,
        currentWordChallenge, // Renamed from currentChallenge for clarity
        actions: {
            setView,
            startChallenge,
            completeChallenge,
            submitResult,
            nextWord,
            goToMaterials,
            goToHub,
            goToGamble,
            goToPractice,
            clearNotification,
            refreshData: loadData
        }
    };
}

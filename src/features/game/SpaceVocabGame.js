import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Heart, Play, Sparkles, Settings, AlertCircle, Sliders, Globe, Zap, Brain,
  PlusCircle, Save, Trash2, Eye, X, LogOut, Activity, RotateCcw, Download,
  Upload, Copy, Volume2, Info, BarChart2, Trophy
} from 'lucide-react';
import { ReviewClearanceModal } from '../learning/components/ReviewClearanceModal';
import { detectReviewBacklog, activateClearanceMode, checkAndRestoreSettings } from '../learning/services/ClearanceHelper';

import { CalendarModal } from '../../shared/components/ui/CalendarModal';
import { GlassButton } from '../../shared/components/ui/GlassButton';

import { LEARNING_STEPS, MIN_EASE_FACTOR, MAX_PRIORITY_QUEUE_SIZE, MIN_DECK_SIZE, DEFAULT_WORDS } from '../../logic/constants';
import { aiService } from '../../shared/services/ai/AIService';
import { escapeRegex, decodeEntities, sanitizeCn, cleanGermanExample, sanitizeGermanSentence, getLines } from '../../logic/utils';
import { exampleService } from '../../shared/services/examples/ExampleService';
import { soundManager } from '../../shared/services/audio/SoundManager';
import { getThemeColor, StarFragment, Particle } from './logic/visualEntities';

import { processImportInput } from '../vocabulary/services/WordProcessor';
import { processWordResult } from '../../logic/srs';
import { generateSaveCode, parseSaveCode, copyTextToClipboard } from '../../infrastructure/persistence/localStorage';
import { calculateSpawnPair } from './logic/spawner';
import { LocalCorpusService, localCorpusService } from '../../shared/services/examples/LocalCorpusService';
import { DeckGenerator } from '../learning/services/DeckGenerator';
import { useTheme } from '../../shared/hooks/useTheme';
import { getLocalDateString, calculateStreakFromDates } from '../../utils/dateUtils';
import { Dashboard } from '../dashboard/components/Dashboard';
import { useSupabaseData } from '../../shared/hooks/useSupabase/useSupabaseData';
import { useSupabaseProfile } from '../../shared/hooks/useSupabase/useSupabaseProfile';
import { useAuth } from '../auth/contexts/AuthContext';

// CustomModal (保持 V1 原样)
const CustomModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText = '确认', cancelText = '取消' }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[999]">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Info className="w-6 h-6 text-yellow-500" />
          {title}
        </h3>
        <p className="text-sm text-gray-600">{message}</p>
        <div className="flex justify-end gap-3 pt-2">
          {onCancel && (
            <button onClick={onCancel} className="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition">
              {cancelText}
            </button>
          )}
          {onConfirm && (
            <button onClick={onConfirm} className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 transition shadow-lg shadow-red-500/30">
              {confirmText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default function SpaceVocabGame() {
  const theme = useTheme();
  const { session } = useAuth();
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [showSaveArea, setShowSaveArea] = useState(false);
  const [, forceUpdate] = useState({});
  const exampleServiceRef = useRef(exampleService);

  // Set access token for AI Service
  useEffect(() => {
    if (session?.access_token) {
      aiService.setAccessToken(session.access_token);
    }
  }, [session]);

  const {
    words: cloudWords,
    loading: cloudLoading,
    initialized: cloudInitialized,
    loadWords: loadCloudWords,
    syncWord,
    syncWordsBatch,
    deleteWord: deleteCloudWord,
    deleteWordsBatch: deleteCloudWordsBatch,
    error: cloudError
  } = useSupabaseData();

  useEffect(() => {
    if (cloudError) {
      console.error("Cloud Sync Error:", cloudError);
      // Optional: Show a subtle notification or just log it
      // setMessage(`同步失败: ${cloudError}`); 
    }
  }, [cloudError]);

  const {
    profile: cloudProfile,
    updateProfile: updateCloudProfile,
    loading: profileLoading
  } = useSupabaseProfile();

  // --- Refs & State ---
  const scoreRef = useRef(0);
  const livesRef = useRef(5);
  const gameDeckRef = useRef([]);
  const gameStatusRef = useRef('menu');
  const lastFrameTimeRef = useRef(0);
  const priorityQueueRef = useRef([]);
  const sessionStatsRef = useRef(new Map());
  const comboRef = useRef(0);
  const maxComboRef = useRef(0);
  const adaptiveSpeedRef = useRef(1.0);
  const shakeIntensityRef = useRef(0);
  const layoutRef = useRef({ uiScale: 1, isPortrait: false });
  const isPausedRef = useRef(false);

  const cloudMergeRef = useRef(false);
  const lastSyncedSettingsRef = useRef(null);
  const isFreshInstallRef = useRef(false);

  // V2 改动保留：增加了 dailyNewLimit 等设置项，这不影响 UI
  const settingsRef = useRef({
    speed: 2.5,
    spawnRate: 1600,
    maxOnScreen: 10,
    difficulty: 5,
    ttsMode: 'none',
    speakDe: true,
    speakCn: false,
    apiKey: '',
    dailyNewLimit: 5,      // V2 新增
    dailyReviewLimit: 10,  // V2 新增
    updatedAt: 0           // V2 Sync: Timestamp for conflict resolution
  });

  // V2 改动保留：每日统计结构
  const dailyStatsRef = useRef({
    date: new Date().toDateString(),
    newCount: 0,
    reviewCount: 0,
    isCheckedIn: false,
    bonusXP: 0
  });

  const userProfileRef = useRef((() => {
    try {
      const saved = localStorage.getItem('space_vocab_user_profile');
      if (saved) return JSON.parse(saved);
    } catch { }
    return { totalXP: 0, level: 1, checkInDates: [], streak: 0 };
  })());

  // Sync Profile from Cloud
  useEffect(() => {
    if (!profileLoading && cloudProfile) {
      const streak = calculateStreakFromDates(cloudProfile.checkInDates || []);

      // Sync dailyStats from cloud if available and matches today
      if (cloudProfile.dailyStats) {
        const todayStr = new Date().toDateString();
        // Smart Merge: Don't blindly overwrite local progress with cloud data
        if (cloudProfile.dailyStats.date === todayStr) {
          const cloud = cloudProfile.dailyStats;
          const local = dailyStatsRef.current;

          // If local is not initialized for today yet, or cloud is strictly better
          if (local.date !== todayStr) {
            dailyStatsRef.current = { ...cloud };
          } else {
            // Both are today: Merge to keep max progress
            dailyStatsRef.current = {
              date: todayStr,
              newCount: Math.max(local.newCount || 0, cloud.newCount || 0),
              reviewCount: Math.max(local.reviewCount || 0, cloud.reviewCount || 0),
              isCheckedIn: local.isCheckedIn || cloud.isCheckedIn,
              bonusXP: Math.max(local.bonusXP || 0, cloud.bonusXP || 0)
            };
          }
          localStorage.setItem('space_vocab_daily_stats', JSON.stringify(dailyStatsRef.current));
        }
      }

      // Sync Daily Plan (Deck) from Cloud
      // FIX: Only accept cloud plan if it was generated with settings that are NEWER or EQUAL to local settings.
      // If local settings are newer, the cloud plan is stale (generated with old limits) and should be ignored.
      const cloudSettings = cloudProfile.settings?.gameSettings || {};
      const cloudSettingsTime = cloudSettings.updatedAt || 0;
      const localSettingsTime = settingsRef.current.updatedAt || 0;

      if (cloudProfile.dailyPlan) {
        const todayStr = new Date().toDateString();
        if (cloudProfile.dailyPlan.date === todayStr && cloudProfile.dailyPlan.deck && cloudProfile.dailyPlan.deck.length > 0) {
          // Check local plan
          try {
            const localPlan = JSON.parse(localStorage.getItem('star_vocab_daily_plan'));
            // If local plan is missing or old, or cloud plan is different (we prioritize cloud for consistency across devices)
            if (!localPlan || localPlan.date !== todayStr) {
              // Only restore if cloud plan is NOT stale based on settings timestamp
              // If cloudSettingsTime < localSettingsTime, it means we changed settings locally but haven't synced a new plan yet.
              if (cloudSettingsTime >= localSettingsTime) {
                localStorage.setItem('star_vocab_daily_plan', JSON.stringify(cloudProfile.dailyPlan));
              }
            }
          } catch { }
        }
      }

      // Sync Settings & Wallpaper from Cloud
      if (cloudProfile.settings && Object.keys(cloudProfile.settings).length > 0) {
        let shouldApply = false;

        if (isFreshInstallRef.current) {
          shouldApply = true;
          isFreshInstallRef.current = false;
        } else {
          // FIX: Only sync DOWN if cloud settings are NEWER than local settings
          if (cloudSettingsTime > localSettingsTime) {
            shouldApply = true;
          }
        }

        if (shouldApply) {
          // 1. Game Settings
          if (cloudProfile.settings.gameSettings) {
            updateSettings(cloudProfile.settings.gameSettings, true);
          }
          // 2. Wallpaper
          if (cloudProfile.settings.wallpaper) {
            setWallpaper(cloudProfile.settings.wallpaper);
            localStorage.setItem('star-vocab-wallpaper-home', cloudProfile.settings.wallpaper);
            localStorage.setItem('star-vocab-wallpaper-system', cloudProfile.settings.wallpaper);
          }
        }
      }

      // FIX: Smart Merge for User Profile (XP/Level)
      // Always take the MAXIMUM value to prevent regression
      const mergedTotalXP = Math.max(userProfileRef.current.totalXP || 0, cloudProfile.totalXP || 0);
      const mergedLevel = Math.max(userProfileRef.current.level || 1, cloudProfile.level || 1);

      // Merge Check-in dates (Union of sets)
      const mergedDates = [...new Set([...(userProfileRef.current.checkInDates || []), ...(cloudProfile.checkInDates || [])])];

      // Recalculate streak based on merged dates
      const newStreak = calculateStreakFromDates(mergedDates);

      userProfileRef.current = {
        totalXP: mergedTotalXP,
        level: mergedLevel,
        checkInDates: mergedDates,
        streak: newStreak
      };

      // Persist merged profile to local storage immediately
      localStorage.setItem('space_vocab_user_profile', JSON.stringify(userProfileRef.current));

      // FIX: Bidirectional Sync - If local state is ahead of cloud (e.g. played offline), push it back to cloud
      if (mergedTotalXP > (cloudProfile.totalXP || 0) ||
        mergedDates.length > (cloudProfile.checkInDates?.length || 0)) {
        updateCloudProfile({
          totalXP: mergedTotalXP,
          level: mergedLevel,
          checkInDates: mergedDates
        });
      }

      // Force UI update
      forceUpdate({});
    }
  }, [cloudProfile, profileLoading, updateCloudProfile]);

  const calculateLevel = (xp) => {
    if (xp < 0) return 1;
    return Math.floor((1 + Math.sqrt(1 + xp / 125)) / 2);
  };
  const getXPForLevel = (level) => 500 * (level * level - level);

  useEffect(() => {
    try {
      const savedStats = JSON.parse(localStorage.getItem('space_vocab_daily_stats'));
      const today = new Date().toDateString();
      if (savedStats && savedStats.date === today) {
        dailyStatsRef.current = { ...savedStats, isCheckedIn: savedStats.isCheckedIn || false, bonusXP: savedStats.bonusXP || 0 };
      } else {
        dailyStatsRef.current = { date: today, newCount: 0, reviewCount: 0, isCheckedIn: false, bonusXP: 0 };
        localStorage.setItem('space_vocab_daily_stats', JSON.stringify(dailyStatsRef.current));
      }
      const savedProfile = JSON.parse(localStorage.getItem('space_vocab_user_profile'));
      if (savedProfile) {
        userProfileRef.current = {
          totalXP: savedProfile.totalXP || 0,
          level: calculateLevel(savedProfile.totalXP || 0),
          checkInDates: Array.isArray(savedProfile.checkInDates) ? savedProfile.checkInDates : [],
          streak: savedProfile.streak || 0
        };
      }

      // Sync check-in status (legacy fix): if daily stats says checked in, ensure it's in profile
      if (dailyStatsRef.current.isCheckedIn) {
        const todayISO = new Date().toISOString().split('T')[0];
        if (!userProfileRef.current.checkInDates.includes(todayISO)) {
          userProfileRef.current.checkInDates.push(todayISO);
          localStorage.setItem('space_vocab_user_profile', JSON.stringify(userProfileRef.current));
        }
      }
    } catch { }
  }, []);

  const saveUserProfile = (newXP = 0, newCheckIn = false) => {
    const oldLevel = userProfileRef.current.level;
    const currentTotalXP = userProfileRef.current.totalXP + newXP;
    const newLevel = calculateLevel(currentTotalXP);

    let { checkInDates, streak } = userProfileRef.current;

    if (newCheckIn) {
      const todayISO = getLocalDateString();
      if (!checkInDates.includes(todayISO)) {
        // Calculate Streak
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayISO = getLocalDateString(yesterday);

        if (checkInDates.includes(yesterdayISO)) {
          streak += 1;
        } else {
          streak = 1;
        }
        checkInDates = [...checkInDates, todayISO];
      }
    }

    userProfileRef.current = { totalXP: currentTotalXP, level: newLevel, checkInDates, streak };
    localStorage.setItem('space_vocab_user_profile', JSON.stringify(userProfileRef.current));

    // Cloud Sync
    let currentDailyPlan = null;
    try { currentDailyPlan = JSON.parse(localStorage.getItem('star_vocab_daily_plan')); } catch { }

    updateCloudProfile({
      totalXP: currentTotalXP,
      level: newLevel,
      checkInDates: checkInDates,
      dailyStats: dailyStatsRef.current,
      dailyPlan: currentDailyPlan
    });

    if (newLevel > oldLevel) {
      setMessage(`升级了！达到 Lv.${newLevel}！`);
      soundManager.playVictory();
    }
  };

  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [uiScore, setUiScore] = useState(0);
  const [uiLives, setUiLives] = useState(5);
  const [uiDeckCount, setUiDeckCount] = useState(0);
  const [gameState, setGameState] = useState('menu');
  const currentSentenceRef = useRef(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [customInput, setCustomInput] = useState('');
  const [showSettingsOverlay, setShowSettingsOverlay] = useState(false);
  const [settingsState, setSettingsState] = useState(settingsRef.current);

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [saveString, setSaveString] = useState('');
  const [importString, setImportString] = useState('');
  const [wallpaper, setWallpaper] = useState(null);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmMessage, setConfirmMessage] = useState('');

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const pendingBatchRef = useRef(new Set());
  const hoverTimerRef = useRef(null);

  const [hoveringId, setHoveringId] = useState(null);
  const [examplesById, setExamplesById] = useState({});
  const [loadingExampleId, setLoadingExampleId] = useState(null);
  const longPressTimerRef = useRef(null);

  // V2 改动保留：数据初始化时的迁移逻辑 (防止旧存档报错)
  const [globalWordDb, setGlobalWordDb] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('space_vocab_db'));
      if (saved && Array.isArray(saved)) {
        let dataToReturn = saved;
        // 自动修复旧数据缺失字段
        if (saved.length > 0 && (saved[0].step === undefined || saved[0].interval === undefined)) {
          dataToReturn = saved.map(w => ({
            ...w,
            state: w.familiarity > 0 ? 'review' : 'new',
            step: w.step || 0,
            interval: w.interval || 0,
            easeFactor: w.easeFactor || 2.5,
            dueDate: w.dueDate || 0,
          }));
        }
        return dataToReturn.sort((a, b) => a.de.localeCompare(b.de, 'de', { sensitivity: 'base' }));
      }
      return DEFAULT_WORDS;
    } catch {
      return DEFAULT_WORDS;
    }
  });

  // Cloud Sync Initialization - Intelligent Timestamp Logic
  useEffect(() => {
    if (!cloudInitialized) { loadCloudWords(); return; }
    if (cloudMergeRef.current) return;

    // SAFETY CHECK: If cloud sync failed, DO NOT merge (risk of data loss)
    if (cloudError) {
      console.warn("Cloud sync failed, skipping merge to preserve local data.");
      cloudMergeRef.current = true; // Stop trying this session
      return;
    }

    cloudMergeRef.current = true;

    const localDataRaw = localStorage.getItem('space_vocab_db');
    const localData = (() => { try { const j = JSON.parse(localDataRaw); return Array.isArray(j) ? j : []; } catch { return []; } })();

    // Helper: Parse timestamp from ID (c_17283928_xxx)
    const getWordCreationTime = (id) => {
      if (!id || !id.startsWith('c_')) return 0;
      const parts = id.split('_');
      if (parts.length >= 2) {
        const ts = parseInt(parts[1]);
        return isNaN(ts) ? 0 : ts;
      }
      return 0;
    };

    // Helper: Content fingerprint
    const keyOf = (w) => `${String(w.de || '').toLowerCase()}|${String(w.gender || '')}`;
    const sortFn = (a, b) => a.de.localeCompare(b.de, 'de', { sensitivity: 'base' });

    // 1. Get Last Sync Time
    const lastSyncTime = parseInt(localStorage.getItem('space_vocab_last_sync') || '0');
    const now = Date.now();

    // 2. Build Maps
    const mergedMap = new Map();
    const cloudIds = new Set();
    const processedCloudIds = new Set();

    // Always trust Cloud data first (Server Truth for existing records)
    if (Array.isArray(cloudWords)) {
      cloudWords.forEach(w => {
        const k = keyOf(w);
        mergedMap.set(k, w);
        if (w.id) cloudIds.add(w.id);
      });
    }

    // 3. Process Local Data
    const wordsToPush = [];

    // Strategy Update: Tombstone & Timestamp based Sync
    // We now have 'isDeleted' and 'localUpdatedAt' fields (if migrated).
    // If not migrated locally, we treat them as old format (active).

    localData.forEach(w => {
      const k = keyOf(w);
      const inCloud = mergedMap.has(k) || (w.id && cloudIds.has(w.id));
      
      // Get cloud version if exists
      const cloudVer = mergedMap.get(k) || (w.id ? cloudWords.find(cw => cw.id === w.id) : null);

      if (inCloud && cloudVer) {
        if (cloudVer.id) processedCloudIds.add(cloudVer.id);
        // CONFLICT RESOLUTION
        // 1. Cloud is DELETED (Tombstone)
        if (cloudVer.isDeleted) {
          // If local is also deleted, fine.
          // If local is ACTIVE:
          //   Check timestamps. If local is NEWER than cloud's updated_at (or local_updated_at),
          //   it means "Resurrection" (User added it back).
          //   Otherwise, accept deletion.
          
          const cloudTime = cloudVer.localUpdatedAt || cloudVer.updatedAt || 0; // prefer local_updated_at logic if available
          const localTime = w.localUpdatedAt || w.updatedAt || 0;

          if (!w.isDeleted && localTime > cloudTime + 1000) { // 1s buffer
             // Resurrection Wins: Keep local, mark as dirty to push
             mergedMap.set(k, { ...w, id: cloudVer.id }); // Reuse ID
             wordsToPush.push({ ...w, id: cloudVer.id });
          } else {
             // Deletion Wins: Mark local as deleted (Tombstone)
             mergedMap.set(k, { ...cloudVer, isDeleted: true });
          }
        } 
        // 2. Cloud is ACTIVE
        else {
           // If local is DELETED and newer -> Push Deletion
           const cloudTime = cloudVer.localUpdatedAt || cloudVer.updatedAt || 0;
           const localTime = w.localUpdatedAt || w.updatedAt || 0;

           if (w.isDeleted && localTime > cloudTime + 1000) {
              mergedMap.set(k, w);
              wordsToPush.push(w);
           } else {
              // Standard Merge: Cloud usually wins for properties, but we keep local progress if newer
              // For simplicity, we stick to: Cloud Wins for props, Local wins for SRS if strictly playing offline
              // But here we just merge cloud into local key
              mergedMap.set(k, { ...cloudVer, ...w, id: cloudVer.id, isDeleted: false });
           }
        }
      } else {
        // Local word NOT in Cloud.
        // DECISION: New or Stale?
        // With Soft Delete, "Not in Cloud" means it's genuinely NEW (never synced), 
        // OR we are in a transition state where we haven't fetched tombstones yet (but we load ALL now).
        // So, if it's not in cloud array, it's a NEW local word.
        
        mergedMap.set(k, w);
        wordsToPush.push(w);
      }
    });

    // 4. ADD REMAINING CLOUD WORDS (That are not in local)
    // Fix for sync issue: Ensure new cloud words are added even if local is empty/different
    if (Array.isArray(cloudWords)) {
      cloudWords.forEach(cw => {
        const k = keyOf(cw);
        // Add if not processed by ID AND not already in map (by content)
        if ((!cw.id || !processedCloudIds.has(cw.id)) && !mergedMap.has(k)) {
           mergedMap.set(k, cw);
        }
      });
    }

    const mergedList = Array.from(mergedMap.values())
      .filter(w => !w.isDeleted) // Filter out tombstones for UI
      .sort(sortFn);

    // 4. Update State & Storage
    // We store even tombstones in local storage to track deletions, 
    // BUT 'mergedList' above filtered them out for the game state.
    // Let's keep tombstones in DB but separate for Game.
    
    // Actually, to persist tombstones, we need to save the FULL map values to localStorage
    const fullListToSave = Array.from(mergedMap.values());
    
    setGlobalWordDb(mergedList); // UI only needs active words
    localStorage.setItem('space_vocab_db', JSON.stringify(fullListToSave));
    localStorage.setItem('space_vocab_last_sync', String(now));

    // 5. Push changes back to Cloud if needed
    if (wordsToPush.length > 0) {
      syncWordsBatch(wordsToPush);
    }

  }, [cloudInitialized, loadCloudWords, cloudWords, syncWordsBatch]);

  const fetchAndShowExample = async (w) => {
    setHoveringId(w.id);
    if (examplesById[w.id] || loadingExampleId === w.id) return;
    setLoadingExampleId(w.id);
    try {
      const ex = await exampleServiceRef.current.getExample(w.de, w.cn, w.id);
      if (ex) setExamplesById(prev => ({ ...prev, [w.id]: ex }));
    } finally {
      setLoadingExampleId(null);
    }
  };

  // ⚠️ V1 恢复：移除 triggerNeighborhoodBatch (邻域预加载)，恢复纯净的悬停逻辑
  const handleMouseEnterWord = (w) => {
    if (selectionMode) return;
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      fetchAndShowExample(w);
    }, 300);
  };

  const handleMouseLeaveWord = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setHoveringId(null);
  };

  const handleTouchStartWord = (w) => {
    if (selectionMode) return;
    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      fetchAndShowExample(w);
    }, 500);
  };

  const handleTouchEndWord = () => {
    clearTimeout(longPressTimerRef.current);
    setHoveringId(null);
  };

  const requestRef = useRef();
  const fragmentsRef = useRef([]);
  const particlesRef = useRef([]);
  const selectedFragmentRef = useRef(null);
  const lastSpawnTimeRef = useRef(0);
  const ttsTokenRef = useRef(0);

  useEffect(() => {
    aiService.setApiKey(settingsState.apiKey);
  }, [settingsState.apiKey]);

  useEffect(() => {
    const loadWallpaper = () => {
      const homeWall = localStorage.getItem('star-vocab-wallpaper-home');
      const sysWall = localStorage.getItem('star-vocab-wallpaper-system');
      const saved = sysWall || homeWall;
      setWallpaper(saved || "https://images3.alphacoders.com/134/1342579.png");
    };
    loadWallpaper();
    window.addEventListener('storage', loadWallpaper);
    window.addEventListener('wallpaper-changed', loadWallpaper);
    return () => {
      window.removeEventListener('storage', loadWallpaper);
      window.removeEventListener('wallpaper-changed', loadWallpaper);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('space_vocab_db', JSON.stringify(globalWordDb));
  }, [globalWordDb]);

  useEffect(() => {
    if (gameState !== 'dashboard') return;
    const onKey = (e) => {
      if (!selectionMode) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleBulkDeleteRequest();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        clearSelection();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setSelectedIds(new Set(globalWordDb.map(w => w.id)));
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectionMode, gameState, globalWordDb]);

  useEffect(() => {
    if (gameState !== 'dashboard') {
      setSelectedIds(new Set());
      setSelectionMode(false);
    }
  }, [gameState]);

  const updateSettings = (newSettings, fromCloud = false) => {
    // 检查是否调整了每日目标，如果是，则清除今日计划缓存，以便下次开始游戏时重新生成
    // 并且如果当前正在菜单界面，我们可以尝试预加载新的计划（或者不预加载，等用户点开始时自动生成）
    const hasGoalChanged = newSettings.dailyNewLimit !== undefined || newSettings.dailyReviewLimit !== undefined;

    if (hasGoalChanged) {
      localStorage.removeItem('star_vocab_daily_plan');
      // Only clear cloud plan if this change came from USER interaction (not cloud sync)
      // This prevents "Zombie Deck" resurrection where old cloud plan overwrites new local settings
      if (!fromCloud && cloudInitialized && updateCloudProfile) {
        updateCloudProfile({ dailyPlan: null });
      }
    }

    const timestampUpdate = !fromCloud ? { updatedAt: Date.now() } : {};
    const finalSettings = { ...newSettings, ...timestampUpdate };

    if (Object.prototype.hasOwnProperty.call(finalSettings, 'difficulty')) {
      const d = Math.max(1, Math.min(10, parseInt(finalSettings.difficulty)));
      const speed = parseFloat((0.7 + (d - 1) * (2.3 / 9)).toFixed(1));
      const maxOnScreen = Math.round(3 + (d - 1) * (7 / 9));
      const spawnRate = Math.round(2200 - (d - 1) * (1300 / 9));
      settingsRef.current = { ...settingsRef.current, ...finalSettings, difficulty: d, speed, maxOnScreen, spawnRate };
    } else {
      settingsRef.current = { ...settingsRef.current, ...finalSettings };
    }
    if (typeof settingsRef.current.speed === 'number') {
      settingsRef.current.speed = Math.max(0.3, Math.min(3.0, settingsRef.current.speed));
    }

    // 使用函数式更新确保React正确触发重新渲染
    setSettingsState(prev => ({ ...settingsRef.current }));

    // 如果修改了每日目标，显示即时反馈
    if (hasGoalChanged && !fromCloud) {
      const newLimit = settingsRef.current.dailyNewLimit || 0;
      const reviewLimit = settingsRef.current.dailyReviewLimit || 0;
      const total = newLimit + reviewLimit;
      setMessage(`每日目标已更新为 ${total} 个！`);
      setTimeout(() => setMessage(null), 2000);
    }

    // 强制 UI 更新
    forceUpdate({});
  };

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem('space_vocab_settings') || '{}');
      if (s && typeof s === 'object' && Object.keys(s).length > 0) {
        isFreshInstallRef.current = false;
        // Migration: If local settings exist but have no timestamp, 
        // assume they are recent and valid, so give them a timestamp to beat stale cloud data (0).
        if (!s.updatedAt) {
          s.updatedAt = Date.now();
        }
        updateSettings(s, true);
        if (settingsRef.current.difficulty == null) {
          updateSettings({ difficulty: 5 }, true); // 简化逻辑，默认5
        }
      } else {
        // Initialize default settings if nothing in local storage
        isFreshInstallRef.current = true;
        updateSettings({
          speed: 2.5,
          spawnRate: 1600,
          maxOnScreen: 10,
          difficulty: 5,
          dailyNewLimit: 5,
          dailyReviewLimit: 10,
          ttsMode: 'none',
          speakDe: true,
          speakCn: false,
          updatedAt: 0
        }, true);
      }
    } catch { }
  }, []);

  useEffect(() => {
    localStorage.setItem('space_vocab_settings', JSON.stringify(settingsRef.current));

    // Cloud Sync for Settings & Wallpaper
    if (cloudInitialized && updateCloudProfile) {
      const currentSettings = {
        gameSettings: settingsRef.current,
        wallpaper: wallpaper
      };
      let json = JSON.stringify(currentSettings);

      // Only sync if different from what we last loaded/saved
      if (lastSyncedSettingsRef.current !== json) {
        // Ensure timestamp is updated so other devices accept this change
        // This is crucial for wallpaper changes which don't naturally update gameSettings.updatedAt
        const now = Date.now();
        if ((settingsRef.current.updatedAt || 0) < now) {
          settingsRef.current.updatedAt = now;
          currentSettings.gameSettings.updatedAt = now;
          json = JSON.stringify(currentSettings);
          localStorage.setItem('space_vocab_settings', JSON.stringify(settingsRef.current));
        }

        lastSyncedSettingsRef.current = json;
        updateCloudProfile({ settings: currentSettings });
      }
    }
  }, [settingsState, wallpaper, cloudInitialized, updateCloudProfile]);

  useEffect(() => {
    if (gameState !== 'dashboard' || globalWordDb.length === 0) return;
    let isMounted = true;
    const queue = [...globalWordDb];
    const processQueue = async () => {
      const nextWord = queue.find(w => !exampleServiceRef.current.cache.has(w.id || w.de));
      if (!nextWord || !isMounted) return;
      await exampleServiceRef.current.getExample(nextWord.de, nextWord.cn, nextWord.id);
      if (isMounted) setTimeout(processQueue, 800);
    };
    processQueue();
    return () => { isMounted = false; };
  }, [gameState, globalWordDb]);

  // --- Session & Save Logic ---
  const saveGameSession = () => {
    const sessionData = {
      date: new Date().toDateString(),
      deck: gameDeckRef.current,
      score: scoreRef.current,
      lives: livesRef.current,
      combo: comboRef.current,
      maxCombo: maxComboRef.current,
      stats: Array.from(sessionStatsRef.current.entries()),
      timestamp: Date.now() // Add timestamp for versioning
    };
    // 本地保存
    localStorage.setItem('space_vocab_daily_session', JSON.stringify(sessionData));

    // 云端保存 (存入 settings 的 savedSession 字段)
    if (updateCloudProfile) {
      updateCloudProfile({
        settings: {
          ...settingsRef.current, // 保留现有设置
          savedSession: sessionData
        }
      });
    }
  };

  const clearGameSession = () => localStorage.removeItem('space_vocab_daily_session');

  const loadGameSession = () => {
    try {
      let saved = JSON.parse(localStorage.getItem('space_vocab_daily_session'));

      // Check Cloud Session (if valid and newer)
      const cloudSession = cloudProfile?.settings?.savedSession;
      if (cloudSession && cloudSession.date === new Date().toDateString()) {
        if (!saved || (cloudSession.timestamp || 0) > (saved.timestamp || 0)) {
          saved = cloudSession;
          // Also update local cache
          localStorage.setItem('space_vocab_daily_session', JSON.stringify(cloudSession));
        }
      }

      if (!saved || saved.date !== new Date().toDateString()) return false;

      // 修复逻辑：从 globalWordDb 恢复最新单词数据，避免覆盖编辑或复活已删单词
      const dbMap = new Map(globalWordDb.map(w => [w.id, w]));
      const rehydratedDeck = saved.deck
        .map(w => dbMap.get(w.id))
        .filter(w => w !== undefined);

      if (rehydratedDeck.length === 0 && saved.deck.length > 0) {
        // 如果所有单词都被删了，视为存档无效
        return false;
      }

      gameDeckRef.current = rehydratedDeck;
      scoreRef.current = saved.score;
      livesRef.current = saved.lives;
      comboRef.current = saved.combo || 0;
      maxComboRef.current = saved.maxCombo || 0;
      sessionStatsRef.current = new Map(saved.stats || []);
      setUiScore(saved.score);
      setUiLives(saved.lives);
      setUiDeckCount(saved.deck.length);
      return true;
    } catch (e) { return false; }
  };

  const [customCancelAction, setCustomCancelAction] = useState(null);
  const [customConfirmText, setCustomConfirmText] = useState('确认');
  const [customCancelText, setCustomCancelText] = useState('取消');

  // Review积压清理Modal状态
  const [showClearanceModal, setShowClearanceModal] = useState(false);
  const [clearanceInfo, setClearanceInfo] = useState(null);

  const showResumeDialog = () => {
    setConfirmMessage('检测到今日未完成的游戏进度。');
    setCustomConfirmText('继续挑战');
    setCustomCancelText('重新开始');
    setConfirmAction(() => () => {
      if (loadGameSession()) {
        try { soundManager.unlock(); } catch (e) { }
        aiService.warmUp();
        isPausedRef.current = false;
        setShowSettingsOverlay(false);
        gameStatusRef.current = 'playing';
        setGameState('playing');
        aiService.stopAll();
        fragmentsRef.current = [];
        particlesRef.current = [];
        lastSpawnTimeRef.current = 0;
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
        requestRef.current = requestAnimationFrame(update);
      }
      setShowConfirmModal(false);
      resetModalTexts();
    });
    setCustomCancelAction(() => () => {
      clearGameSession();
      startGame();
      setShowConfirmModal(false);
      resetModalTexts();
    });
    setShowConfirmModal(true);
  };

  const resetModalTexts = () => {
    setCustomConfirmText('确认');
    setCustomCancelText('取消');
    setCustomCancelAction(null);
  };

  const handleExportSave = () => {
    const code = generateSaveCode(globalWordDb);
    if (code) {
      setSaveString(code);
      setShowSaveArea(true);
      setMessage('存档码已生成！');
      setTimeout(() => setMessage(null), 2000);
    } else {
      setMessage('导出失败，数据可能过大');
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleImportSave = () => {
    const data = parseSaveCode(importString);
    if (data) {
      setGlobalWordDb(data);
      setMessage(`成功恢复 ${data.length} 个单词的进度！`);
      setImportString('');
      setShowSaveModal(false);
      setTimeout(() => setMessage(null), 2000);
    } else {
      setMessage('无效的存档码');
      setTimeout(() => setMessage(null), 2000);
    }
  };

  const handleCopySave = () => {
    if (copyTextToClipboard(saveString)) {
      setMessage("存档码已复制到剪贴板！");
    } else {
      setMessage("复制失败，请手动复制");
    }
    setTimeout(() => setMessage(null), 2000);
  };

  const handleResetData = () => {
    setConfirmMessage('确定要清空所有数据并恢复默认设置吗？此操作不可撤销！');
    setConfirmAction(() => () => {
      resetDataSilent();
      setShowConfirmModal(false);
      setMessage('所有数据已重置为默认。');
      setTimeout(() => setMessage(null), 2000);
    });
    setShowConfirmModal(true);
  };

  const resetDataSilent = () => {
    localStorage.clear();
    setGlobalWordDb(DEFAULT_WORDS);
  };

  // --- 游戏核心逻辑 ---
  const addToPriorityQueue = wordId => {
    if (!priorityQueueRef.current.includes(wordId)) {
      if (priorityQueueRef.current.length >= MAX_PRIORITY_QUEUE_SIZE)
        priorityQueueRef.current.shift();
      priorityQueueRef.current.push(wordId);
    }
  };

  const spawnFragment = (width, height) => {
    let wordData = null;
    let fromPQ = false;
    const currentWordIds = new Set(fragmentsRef.current.map(f => f.wordId.id));
    const pqCandidateIndex = priorityQueueRef.current.findIndex(id => !currentWordIds.has(id));

    if (pqCandidateIndex !== -1) {
      const pqId = priorityQueueRef.current[pqCandidateIndex];
      const deckIndex = gameDeckRef.current.findIndex(w => w.id === pqId);
      if (deckIndex !== -1) {
        wordData = gameDeckRef.current[deckIndex];
        gameDeckRef.current.splice(deckIndex, 1);
        priorityQueueRef.current.splice(pqCandidateIndex, 1);
        fromPQ = true;
      }
    }

    if (!wordData) {
      if (gameDeckRef.current.length === 0) return;
      const validCandidates = gameDeckRef.current.filter(w => !currentWordIds.has(w.id));
      if (validCandidates.length === 0) return;
      const randomIndex = Math.floor(Math.random() * validCandidates.length);
      wordData = validCandidates[randomIndex];
      const realIndex = gameDeckRef.current.findIndex(w => w.id === wordData.id);
      if (realIndex > -1) gameDeckRef.current.splice(realIndex, 1);
    }

    const spawnData = calculateSpawnPair(width, height, fragmentsRef.current);
    const pairId = Date.now() + Math.random();

    const f1 = new StarFragment(spawnData.de.x, spawnData.de.y, wordData.de, 'de', wordData, pairId, () => layoutRef.current.uiScale);
    f1.vx = spawnData.de.vx;
    f1.vy = spawnData.de.vy;

    const f2 = new StarFragment(spawnData.cn.x, spawnData.cn.y, wordData.cn, 'cn', wordData, pairId, () => layoutRef.current.uiScale);
    f2.vx = spawnData.cn.vx;
    f2.vy = spawnData.cn.vy;

    fragmentsRef.current.push(f1, f2);

    const stats = sessionStatsRef.current.get(wordData.id) || { spawns: 0, misses: 0 };
    stats.spawns += 1;
    sessionStatsRef.current.set(wordData.id, stats);
  };

  const update = useCallback((time) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      requestRef.current = requestAnimationFrame(update);
      return;
    }
    const ctx = canvas.getContext('2d');
    const width = window.innerWidth;
    const height = window.innerHeight;

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width; canvas.height = height;
    }

    const baseW = 390; const baseH = 844;
    const scaleX = width / baseW; const scaleY = height / baseH;
    const uiScale = Math.min(scaleX, scaleY, 1.8);
    layoutRef.current = { uiScale, isPortrait: height >= width };

    if (!lastFrameTimeRef.current) lastFrameTimeRef.current = time;
    const dt = Math.min(time - lastFrameTimeRef.current, 50);
    lastFrameTimeRef.current = time;

    const isPaused = isPausedRef.current;
    const effectiveDt = isPaused ? 0 : dt;
    if (isPaused) lastSpawnTimeRef.current += dt;

    ctx.clearRect(0, 0, width, height);
    ctx.save();

    if (shakeIntensityRef.current > 0) {
      const dx = (Math.random() - 0.5) * shakeIntensityRef.current;
      const dy = (Math.random() - 0.5) * shakeIntensityRef.current;
      ctx.translate(dx, dy);
      shakeIntensityRef.current *= 0.85;
      if (shakeIntensityRef.current < 0.5) shakeIntensityRef.current = 0;
    }

    const activeData = currentSentenceRef.current || (hoveringId ? examplesById[hoveringId] : null);
    if (activeData) {
      ctx.save();
      const pulse = (Math.sin(time * 0.004) + 1) / 2;
      const alpha = 0.4 + pulse * 0.2;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.shadowBlur = 15; ctx.shadowColor = "rgba(50, 180, 255, 0.9)";
      const cx = width / 2; const cy = height * 0.65;
      ctx.font = `bold ${28 * uiScale}px "Courier New", monospace`;
      ctx.fillStyle = `rgba(220, 245, 255, ${alpha + 0.2})`;
      const deLines = getLines(ctx, activeData.de || "Loading...", width * 0.85);
      deLines.forEach((line, i) => {
        const jitter = Math.random() > 0.98 ? (Math.random() - 0.5) * 4 : 0;
        ctx.fillText(line, cx + jitter, cy + (i * 35 * uiScale));
      });
      if (activeData.cn) {
        const cnOffset = deLines.length * 35 * uiScale + 15;
        ctx.font = `normal ${18 * uiScale}px "Microsoft YaHei", sans-serif`;
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        const cnLines = getLines(ctx, activeData.cn, width * 0.85);
        cnLines.forEach((line, i) => {
          ctx.fillText(line, cx, cy + cnOffset + (i * 28 * uiScale));
        });
      }
      ctx.restore();
    }

    const adjustedSpawnRate = settingsRef.current.spawnRate / Math.max(0.1, settingsRef.current.speed);
    if (!isPaused && (lastSpawnTimeRef.current === 0 || time - lastSpawnTimeRef.current > adjustedSpawnRate)) {
      spawnFragment(width, height);
      lastSpawnTimeRef.current = time;
    }

    if (comboRef.current >= 2) {
      ctx.save();
      const combo = comboRef.current;
      const cx = width * 0.5; const cy = height * 0.20;
      const pulse = 1 + Math.sin(Date.now() * 0.0025) * 0.02;
      const wave = Math.sin(Date.now() * 0.0015) * 8;
      ctx.translate(cx, cy + wave);
      ctx.scale(pulse, pulse);
      ctx.rotate(-0.10);
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const bgGrad = ctx.createRadialGradient(0, 0, 20, 0, 0, 180);
      bgGrad.addColorStop(0, "rgba(200, 205, 210, 0.10)");
      bgGrad.addColorStop(1, "rgba(200, 205, 210, 0.00)");
      ctx.fillStyle = bgGrad;
      ctx.beginPath(); ctx.ellipse(0, 0, 210, 110, 0.25, 0, Math.PI * 2); ctx.fill();
      const fontSize = 56;
      ctx.font = `600 ${fontSize}px "Microsoft YaHei UI"`;
      ctx.fillStyle = "rgba(235, 238, 240, 0.38)";
      ctx.fillText(`Combo ${combo}`, 0, 0);
      ctx.font = "500 22px 'Microsoft YaHei UI'";
      ctx.fillStyle = "rgba(235, 238, 240, 0.30)";
      ctx.fillText("Speed Up!", 0, 40);
      ctx.restore();
    }

    fragmentsRef.current.forEach(f => {
      const speedFactor = settingsRef.current.speed * adaptiveSpeedRef.current;
      f.update(effectiveDt, width, height, speedFactor);
      f.draw(ctx);
      if (f.markedForDeletion) {
        if (f.isMatched) {
          if (comboRef.current >= 10) soundManager.playComboImpact();
          else soundManager.playBump();
          for (let i = 0; i < 48; i++) particlesRef.current.push(new Particle(f.x, f.y, f.theme.main));
        } else {
          // Miss Logic
          const stats = sessionStatsRef.current.get(f.wordId.id) || { spawns: 0, misses: 0 };
          stats.misses += 1;
          sessionStatsRef.current.set(f.wordId.id, stats);
          addToPriorityQueue(f.wordId.id);
          gameDeckRef.current.push(f.wordId);

          // V2 SRS Logic: 高压环境判定 (High Pressure Logic)
          const currentSpeed = settingsRef.current.speed * adaptiveSpeedRef.current;
          const currentDensity = fragmentsRef.current.length;
          const isExtremeSpeed = currentSpeed > 12;
          const isHighPressure = currentSpeed > 8 && currentDensity > 5;

          if (isExtremeSpeed) {
            // 极速豁免
          } else {
            setGlobalWordDb(prev => prev.map(w => {
              if (w.id === f.wordId.id) {
                const updated = processWordResult(w, { type: 'miss', isHighPressure });
                syncWord(updated);
                return updated;
              }
              return w;
            }));
          }
        }
      }
    });

    if (!isPaused) {
      // ... 物理碰撞逻辑 (原封不动) ...
      for (let i = 0; i < fragmentsRef.current.length; i++) {
        for (let j = i + 1; j < fragmentsRef.current.length; j++) {
          const a = fragmentsRef.current[i];
          const b = fragmentsRef.current[j];
          if (a.isMatched || b.isMatched || a.markedForDeletion || b.markedForDeletion) continue;
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let dist = Math.hypot(dx, dy);
          if (dist === 0) { dx = 0.0001; dy = 0; dist = 0.0001; }
          const nx = dx / dist;
          const ny = dy / dist;
          const rxA = a.width * 0.5;
          const ryA = a.height * 0.5;
          const rxB = b.width * 0.5;
          const ryB = b.height * 0.5;
          const denomA = (nx * nx) / (rxA * rxA) + (ny * ny) / (ryA * ryA);
          const denomB = (nx * nx) / (rxB * rxB) + (ny * ny) / (ryB * ryB);
          if (denomA <= 0 || denomB <= 0) continue;
          let effRadiusA = 1 / Math.sqrt(denomA);
          let effRadiusB = 1 / Math.sqrt(denomB);
          const enlargeFactor = 1.12;
          effRadiusA *= enlargeFactor;
          effRadiusB *= enlargeFactor;
          const minDist = effRadiusA + effRadiusB;
          if (dist >= minDist) continue;
          const overlap = minDist - dist;
          const pushX = nx * overlap * 0.5;
          const pushY = ny * overlap * 0.5;
          a.x -= pushX; a.y -= pushY;
          b.x += pushX; b.y += pushY;
          const dvx = b.vx - a.vx;
          const dvy = b.vy - a.vy;
          const velAlongNormal = dvx * nx + dvy * ny;
          if (velAlongNormal > 0) continue;
          const restitution = 0.9;
          let jVal = -(1 + restitution) * velAlongNormal;
          jVal /= 2;
          const impulseX = jVal * nx;
          const impulseY = jVal * ny;
          a.vx -= impulseX; a.vy -= impulseY;
          b.vx += impulseX; b.vy += impulseY;
          const jitter = 0.02;
          a.vx += (Math.random() - 0.5) * jitter; a.vy += (Math.random() - 0.5) * jitter;
          b.vx += (Math.random() - 0.5) * jitter; b.vy += (Math.random() - 0.5) * jitter;
        }
      }
    }

    particlesRef.current.forEach(p => { p.update(effectiveDt); p.draw(ctx); });
    if (particlesRef.current.length > 50) particlesRef.current.splice(0, particlesRef.current.length - 50);
    fragmentsRef.current = fragmentsRef.current.filter(f => !f.markedForDeletion);
    particlesRef.current = particlesRef.current.filter(p => !p.markedForDeletion);

    if (selectedFragmentRef.current) {
      if (selectedFragmentRef.current.markedForDeletion) {
        selectedFragmentRef.current = null;
      } else {
        const s = selectedFragmentRef.current;
        ctx.beginPath(); ctx.moveTo(s.x, s.y);
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.setLineDash([8, 8]); ctx.lineWidth = 2;
        ctx.arc(s.x, s.y, s.width * 0.6, 0, Math.PI * 2); ctx.stroke();
      }
    }
    ctx.restore();

    if (livesRef.current <= 0) {
      gameStatusRef.current = 'gameover';
      setGameState('gameover');
      soundManager.playGameOver();
      saveUserProfile(scoreRef.current);
      clearGameSession();
      return;
    }
    if (gameDeckRef.current.length === 0 && fragmentsRef.current.length === 0) {
      setTimeout(() => {
        if (gameStatusRef.current === 'playing') {
          gameStatusRef.current = 'win';
          setGameState('win');
          soundManager.playVictory();
          saveUserProfile(scoreRef.current);
          clearGameSession();
        }
      }, 500);
      return;
    }
    requestRef.current = requestAnimationFrame(update);
  }, [hoveringId, examplesById]);

  // ==========================================
  // ⚠️ V1 恢复：handleMatchSuccess (TTS 逻辑完全恢复) + V2 SRS 融合
  // ==========================================
  const handleMatchSuccess = async (wordData, spawnTime) => {
    soundManager.playMatch();
    comboRef.current += 1;
    if (comboRef.current > maxComboRef.current) maxComboRef.current = comboRef.current;
    adaptiveSpeedRef.current = Math.min(5.0, 1.0 + comboRef.current * 0.05);

    const combo = comboRef.current;
    const comboBonus = Math.floor(combo * 1.2);
    const basePoints = 100 + comboBonus;

    // --- V1 TTS Logic (恢复原样) ---
    const { ttsMode, speakDe, speakCn } = settingsRef.current;

    if (ttsMode === 'sentence') {
      ttsTokenRef.current++;
      const myToken = ttsTokenRef.current;
      const example = await exampleServiceRef.current.getExample(wordData.de, wordData.cn, wordData.id);
      if (!example) return;

      const speakSentence = (text, lang, rate) => new Promise(resolve => {
        if (myToken !== ttsTokenRef.current || !aiService.synth) return resolve();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang; u.rate = rate;
        u.onend = resolve; u.onerror = resolve;
        aiService.synth.cancel(); aiService.synth.speak(u);
      });

      (async () => {
        if (myToken !== ttsTokenRef.current) return;
        currentSentenceRef.current = example;
        await speakSentence(example.de, 'de-DE', 0.9);
        if (myToken === ttsTokenRef.current) {
          setTimeout(() => { if (myToken === ttsTokenRef.current) currentSentenceRef.current = null; }, 8000);
        }
      })();
    }

    if (ttsMode === "word") {
      ttsTokenRef.current++;
      const myToken = ttsTokenRef.current;
      // 将性别代码转换为完整冠词用于TTS
      const genderToArticle = (g) => {
        const x = String(g || '').toLowerCase();
        if (x === 'm') return 'der';
        if (x === 'f') return 'die';
        if (x === 'n') return 'das';
        if (x === 'der' || x === 'die' || x === 'das') return x;
        return '';
      };
      const article = genderToArticle(wordData.gender);
      const fullDe = article ? `${article} ${wordData.de}` : wordData.de;
      const speakOnce = (text, lang, rate) => new Promise(res => {
        if (myToken !== ttsTokenRef.current) return res();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang; u.rate = rate;
        u.onend = () => res(); u.onerror = () => res();
        aiService.synth.cancel(); aiService.synth.speak(u);
      });
      (async () => {
        if (speakDe) { await speakOnce(fullDe, "de-DE", 0.9); if (myToken !== ttsTokenRef.current) return; }
        if (speakCn) { await speakOnce(wordData.cn, "zh-CN", 1.0); if (myToken !== ttsTokenRef.current) return; }
      })();
    }

    // V2 SRS Logic (高压判定 & 每日任务)
    const reactionTime = Date.now() - spawnTime;
    if (wordData.state === 'new') dailyStatsRef.current.newCount++;
    else dailyStatsRef.current.reviewCount++;

    const { dailyNewLimit, dailyReviewLimit } = settingsRef.current;
    const todayGoal = dailyNewLimit + dailyReviewLimit; // 简单修正：V1 其实没有 limit 设置，但 V2 有，这里保留逻辑
    const currentProgress = dailyStatsRef.current.newCount + dailyStatsRef.current.reviewCount;

    if (!dailyStatsRef.current.isCheckedIn && currentProgress >= todayGoal) {
      dailyStatsRef.current.isCheckedIn = true;
      isPausedRef.current = true;
      setShowCheckInModal(true);
      soundManager.playVictory();
      saveUserProfile(0, true); // Save check-in status
    } else if (dailyStatsRef.current.isCheckedIn) {
      let bonusGain = 1;
      const extraCount = currentProgress - todayGoal;
      if (extraCount === 5) { bonusGain += 10; setMessage("超额完成 5 词！获得额外奖励！"); soundManager.playVictory(); }
      else if (extraCount === 15) { bonusGain += 30; setMessage("超额完成 15 词！奖励翻倍！"); soundManager.playVictory(); }
      else if (extraCount === 30) { bonusGain += 100; setMessage("超额完成 30 词！太强了！"); soundManager.playVictory(); }
      dailyStatsRef.current.bonusXP = (dailyStatsRef.current.bonusXP || 0) + bonusGain;
      saveUserProfile(bonusGain);
    }
    localStorage.setItem('space_vocab_daily_stats', JSON.stringify(dailyStatsRef.current));

    const stats = sessionStatsRef.current.get(wordData.id) || { spawns: 1, misses: 0 };

    // V2 Logic: High Pressure Bonus
    const currentSpeed = settingsRef.current.speed * adaptiveSpeedRef.current;
    const currentDensity = fragmentsRef.current.length;
    const isHighPressure = currentSpeed > 8 && currentDensity > 5;

    setGlobalWordDb(prev => prev.map(w => {
      if (w.id !== wordData.id) return w;
      const updated = processWordResult(w, {
        reactionTime,
        isHighPressure,
        exposure: stats.spawns,
        type: 'match'
      });
      syncWord(updated).then(synced => {
        if (synced && synced.id !== updated.id) {
          setGlobalWordDb(prev => prev.map(item => item.id === updated.id ? synced : item));
        }
      });
      return updated;
    }));

    const currentScore = scoreRef.current;
    let tierBonus = 0;
    if (currentScore >= 6000) tierBonus = 0.15;
    else if (currentScore >= 3000) tierBonus = 0.10;
    else if (currentScore >= 1000) tierBonus = 0.05;

    const s = settingsRef.current;
    const speedFactor = Math.max(0, (s.speed - 1) * 0.10);
    const densityFactor = (s.maxOnScreen - 3) * 0.03;
    const spawnFactor = (2200 - s.spawnRate) / 15000;
    const sliderBonus = Math.max(0, speedFactor + densityFactor + spawnFactor);
    const totalMultiplier = 1 + tierBonus + sliderBonus;
    const finalGain = Math.floor(basePoints * totalMultiplier);

    scoreRef.current += finalGain;
    setUiScore(scoreRef.current);
    setUiDeckCount(gameDeckRef.current.length);
  };

  const handleInteraction = (clientX, clientY) => {
    if (gameStatusRef.current !== 'playing' || isPausedRef.current) return;
    soundManager.unlock();
    const canvas = canvasRef.current; if (!canvas) return;
    const x = clientX; const y = clientY;
    let clickedFrag = null; const TOUCH_SLOP = 15;
    for (let i = fragmentsRef.current.length - 1; i >= 0; i--) {
      const f = fragmentsRef.current[i];
      // Skip fragments that are dying or matched
      if (f.isMatched || f.markedForDeletion) continue;

      const halfW = f.width / 2 + TOUCH_SLOP; const halfH = f.height / 2 + TOUCH_SLOP;
      if (x > f.x - halfW && x < f.x + halfW && y > f.y - halfH && y < f.y + halfH) { clickedFrag = f; break; }
    }
    if (!clickedFrag) {
      if (selectedFragmentRef.current) { selectedFragmentRef.current.isSelected = false; selectedFragmentRef.current = null; }
      return;
    }
    soundManager.playClick();
    if (!selectedFragmentRef.current) {
      selectedFragmentRef.current = clickedFrag; clickedFrag.isSelected = true;
    } else {
      const first = selectedFragmentRef.current; const second = clickedFrag;
      if (first === second) return;
      if (first.pairId === second.pairId) {
        handleMatchSuccess(first.wordId, Math.min(first.spawnTime, second.spawnTime));
        first.isMatched = true; second.isMatched = true;
        first.targetX = (first.x + second.x) / 2; first.targetY = (first.y + second.y) / 2;
        second.targetX = first.targetX; second.targetY = first.targetY;
      } else {
        soundManager.playError();
        livesRef.current -= 1; setUiLives(livesRef.current);
        comboRef.current = 0; adaptiveSpeedRef.current = 1.0; shakeIntensityRef.current = 12;
        for (let i = 0; i < 10; i++) particlesRef.current.push(new Particle(first.x, first.y, '#ef4444'));
        for (let i = 0; i < 10; i++) particlesRef.current.push(new Particle(second.x, second.y, '#ef4444'));
        setMessage('配对错误!'); setTimeout(() => setMessage(null), 1000);
        setGlobalWordDb(prev => prev.map(w => {
          if (w.id === first.wordId.id || w.id === second.wordId.id) {
            const updated = processWordResult(w, { type: 'error' });
            syncWord(updated).then(synced => {
              if (synced && synced.id !== updated.id) {
                setGlobalWordDb(prev => prev.map(item => item.id === updated.id ? synced : item));
              }
            });
            return updated;
          }
          return w;
        }));
        addToPriorityQueue(first.wordId.id); addToPriorityQueue(second.wordId.id);
        first.markedForDeletion = true; second.markedForDeletion = true;
      }
      first.isSelected = false; second.isSelected = false; selectedFragmentRef.current = null;
    }
  };

  const parseInput = () => {
    const result = processImportInput(customInput, globalWordDb);
    if (result.message) { setMessage(result.message); setTimeout(() => setMessage(null), result.success ? 3000 : 2000); }
    if (result.success) {
      setGlobalWordDb(result.updatedDb);
      if (result.newWords && result.newWords.length > 0) {
        syncWordsBatch(result.newWords).then(syncedList => {
          if (syncedList && syncedList.length > 0) {
            setGlobalWordDb(prev => {
              // Update existing words with synced versions (matching by content key)
              // Because IDs might have changed from local ID to UUID
              const map = new Map(prev.map(w => [`${String(w.de).toLowerCase()}|${String(w.gender).toLowerCase()}`, w]));
              syncedList.forEach(s => {
                const k = `${String(s.de).toLowerCase()}|${String(s.gender).toLowerCase()}`;
                if (map.has(k)) {
                   map.set(k, { ...map.get(k), ...s });
                }
              });
              return Array.from(map.values()).sort((a, b) => a.de.localeCompare(b.de, 'de', { sensitivity: 'base' }));
            });
          }
        });
      }
      setCustomInput('');

      // 检查是否需要刷新今日计划 (当添加了新词且今日额度未满时)
      const stats = dailyStatsRef.current;
      const settings = settingsRef.current;
      if (stats.newCount < settings.dailyNewLimit) {
        // 清除缓存的计划，强制 TodayView 下次渲染时重新生成
        localStorage.removeItem('star_vocab_daily_plan');
      }
    }
  };

  const _startGameLogic = useCallback(() => {
    try { soundManager.unlock(); } catch (e) { console.warn("Audio unlock failed:", e); }
    aiService.warmUp();
    isPausedRef.current = false;
    setShowSettingsOverlay(false);
    const now = Date.now();
    const todayStr = new Date().toDateString();
    if (dailyStatsRef.current.date !== todayStr) {
      dailyStatsRef.current = { date: todayStr, newCount: 0, reviewCount: 0, isCheckedIn: false, bonusXP: 0 };
      localStorage.setItem('space_vocab_daily_stats', JSON.stringify(dailyStatsRef.current));
    }
    let { deck, mode } = DeckGenerator.getOrGeneratePlan(globalWordDb, settingsRef.current);

    // Sync generated plan to cloud immediately
    const currentPlan = { date: todayStr, mode, deck };
    updateCloudProfile({ dailyPlan: currentPlan });

    // Only show Bonus Mode message if we are actually in bonus mode (cleared all due words)
    if (mode === 'bonus' && deck.length > 0) { setMessage("进入额外复习模式！"); setTimeout(() => setMessage(null), 2500); }
    if (deck.length < MIN_DECK_SIZE && globalWordDb.length > 0) {
      const currentIds = new Set(deck.map(w => w.id));
      const fillerCandidates = globalWordDb.filter(w => !currentIds.has(w.id)).sort(() => Math.random() - 0.5);
      const needed = MIN_DECK_SIZE - deck.length;
      if (fillerCandidates.length > 0) deck = [...deck, ...fillerCandidates.slice(0, needed)];
    }
    if (deck.length === 0) { setMessage('没有可学习的单词'); setTimeout(() => setMessage(null), 2000); return; }
    deck = deck.sort(() => Math.random() - 0.5);
    gameDeckRef.current = deck;
    scoreRef.current = 0; livesRef.current = 5;
    fragmentsRef.current = []; particlesRef.current = []; selectedFragmentRef.current = null;
    lastSpawnTimeRef.current = 0; lastFrameTimeRef.current = 0;
    priorityQueueRef.current = []; sessionStatsRef.current.clear();
    comboRef.current = 0; maxComboRef.current = 0;
    adaptiveSpeedRef.current = 1.0; shakeIntensityRef.current = 0;
    setUiScore(0); setUiLives(5); setUiDeckCount(deck.length);
    gameStatusRef.current = 'playing'; setGameState('playing');
    aiService.stopAll();
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    requestRef.current = requestAnimationFrame(update);
  }, [globalWordDb, updateCloudProfile, update, settingsRef]);

  const startGame = () => {
    // 检查并自动恢复原设置（如果review已清理完）
    const restored = checkAndRestoreSettings(globalWordDb, settingsRef.current, updateSettings);
    if (restored) {
      setMessage('Review已清理完成，已恢复原设置！');
      setTimeout(() => setMessage(null), 3000);
    }

    // 检测review积压
    const backlogInfo = detectReviewBacklog(globalWordDb, settingsRef.current);
    if (backlogInfo.needsAdjustment) {
      // 检查是否已经在清理模式中
      try {
        const existingMode = JSON.parse(localStorage.getItem('space_vocab_temp_clearance_settings'));
        if (!existingMode || !existingMode.active) {
          // 显示确认modal
          setClearanceInfo(backlogInfo);
          setShowClearanceModal(true);
          return; // 暂停游戏启动，等待用户确认
        }
      } catch { }
    }

    _startGameLogic();
  };

  const handleDeleteWord = (id) => {
    setConfirmMessage('确定要从词库中删除此单词吗？');
    setConfirmAction(() => () => {
      setGlobalWordDb(prev => prev.filter(w => w.id !== id));
      deleteCloudWord(id);
      setShowConfirmModal(false);
      setMessage('单词已删除。');
      setTimeout(() => setMessage(null), 1500);
    });
    setShowConfirmModal(true);
  }

  const handleResetWord = (id) => {
    setGlobalWordDb(prev => prev.map(w => {
      if (w.id !== id) return w;
      const resetW = { ...w, familiarity: 0, state: 'new', step: 0, interval: 0, easeFactor: 2.5 };
      syncWord(resetW);
      return resetW;
    }));
    setMessage('单词进度已重置'); setTimeout(() => setMessage(null), 1000);
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };
  const clearSelection = () => { setSelectedIds(new Set()); setSelectionMode(false); };

  const handleBulkDeleteRequest = () => {
    if (selectedIds.size === 0) return;
    setConfirmMessage(`确定删除选中的 ${selectedIds.size} 个单词吗？此操作不可恢复。`);
    setConfirmAction(() => () => {
      setGlobalWordDb(prev => prev.filter(w => !selectedIds.has(w.id)));
      deleteCloudWordsBatch(Array.from(selectedIds));
      clearSelection(); setShowConfirmModal(false);
      setMessage('已批量删除。'); setTimeout(() => setMessage(null), 1500);
    });
    setShowConfirmModal(true);
  };

  // ==================== UI 部分 (V1 完全恢复) ====================
  return (
    <div ref={containerRef} className={`w-full h-[100dvh] fixed inset-0 font-sans overflow-hidden select-none text-slate-800 touch-none relative ${wallpaper ? 'bg-slate-900' : 'bg-slate-100'}`}>
      <div className="absolute inset-0 z-[5] pointer-events-none" style={{ backgroundImage: `url('${wallpaper}')`, backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" }}></div>
      <div className="absolute inset-0 z-[5] pointer-events-none transition-colors duration-1000" style={{ backgroundColor: theme.overlay, opacity: 0.45 }}></div>
      <div className="absolute inset-0 z-[6] bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 pointer-events-none"></div>
      <div className="absolute inset-0 z-[7] pointer-events-none bg-gradient-to-b from-white/25 via-white/5 to-white/25"></div>

      <canvas ref={canvasRef} className={`absolute inset-0 block w-full h-full cursor-crosshair ${gameState === 'playing' ? 'z-[15]' : 'z-[15] hidden'}`} onClick={e => handleInteraction(e.clientX, e.clientY)} onTouchStart={e => { const touch = e.touches[0]; handleInteraction(touch.clientX, touch.clientY); }} />

      {gameState === 'playing' && (
        <>
          <div className="absolute top-0 left-0 w-full pt-safe-top px-4 flex justify-between items-start z-20 pointer-events-none">
            <div className="mt-4 glass-panel rounded-full px-4 py-2 flex items-center gap-3 text-white pointer-events-auto">
              <div className="flex items-center gap-1"><Sparkles className="w-4 h-4 text-yellow-400" /><span className="font-mono font-bold">{uiScore}</span></div>
              <div className="w-px h-4 bg-white/20"></div>
              <div className="flex gap-0.5">{[...Array(5)].map((_, i) => (<Heart key={i} className={`w-4 h-4 ${i < uiLives ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} />))}</div>
            </div>
            <div className="mt-4 flex gap-2 pointer-events-auto">
              <button onClick={() => { const nextState = !showSettingsOverlay; setShowSettingsOverlay(nextState); isPausedRef.current = nextState; }} className={`p-2 rounded-full glass-button ${showSettingsOverlay ? 'text-white' : 'text-white'}`} style={showSettingsOverlay ? { backgroundColor: theme.primary } : {}}><Settings className="w-5 h-5" /></button>
              <button onClick={() => { isPausedRef.current = true; setShowExitModal(true); }} className="p-2 bg-red-500/80 text-white rounded-full backdrop-blur-md active:bg-red-600 border border-red-400/30 hover:bg-red-500 transition-colors"><LogOut className="w-5 h-5" /></button>
            </div>
          </div>

          {showSettingsOverlay && (
            <div className="absolute top-20 right-4 w-64 glass-panel text-white p-5 rounded-2xl z-30 animate-modal-in pointer-events-auto">
              <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-2">
                <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: theme.primary }}><Settings className="w-4 h-4" />系统设置</h3>
                <button onClick={() => { setShowSettingsOverlay(false); isPausedRef.current = false; }}><X className="w-4 h-4 text-gray-400 hover:text-white" /></button>
              </div>
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="text-xs font-bold text-gray-500 uppercase">游戏难度</div>
                  <div>
                    <div className="flex justify-between text-xs mb-1.5 text-gray-300"><span>难度</span><span className="font-mono" style={{ color: theme.primary }}>{(settingsState.difficulty ?? 5)}</span></div>
                    <input type="range" min="1" max="10" step="1" value={(settingsState.difficulty ?? 5)} onChange={e => updateSettings({ difficulty: parseInt(e.target.value) })} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer" style={{ accentColor: theme.primary }} />
                    <div className="mt-2 text-[10px] text-gray-400">速度: {Math.max(0.1, settingsState.speed).toFixed(1)}x · 同屏: {settingsState.maxOnScreen} · 刷新: {settingsState.spawnRate}ms</div>
                  </div>
                </div>
                <div className="space-y-3 border-t border-white/10 pt-4">
                  <div className="text-xs font-bold text-gray-500 uppercase">语音合成 (TTS)</div>
                  <div className="flex flex-col gap-2">
                    <div className="flex glass-panel rounded-lg p-1 gap-1">
                      {['none', 'word', 'sentence'].map(mode => (
                        <button key={mode} onClick={() => {
                          if (mode === 'sentence') updateSettings({ ttsMode: mode, speakDe: true, speakCn: settingsState.speakCn });
                          else if (mode === 'none') updateSettings({ ttsMode: mode, speakDe: false, speakCn: false });
                          else updateSettings({ ttsMode: mode });
                        }} className={`flex-1 py-1.5 text-[10px] rounded-md transition-all font-bold ${settingsState.ttsMode === mode ? 'text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'}`} style={settingsState.ttsMode === mode ? { backgroundColor: theme.primary } : {}}>{mode === 'none' ? '静音' : mode === 'word' ? '单词' : '例句'}</button>
                      ))}
                    </div>
                    {settingsState.ttsMode !== 'none' && (
                      <div className="flex gap-2 mt-1">
                        <button onClick={() => updateSettings({ speakDe: !settingsState.speakDe })} className={`flex-1 py-1.5 text-[10px] rounded-md transition-all border ${settingsState.speakDe ? '' : 'glass-button border-transparent text-gray-500'}`} style={settingsState.speakDe ? { backgroundColor: `${theme.primary}33`, borderColor: `${theme.primary}80`, color: theme.primary } : {}}>德语发音</button>
                        {settingsState.ttsMode === 'word' && (
                          <button onClick={() => updateSettings({ speakCn: !settingsState.speakCn })} className={`flex-1 py-1.5 text-[10px] rounded-md transition-all border ${settingsState.speakCn ? '' : 'glass-button border-transparent text-gray-500'}`} style={settingsState.speakCn ? { backgroundColor: `${theme.primary}33`, borderColor: `${theme.primary}80`, color: theme.primary } : {}}>中文发音</button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {isAiLoading && (<div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-black/60 text-white px-4 py-2 rounded-full text-xs flex items-center gap-2 backdrop-blur-md border border-white/10 z-50"><Zap className="w-3 h-3 animate-pulse text-yellow-400" />AI 生成中...</div>)}
      {message && (<div className="absolute top-24 left-1/2 transform -translate-x-1/2 bg-white text-slate-900 px-6 py-3 rounded-full shadow-2xl font-bold z-50 border text-sm animate-bounce" style={{ borderColor: `${theme.primary}40` }}>{message}</div>)}
      <style>{`@keyframes modalIn { from { opacity: 0; transform: translateY(-8px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } } .animate-modal-in { animation: modalIn 0.25s ease-out forwards; } @keyframes modalPop { 0% { opacity: 0; transform: scale(0.9) translateY(8px); } 60% { opacity: 1; transform: scale(1.02) translateY(0); } 100% { transform: scale(1); } } .animate-modal-pop { animation: modalPop 0.28s ease-out forwards; }`}</style>

      <CustomModal isOpen={showConfirmModal} title="操作确认" message={confirmMessage} onConfirm={confirmAction} onCancel={customCancelAction || (() => setShowConfirmModal(false))} confirmText={customConfirmText} cancelText={customCancelText} />

      {/* Review积压清理确认Modal */}
      {showClearanceModal && clearanceInfo && (
        <ReviewClearanceModal
          backlogInfo={clearanceInfo}
          onConfirm={() => {
            activateClearanceMode(clearanceInfo);
            setShowClearanceModal(false);
            setClearanceInfo(null);
            setMessage('已启用智能清理模式！每日目标已临时调整');
            setTimeout(() => setMessage(null), 3000);
            // 继续启动游戏
            _startGameLogic();
          }}
          onCancel={() => {
            setShowClearanceModal(false);
            setClearanceInfo(null);
            // 继续正常启动游戏
            _startGameLogic();
          }}
        />
      )}

      {showExitModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl text-center transform scale-100 animate-modal-pop">
            <h2 className="text-xl font-bold text-slate-800 mb-4">退出游戏</h2>
            <p className="text-slate-500 mb-6 text-sm">是否保存当前进度？<br /><span className="text-xs text-slate-400">保存后可于今日内继续挑战 (24:00 失效)</span></p>
            <div className="space-y-3">
              <button onClick={() => { saveGameSession(); setShowExitModal(false); setGameState('dashboard'); }} className="w-full py-3 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2" style={{ backgroundColor: theme.primary }}><Save className="w-4 h-4" />退出并存档</button>
              <button onClick={() => { clearGameSession(); setShowExitModal(false); setGameState('dashboard'); }} className="w-full py-3 rounded-xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors">直接退出</button>
              <button onClick={() => { setShowExitModal(false); isPausedRef.current = false; }} className="w-full py-2 text-xs text-slate-400 hover:text-slate-600">取消</button>
            </div>
          </div>
        </div>
      )}

      <CalendarModal isOpen={showCheckInModal} onClose={() => { setShowCheckInModal(false); isPausedRef.current = false; }} todayCompleted={true} checkInDates={userProfileRef.current?.checkInDates || []} />

      {showSaveModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[999] flex items-end justify-center sm:items-center p-4">
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-4">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Save className="w-6 h-6" style={{ color: theme.primary }} />手动存档模式</h2>
              <button onClick={() => setShowSaveModal(false)}><X className="w-6 h-6 text-gray-400 hover:text-gray-600" /></button>
            </div>
            <div className="overflow-y-auto flex-1 space-y-6 pr-1">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm text-slate-600 leading-relaxed">
                <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2"><Info className="w-4 h-4" style={{ color: theme.primary }} />使用说明</h3>
                <p className="mb-2">欢迎使用 Star Vocab Game 的手动存档功能...</p>
              </div>
              <div className="p-4 rounded-xl border" style={{ backgroundColor: `${theme.primary}10`, borderColor: `${theme.primary}33` }}>
                <div className="text-xs font-bold mb-2 uppercase flex justify-between" style={{ color: theme.primary }}><span>导出进度</span></div>
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2">
                    <button onClick={handleExportSave} className="flex-1 text-white px-4 py-2.5 rounded-lg text-sm font-bold shadow-md" style={{ backgroundColor: theme.primary }}>生成存档码</button>
                    {saveString && (<button onClick={handleCopySave} className="bg-white border px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2" style={{ color: theme.primary, borderColor: `${theme.primary}40` }}><Copy className="w-4 h-4" />复制</button>)}
                  </div>
                  {saveString && (<textarea value={saveString} readOnly onClick={(e) => e.target.select()} className="w-full h-24 p-3 text-[10px] text-gray-600 bg-white rounded-lg border resize-none font-mono" style={{ borderColor: `${theme.primary}40` }} />)}
                </div>
              </div>
              <div className="p-4 rounded-xl border" style={{ backgroundColor: `${theme.primary}10`, borderColor: `${theme.primary}33` }}>
                <div className="text-xs font-bold mb-2 uppercase" style={{ color: theme.primary }}>恢复进度</div>
                <textarea value={importString} onChange={e => setImportString(e.target.value)} placeholder="在此粘贴存档码以恢复..." className="w-full h-24 p-3 text-xs rounded-lg border mb-3 resize-none bg-white" style={{ borderColor: `${theme.primary}40` }} />
                <button onClick={handleImportSave} className="w-full text-white py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 shadow-md" style={{ backgroundColor: theme.primary }}><Upload className="w-4 h-4" />确认恢复</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {(gameState === 'menu' || gameState === 'dashboard') && (
        <Dashboard
          globalWordDb={globalWordDb}
          customInput={customInput}
          setCustomInput={setCustomInput}
          handleBulkAdd={parseInput}
          selectionMode={selectionMode}
          setSelectionMode={setSelectionMode}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
          handleToggleSelect={toggleSelect}
          handleBulkDeleteRequest={handleBulkDeleteRequest}
          clearSelection={clearSelection}
          handleMouseEnterWord={handleMouseEnterWord}
          handleMouseLeaveWord={handleMouseLeaveWord}
          handleTouchStartWord={handleTouchStartWord}
          handleTouchEndWord={handleTouchEndWord}
          hoveringId={hoveringId}
          loadingExampleId={loadingExampleId}
          examplesById={examplesById}
          handleDeleteWord={handleDeleteWord}
          handleResetWord={handleResetWord}
          onStartGame={() => {
            try {
              const saved = JSON.parse(localStorage.getItem('space_vocab_daily_session'));
              const today = new Date().toDateString();
              if (saved && saved.date === today) { showResumeDialog(); } else { startGame(); }
            } catch (e) {
              startGame();
            }
          }}
          showSettingsOverlay={showSettingsOverlay}
          setShowSettingsOverlay={setShowSettingsOverlay}
          isPausedRef={isPausedRef}
          settingsState={settingsState}
          updateSettings={updateSettings}
          handleExportSave={handleExportSave}
          setShowSaveModal={setShowSaveModal}
          handleResetData={handleResetData}
          localCorpusService={localCorpusService}
          dailyStats={dailyStatsRef.current}
          userProfile={userProfileRef.current}
          resetDataSilent={resetDataSilent}
          getXPForLevel={getXPForLevel}
        />
      )}

      {(gameState === 'gameover' || gameState === 'win') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 animate-fade-in bg-black">
          <div className="absolute inset-0 z-0" style={{ backgroundImage: (localStorage.getItem('star-vocab-wallpaper-system') || localStorage.getItem('star-vocab-wallpaper-home')) ? `url(${localStorage.getItem('star-vocab-wallpaper-system') || localStorage.getItem('star-vocab-wallpaper-home')})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }} />
          <div className="absolute inset-0 z-10" style={{ backgroundColor: theme.overlay, opacity: 0.45 }} />
          <div className="relative z-20 w-full max-w-sm overflow-hidden border shadow-2xl backdrop-blur-xl rounded-3xl border-white/10" style={{ backgroundColor: `${theme.secondary}E6` }}>
            <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: theme.primary }} />
            <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-20" style={{ backgroundColor: theme.primary }} />
            <div className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full blur-3xl opacity-10" style={{ backgroundColor: theme.primary }} />
            <div className="flex flex-col items-center p-8 text-center">
              <div className="mb-6 p-4 rounded-full border backdrop-blur-md" style={{ backgroundColor: `${theme.primary}1A`, borderColor: `${theme.primary}33`, color: theme.primary, boxShadow: `0 0 15px ${theme.primary}4D` }}>
                {gameState === 'win' ? <Activity className="w-12 h-12" /> : <AlertCircle className="w-12 h-12" />}
              </div>
              <h2 className="mb-2 text-3xl font-bold text-white">{gameState === 'win' ? '任务完成' : '连接中断'}</h2>
              <p className="mb-8 text-sm text-gray-400">{gameState === 'win' ? '你已成功记忆所有单词！' : '信号丢失，请重新建立连接。'}</p>

              {gameState === 'win' && dailyStatsRef.current.newCount < settingsRef.current.dailyNewLimit && !globalWordDb.some(w => w.state === 'new') && (
                <div className="mb-6 p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 text-yellow-200 text-sm animate-pulse">
                  <div className="flex items-center justify-center gap-2 mb-1 font-bold text-yellow-400">
                    <AlertCircle className="w-4 h-4" />
                    <span>词库告急</span>
                  </div>
                  <p className="opacity-80">剩余新词不足以完成今日目标，<br />请前往词库添加更多单词。</p>
                </div>
              )}

              <div className="flex justify-center w-full mb-8">
                <div className="flex flex-col items-center px-8 py-3 border rounded-2xl bg-slate-800/50 border-white/5">
                  <span className="text-xs font-medium text-white uppercase tracking-wider">本次得分</span>
                  <span className="text-3xl font-black text-white font-mono mt-1">{uiScore}</span>
                </div>
              </div>
              <div className="w-full space-y-3">
                <GlassButton variant="homePrimary" fullWidth onClick={startGame} leadingIcon={RotateCcw}>再次挑战</GlassButton>
                <GlassButton variant="homeSecondary" fullWidth onClick={() => setGameState('dashboard')} leadingIcon={BarChart2}>查看分析</GlassButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from "react";
import SpaceVocabGame from "../features/game/SpaceVocabGame";
import "./App.css";
import LoginForm from "../features/auth/components/LoginForm";
import { ThemeProvider } from "../shared/hooks/useTheme";
import { useAuth } from "../features/auth/contexts/AuthContext";
import { ProfileProvider } from "../shared/contexts/ProfileContext";
import SplashScreen from "../shared/components/SplashScreen";
import { UpdateNotification } from "../shared/components/ui/UpdateNotification";
import { soundManager, hapticTick } from "../shared/services/audio/SoundManager";

export default function App() {
    const { user, loading, isGuest } = useAuth();

    // Lazy initialize state to avoid race condition/flicker
    const [showSplash, setShowSplash] = useState(() => {
        const hasSeen = localStorage.getItem('hasSeenSplash');
        return !hasSeen;
    });

    // Initialize dictionary ONCE on app start
    // Use window object to survive React StrictMode remounts
    useEffect(() => {
        console.log('[App] useEffect triggered - window._dictInitialized:', window._dictInitialized);

        // Skip if already initialized (survives StrictMode remounts)
        if (window._dictInitialized) {
            console.log('[App] Dictionary already initialized, skipping');
            return;
        }

        const init = async () => {
            // Mark as initialized immediately to prevent race conditions
            if (window._dictInitialized) return;
            window._dictInitialized = true;

            try {
                // Initialize dictionary
                const dictModule = await import("../shared/services/dictionary/DictionaryInit");
                console.log('[App] Starting dictionary initialization...');


                const result = await dictModule.initializeDictionary((p, m) => {
                    console.log(`[Dict] ${p}%: ${m}`);
                });

                console.log('[App] Dictionary init complete:', result);

                // Only after init: the upgrade path deletes/recreates the IndexedDB database,
                // so loading the lemmatization index in parallel would race with it.
                import("../utils/lemmatizationService").then(({ lemmatizationService }) => {
                    lemmatizationService.ensureIndexLoaded().catch(e =>
                        console.warn('[App] Background index download warning:', e)
                    );
                });
            } catch (err) {
                console.error('[App] Dictionary initialization failed:', err);
            }
        };

        // Execute immediately
        init();
    }, []);

    // Global tactile feedback: soft tap sound + haptic tick for every button press.
    useEffect(() => {
        const onPointerDown = (e) => {
            const el = e.target && e.target.closest && e.target.closest('button, [role="button"], [role="switch"], a[href]');
            if (!el || el.disabled || el.dataset.silent !== undefined) return;
            soundManager.playTap();
            hapticTick();
        };
        document.addEventListener('pointerdown', onPointerDown, true);
        return () => document.removeEventListener('pointerdown', onPointerDown, true);
    }, []);

    const handleSplashComplete = () => {
        console.log('[App] Splash completed');
        localStorage.setItem('hasSeenSplash', 'true');
        setShowSplash(false);
    };


    // Show splash screen if it's the first visit
    if (showSplash) {
        return <SplashScreen onComplete={handleSplashComplete} />;
    }

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">Loading...</div>;
    }

    return (
        <ThemeProvider>
            <UpdateNotification />
            {!user && !isGuest ? (
                <LoginForm />
            ) : (
                <ProfileProvider>
                    <SpaceVocabGame />
                </ProfileProvider>
            )}
        </ThemeProvider>
    );
}

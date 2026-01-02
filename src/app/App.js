import React, { useState, useEffect } from "react";
import SpaceVocabGame from "../features/game/SpaceVocabGame";
import "./App.css";
import LoginForm from "../features/auth/components/LoginForm";
import { ThemeProvider } from "../shared/hooks/useTheme";
import { useAuth } from "../features/auth/contexts/AuthContext";
import { ProfileProvider } from "../shared/contexts/ProfileContext";
import SplashScreen from "../shared/components/SplashScreen";
import { UpdateNotification } from "../shared/components/ui/UpdateNotification";

export default function App() {
    const { user, loading } = useAuth();

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
                // Load diagnostic tool first (development mode)
                const diagnostic = await import("../shared/services/dictionary/DiagnosticTool");
                diagnostic.exposeToConsole();
                console.log('[App] 词典诊断工具已加载 - 使用 dictDiagnostic.run() 查看状态');

                // Initialize dictionary
                const dictModule = await import("../shared/services/dictionary/DictionaryInit");
                console.log('[App] Starting dictionary initialization...');

                // Start lemmatization index download in background (non-blocking)
                import("../utils/lemmatizationService").then(({ lemmatizationService }) => {
                    console.log('[App] Triggering background index download...');
                    lemmatizationService.ensureIndexLoaded().catch(e => 
                        console.warn('[App] Background index download warning:', e)
                    );
                });

                const result = await dictModule.initializeDictionary((p, m) => {
                    console.log(`[Dict] ${p}%: ${m}`);
                });

                console.log('[App] Dictionary init complete:', result);

                // Run diagnostics after init
                console.log('[App] 运行自动诊断...');
                await diagnostic.runDiagnostics();
            } catch (err) {
                console.error('[App] Dictionary initialization or diagnostic failed:', err);
            }
        };

        // Execute immediately
        init();
    }, []);

    const handleSplashComplete = () => {
        console.log('[App] Splash completed');
        localStorage.setItem('hasSeenSplash', 'true');
        setShowSplash(false);
    };

    console.log('[App] Render - showSplash:', showSplash, 'loading:', loading, 'user:', !!user);

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
            {!user ? (
                <LoginForm />
            ) : (
                <ProfileProvider>
                    <SpaceVocabGame />
                </ProfileProvider>
            )}
        </ThemeProvider>
    );
}

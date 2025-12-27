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

    // Initialize dictionary ONCE on app start (after 2s delay)
    // Use window object to survive React StrictMode remounts
    useEffect(() => {
        console.log('[App] useEffect triggered - window._dictInitialized:', window._dictInitialized);

        // Skip if already initialized (survives StrictMode remounts)
        if (window._dictInitialized) {
            console.log('[App] Dictionary already initialized, skipping');
            return;
        }

        console.log('[App] Scheduling dictionary initialization in 2 seconds...');

        const timer = setTimeout(async () => {
            // Mark as initialized ONLY when timer fires
            if (window._dictInitialized) {
                console.log('[App] Another instance already initialized, aborting');
                return;
            }
            window._dictInitialized = true;

            try {
                console.log('[App] Timer fired, loading diagnostic tool...');
                // Load diagnostic tool first (development mode)
                const diagnostic = await import("../shared/services/dictionary/DiagnosticTool");
                diagnostic.exposeToConsole();
                console.log('[App] 词典诊断工具已加载 - 使用 dictDiagnostic.run() 查看状态');

                // Initialize dictionary
                const dictModule = await import("../shared/services/dictionary/DictionaryInit");
                console.log('[App] Starting dictionary initialization...');

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
        }, 2000); // Delay 2s to let app stabilize

        return () => {
            console.log('[App] useEffect cleanup, clearing timer');
            clearTimeout(timer);
        };
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
                <SpaceVocabGame />
            )}
        </ThemeProvider>
    );
}

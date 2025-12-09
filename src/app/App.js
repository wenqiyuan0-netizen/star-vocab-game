import React, { useState, useEffect } from "react";
import SpaceVocabGame from "../features/game/SpaceVocabGame";
import "./App.css";
import LoginForm from "../features/auth/components/LoginForm";
import { ThemeProvider } from "../shared/hooks/useTheme";
import { useAuth } from "../features/auth/contexts/AuthContext";
import SplashScreen from "../shared/components/SplashScreen";

export default function App() {
    const { user, loading } = useAuth();
    // Lazy initialize state to avoid race condition/flicker
    const [showSplash, setShowSplash] = useState(() => {
        const hasSeen = localStorage.getItem('hasSeenSplash');
        return !hasSeen;
    });

    useEffect(() => {
        // Any other side effects if needed
    }, []);

    const handleSplashComplete = () => {
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
            {!user ? (
                <LoginForm />
            ) : (
                <SpaceVocabGame />
            )}
        </ThemeProvider>
    );
}


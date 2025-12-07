import React from "react";
// import SpaceVocabGame from "../features/game/SpaceVocabGame";
import "./App.css";
// import Login from "../features/auth/components/Login";
import { ThemeProvider } from "../shared/hooks/useTheme";
// import { useAuth } from "../features/auth/contexts/AuthContext";

// 🧪 Hooks综合测试
import TestHooksIntegration from "../__tests__/hooks/TestHooks";

export default function App() {
    // const { user, loading } = useAuth();

    // if (loading) {
    //     return <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">Loading...</div>;
    // }

    return (
        <ThemeProvider>
            <TestHooksIntegration />
            {/* {!user ? (
                <Login />
            ) : (
                <SpaceVocabGame />
            )} */}
        </ThemeProvider>
    );
}

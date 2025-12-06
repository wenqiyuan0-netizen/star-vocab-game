import React from "react";
// import SpaceVocabGame from "./SpaceVocabGame";
import "./App.css";
// import Login from "./components/Auth/Login";
import { ThemeProvider } from "./hooks/useTheme";
// import { useAuth } from "./contexts/AuthContext";

// 🧪 Hooks综合测试
import TestHooksIntegration from "./TestHooks";

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

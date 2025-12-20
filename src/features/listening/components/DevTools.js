import React from 'react';
import { listeningRepo } from '../services/ListeningRepository';

export function DevTools({ onRefresh }) {
    const handleAddBalance = async () => {
        try {
            await listeningRepo.debugAddBalance(300);
            alert('Added 300 coins!');
            onRefresh?.();
        } catch (e) {
            alert('Error: ' + e.message);
        }
    };

    const handleExpire = async () => {
        try {
            await listeningRepo.debugExpireChallenge();
            alert('Challenge expired! (Run check logic to see effect)');
            onRefresh?.(); // This might trigger the checkExpiryRPC in useListeningGameLogic
        } catch (e) {
            alert('Error: ' + e.message);
        }
    };

    const handleReset = async () => {
        try {
            await listeningRepo.debugResetPenalty();
            alert('Penalty reset!');
            onRefresh?.();
        } catch (e) {
            alert('Error: ' + e.message);
        }
    };

    return (
        <div className="fixed bottom-4 right-4 bg-black/80 text-white p-2 rounded-lg text-xs flex flex-col gap-2 z-50 border border-white/20">
            <div className="font-bold border-b border-white/20 pb-1">DEV TOOLS</div>
            <button onClick={handleAddBalance} className="px-2 py-1 bg-blue-600 rounded hover:bg-blue-500">
                +300 Coins
            </button>
            <button onClick={handleExpire} className="px-2 py-1 bg-red-600 rounded hover:bg-red-500">
                Expire Challenge
            </button>
            <button onClick={handleReset} className="px-2 py-1 bg-green-600 rounded hover:bg-green-500">
                Reset Penalty
            </button>
        </div>
    );
}

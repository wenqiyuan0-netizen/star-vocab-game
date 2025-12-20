import React from 'react';
import { Lock, Sparkles, CheckCircle, BookOpen } from 'lucide-react';
import { GlassButton } from '../../../shared/components/ui/GlassButton';

export function UnlockScreen({ session, onGenerate }) {
  const { stats } = session || { stats: { charsEarned: 0, correctCount: 0 } };
  
  return (
    <div className="flex flex-col h-full items-center justify-center p-8 animate-fade-in text-white relative overflow-hidden">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900 to-indigo-900/50"></div>
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+CjxjaXJjbGUgY3g9IjIwIiBjeT0iMjAiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4xKSIvPgo8L3N2Zz4=')] opacity-30"></div>
      
      <div className="relative z-10 max-w-md w-full text-center space-y-10">
        
        {/* Success Icon */}
        <div className="relative inline-block">
          <div className="absolute inset-0 bg-green-500/20 blur-xl rounded-full animate-pulse"></div>
          <div className="relative w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center shadow-2xl border-4 border-green-300/30">
             <CheckCircle className="w-12 h-12 text-white" />
          </div>
        </div>

        {/* Title & Stats */}
        <div className="space-y-4">
          <h2 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-300 to-emerald-200">
            Mission Complete
          </h2>
          <p className="text-slate-300 text-lg">
            You've gathered enough data fragments.
          </p>
          
          <div className="grid grid-cols-2 gap-4 mt-6">
             <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="text-sm text-slate-400 uppercase tracking-wider">Total XP</div>
                <div className="text-2xl font-mono font-bold text-green-400">{stats.charsEarned}</div>
             </div>
             <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="text-sm text-slate-400 uppercase tracking-wider">Words</div>
                <div className="text-2xl font-mono font-bold text-cyan-400">{stats.correctCount}</div>
             </div>
          </div>
        </div>

        {/* Action Card */}
        <div className="bg-indigo-600/20 border border-indigo-400/30 rounded-2xl p-6 backdrop-blur-sm">
          <div className="flex items-center gap-4 mb-4">
             <div className="p-3 bg-indigo-500/20 rounded-lg">
               <BookOpen className="w-6 h-6 text-indigo-300" />
             </div>
             <div className="text-left">
               <h3 className="font-bold text-indigo-100">Unlock Listening Material</h3>
               <p className="text-xs text-indigo-300">Generate a unique story based on your session.</p>
             </div>
          </div>
          
          <GlassButton onClick={onGenerate} className="w-full py-4 text-lg font-bold bg-indigo-500 hover:bg-indigo-400 border-indigo-300/50 shadow-[0_0_20px_rgba(99,102,241,0.4)]">
             <Sparkles className="w-5 h-5 mr-2 inline-block" />
             DECRYPT & UNLOCK
          </GlassButton>
        </div>

      </div>
    </div>
  );
}

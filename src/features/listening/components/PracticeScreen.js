import React, { useState, useEffect } from 'react';
import { Play, Pause, Square, CheckCircle, Award } from 'lucide-react';
import { GlassButton } from '../../../shared/components/ui/GlassButton';

export function PracticeScreen({ material, onRedeem }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [utterance, setUtterance] = useState(null);

  useEffect(() => {
    // Stop audio on unmount
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  const handlePlay = () => {
    if (isPlaying) {
      window.speechSynthesis.pause();
      setIsPlaying(false);
    } else {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        setIsPlaying(true);
      } else {
        const u = new SpeechSynthesisUtterance(material?.content || '');
        u.lang = 'de-DE';
        u.rate = 0.9;
        u.onend = () => setIsPlaying(false);
        setUtterance(u);
        window.speechSynthesis.speak(u);
        setIsPlaying(true);
      }
    }
  };

  const handleStop = () => {
    window.speechSynthesis.cancel();
    setIsPlaying(false);
  };

  return (
    <div className="flex flex-col h-full w-full max-w-4xl mx-auto p-4 md:p-8 animate-fade-in relative">
      
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-8">
        <div>
           <div className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-1">Decrypted Material</div>
           <h2 className="text-2xl md:text-3xl font-bold text-white">{material?.title || 'Unknown Signal'}</h2>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={handleStop}
                className="p-3 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors"
                disabled={!isPlaying}
            >
                <Square className="w-5 h-5 fill-current" />
            </button>
            <button 
                onClick={handlePlay}
                className={`p-4 rounded-full shadow-lg transition-all ${isPlaying ? 'bg-yellow-500 text-black' : 'bg-cyan-500 text-white hover:bg-cyan-400'}`}
            >
                {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-1" />}
            </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
         <div className="bg-white/5 border border-white/10 rounded-2xl p-6 md:p-10 backdrop-blur-sm shadow-xl">
            <p className="text-lg md:text-xl leading-loose text-slate-200 font-serif whitespace-pre-wrap">
                {material?.content || "No content available."}
            </p>
         </div>
      </div>

      {/* Footer Action */}
      <div className="mt-8 pt-6 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
         <div className="text-sm text-slate-400">
            <p>Session Complete. Material archived to library.</p>
         </div>
         <GlassButton onClick={onRedeem} className="w-full md:w-auto px-8 py-3 bg-yellow-500/80 hover:bg-yellow-400 text-black font-bold shadow-[0_0_20px_rgba(234,179,8,0.3)]">
            <Award className="w-5 h-5 mr-2" />
            CLAIM REWARDS & EXIT
         </GlassButton>
      </div>

    </div>
  );
}

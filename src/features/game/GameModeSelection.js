import React, { useEffect, useState } from 'react';
import { Gamepad2, Headphones, Play, Lock, ArrowLeft } from 'lucide-react';
import { useTheme } from '../../shared/hooks/useTheme';
import { GlassButton } from '../../shared/components/ui/GlassButton';
import { featureFlagService } from '../../shared/services/FeatureFlagService';
import { withOpacity } from '../../utils/colorUtils';

export function GameModeSelection({ onSelectMode, onBack }) {
  const theme = useTheme();
  const [listeningEnabled, setListeningEnabled] = useState(false);

  useEffect(() => {
    // Check feature flag
    setListeningEnabled(featureFlagService.isEnabled('enableListeningSpeaking'));
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center animate-fade-in p-4 md:p-6">
      <div className="w-full max-w-4xl flex flex-col max-h-full md:h-auto">
        <div className="text-center mb-4 md:mb-8 flex-shrink-0">
          <h2 className="text-2xl md:text-3xl font-black mb-1 md:mb-2 tracking-tight" style={{ color: theme.text }}>选择游戏模式</h2>
          <p className="font-medium text-sm md:text-base" style={{ color: withOpacity(theme.text, 0.6) }}>Choose Your Challenge</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 overflow-y-auto md:overflow-visible pb-4 custom-scrollbar min-h-0">
          {/* Mode 1: Classic Falling Words */}
          <button
            onClick={() => onSelectMode('falling')}
            className="group relative h-48 md:h-64 rounded-3xl glass-panel p-6 text-left transition-all hover:scale-[1.02] hover:shadow-2xl flex flex-col justify-between overflow-hidden shrink-0"
            style={{ 
              borderColor: withOpacity(theme.primary, 0.3),
              backgroundColor: withOpacity(theme.background || '#000', 0.2) // slightly tinted glass
            }}
          >
             {/* Dynamic Glow Effect on Hover */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
              style={{
                background: `radial-gradient(circle at center, ${withOpacity(theme.primary, 0.15)}, transparent 70%)`
              }}
            />
            
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 shadow-lg glass-panel border-0" 
                   style={{ backgroundColor: withOpacity(theme.primary, 0.9) }}>
                <Gamepad2 className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-1" style={{ color: theme.text }}>单词对对碰</h3>
              <p className="text-xs md:text-sm leading-relaxed font-medium line-clamp-2" style={{ color: withOpacity(theme.text, 0.7) }}>
                反正就是无脑背单词。
              </p>
            </div>

            <div className="relative z-10 flex items-center text-xs md:text-sm font-bold tracking-wider uppercase" style={{ color: theme.primary }}>
              <Play className="w-3 h-3 md:w-4 md:h-4 mr-2 fill-current" />
              立即开始
            </div>
          </button>

          {/* Mode 2: Listening & Speaking */}
          <button
            onClick={() => listeningEnabled && onSelectMode('listening')}
            disabled={!listeningEnabled}
            className={`group relative h-48 md:h-64 rounded-3xl glass-panel p-6 text-left transition-all flex flex-col justify-between overflow-hidden shrink-0 ${
              listeningEnabled 
                ? 'hover:scale-[1.02] hover:shadow-2xl cursor-pointer' 
                : 'opacity-70 cursor-not-allowed grayscale-[0.3]'
            }`}
            style={{ 
              borderColor: listeningEnabled ? withOpacity(theme.secondary, 0.3) : withOpacity(theme.text, 0.1),
              backgroundColor: withOpacity(theme.background || '#000', 0.2)
            }}
          >
             {/* Dynamic Glow Effect on Hover */}
             {listeningEnabled && (
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{
                  background: `radial-gradient(circle at center, ${withOpacity(theme.secondary, 0.15)}, transparent 70%)`
                }}
              />
            )}

            <div className="relative z-10">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 shadow-lg glass-panel border-0" 
                style={{ backgroundColor: listeningEnabled ? withOpacity(theme.secondary, 0.9) : withOpacity(theme.text, 0.1) }}
              >
                {listeningEnabled ? (
                  <Headphones className="w-6 h-6 text-white" />
                ) : (
                  <Lock className="w-6 h-6" style={{ color: withOpacity(theme.text, 0.5) }} />
                )}
              </div>
              <h3 className="text-xl font-bold mb-1" style={{ color: theme.text }}>听说模式</h3>
              <p className="text-xs md:text-sm leading-relaxed font-medium line-clamp-2" style={{ color: withOpacity(theme.text, 0.7) }}>
                {listeningEnabled 
                  ? '制作播客，但跟读。'
                  : '还没肝完，谢谢。'}
              </p>
            </div>

            <div className="relative z-10 flex items-center text-xs md:text-sm font-bold tracking-wider uppercase" 
              style={{ color: listeningEnabled ? theme.secondary : withOpacity(theme.text, 0.5) }}
            >
              {listeningEnabled ? (
                <>
                  <Play className="w-3 h-3 md:w-4 md:h-4 mr-2 fill-current" />
                  立即开始
                </>
              ) : (
                <>
                  <Lock className="w-3 h-3 md:w-4 md:h-4 mr-2" />
                  暂未开放
                </>
              )}
            </div>
          </button>
        </div>

        <div className="mt-4 md:mt-8 text-center flex-shrink-0">
          <button 
            onClick={onBack}
            className="group flex items-center justify-center mx-auto px-6 py-3 rounded-full glass-panel hover:bg-white/10 transition-all"
            style={{ color: withOpacity(theme.text, 0.8) }}
          >
            <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium">返回主页</span>
          </button>
        </div>
      </div>
    </div>
  );
}

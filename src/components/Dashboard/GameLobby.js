import React from 'react';
import { Play, Zap, Trophy, Activity } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

export function GameLobby({ handleStartGame, globalWordDb }) {
  const theme = useTheme();
  const wordCount = globalWordDb.length;
  const canStart = wordCount >= 5; // 假设最少需要5个单词

  return (
    <div className="h-full flex flex-col items-center justify-center space-y-8 animate-fade-in">
      <div className="text-center space-y-2">
        <div 
          className="inline-flex items-center justify-center w-20 h-20 rounded-3xl shadow-2xl mb-4 transition-colors duration-500"
          style={{
             background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})`,
             boxShadow: `0 10px 30px -10px ${theme.primary}`
          }}
        >
          <Zap className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-4xl font-black text-white tracking-tight">Star Vocab</h1>
        <p className="text-lg text-gray-400">太空词汇射击</p>
      </div>

      {/* 模式选择卡片 (目前只有一个，预留未来扩展) */}
      <div className="grid grid-cols-1 gap-4 w-full max-w-md">
        <div className="relative group overflow-hidden rounded-2xl glass-panel transition-all cursor-default" style={{ borderColor: 'transparent' }} onMouseEnter={e => e.currentTarget.style.borderColor = `${theme.primary}80`} onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}>
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: `linear-gradient(to right, ${theme.primary}1A, ${theme.secondary}1A)` }} />
          <div className="p-6 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-white mb-1">经典模式</h3>
              <p className="text-sm text-gray-400">消除掉落的单词碎片</p>
            </div>
            <Activity className="w-6 h-6" style={{ color: theme.primary }} />
          </div>
        </div>
        
        {/* 这里的占位符是为了展示多模式布局的样子 */}
        <div className="relative rounded-2xl glass-panel p-6 flex items-center justify-between opacity-50 grayscale">
          <div>
            <h3 className="text-lg font-bold text-gray-500 mb-1">无尽挑战</h3>
            <p className="text-xs text-gray-600">即将推出</p>
          </div>
          <Trophy className="w-5 h-5 text-gray-600" />
        </div>
      </div>

      {/* 核心操作区 */}
      <div className="w-full max-w-md space-y-4">
        <button
          onClick={handleStartGame}
          disabled={!canStart}
          className={`w-full group relative flex items-center justify-center gap-3 px-8 py-5 rounded-2xl font-bold text-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-xl 
            ${canStart 
              ? 'bg-white text-slate-900' 
              : 'glass-button text-gray-500 cursor-not-allowed'
            }`}
          style={canStart ? {
            boxShadow: `0 10px 30px -10px ${theme.primary}33`
          } : {}}
        >
          {canStart ? (
            <>
              <Play className="w-6 h-6 fill-slate-900" />
              <span>开始游戏</span>
            </>
          ) : (
            <span>需要至少 5 个单词</span>
          )}
        </button>
        
        {!canStart && (
          <p className="text-center text-sm text-red-400 bg-red-900/20 py-2 rounded-lg">
            请先在“词汇本”中添加单词
          </p>
        )}

        <div className="flex justify-center gap-8 text-sm text-gray-500 pt-4">
          <div className="text-center">
            <div className="text-white font-bold text-lg">{wordCount}</div>
            <div>词汇量</div>
          </div>
          <div className="text-center">
            <div className="text-white font-bold text-lg">Lv.1</div>
            <div>等级</div>
          </div>
        </div>
      </div>
    </div>
  );
}
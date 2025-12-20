
import React from 'react';
import { Play, RotateCcw, BookOpen, AlertCircle } from 'lucide-react';
import { GlassButton } from '../../../shared/components/ui/GlassButton';

export function Hub({ onStart, onEarn, onContinue, onMaterials, hasActiveSession, wallet, notification, onClearNotification }) {
  return (
    <div className="flex flex-col h-full p-6 space-y-6 animate-fade-in">
      {/* Notification */}
      {notification && (
          <div className={`p-4 rounded-xl flex items-center justify-between animate-fade-in ${notification.type === 'error' ? 'bg-red-500/20 text-red-200 border border-red-500/50' : 'bg-blue-500/20 text-blue-200'}`}>
              <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  <span>{notification.message}</span>
              </div>
              <button onClick={onClearNotification} className="text-sm underline opacity-70 hover:opacity-100">
                  关闭
              </button>
          </div>
      )}

      {/* Header Stats */}
      <div className="glass-panel p-4 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-white">今日听说</h2>
          <p className="text-sm text-gray-400">余额: {wallet?.balance || 0} 字</p>
        </div>
        <div className="flex items-center gap-2 text-yellow-400">
           <AlertCircle className="w-4 h-4" />
           <span className="text-xs">未完成将导致收益折半</span>
        </div>
      </div>

      {/* Main Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
        {/* Earn Points Card */}
        <div 
            className="glass-panel p-6 flex flex-col justify-between hover:bg-white/5 transition-colors cursor-pointer" 
            onClick={onEarn}
        >
             <div>
                <h3 className="text-xl font-bold text-white mb-2">赚取积分</h3>
                <p className="text-gray-400 text-sm">通过听写单词赚取积分，每词 +5~10。</p>
             </div>
             <div className="mt-4 flex justify-end">
                <span className="text-3xl font-bold text-yellow-400">+</span>
             </div>
        </div>

        {/* Generate Podcast Card */}
        <div 
            className={`glass-panel p-6 flex flex-col justify-between transition-colors cursor-pointer ${wallet?.balance >= 300 ? 'hover:bg-white/5' : 'opacity-50 grayscale'}`} 
            onClick={() => wallet?.balance >= 300 && onStart()}
        >
             <div>
                <h3 className="text-xl font-bold text-white mb-2">生成播客</h3>
                <p className="text-gray-400 text-sm">消耗 300 积分，生成今日听力材料。</p>
                {wallet?.balance < 300 && (
                    <p className="text-red-400 text-xs mt-2">积分不足 (需 {300 - (wallet?.balance || 0)})</p>
                )}
             </div>
             <div className="mt-4 flex justify-end">
                <RotateCcw className="w-8 h-8 text-blue-400" />
             </div>
        </div>

        {/* Continue Card */}
        {hasActiveSession && (
          <div className="glass-panel p-6 flex flex-col justify-between border-l-4 border-l-green-500 hover:bg-white/5 transition-colors cursor-pointer md:col-span-2" onClick={onContinue}>
             <div>
                <h3 className="text-xl font-bold text-white mb-2">继续挑战</h3>
                <p className="text-gray-400 text-sm">你有一个正在进行的播客挑战。</p>
             </div>
             <div className="mt-4 flex justify-end">
                <Play className="w-8 h-8 text-green-400" />
             </div>
          </div>
        )}

        {/* Materials Card */}
        <div className="glass-panel p-6 flex flex-col justify-between hover:bg-white/5 transition-colors cursor-pointer md:col-span-2" onClick={onMaterials}>
             <div>
                <h3 className="text-xl font-bold text-white mb-2">材料库</h3>
                <p className="text-gray-400 text-sm">回顾已解锁的听力材料，进行无限练习。</p>
             </div>
             <div className="mt-4 flex justify-end">
                <BookOpen className="w-8 h-8 text-purple-400" />
             </div>
        </div>
      </div>
    </div>
  );
}

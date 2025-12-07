import React from 'react';
import { Volume2, Key, RefreshCw, Zap, Globe, BookOpen } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

export function SettingsView({
  settingsState,
  updateSettings,
  handleResetData
}) {
  const theme = useTheme();
  return (
    <div className="h-full overflow-y-auto p-1 custom-scrollbar">
      <div className="max-w-2xl mx-auto space-y-8 pb-12">
        <h2 className="text-2xl font-bold text-white mb-6">设置</h2>

        {/* TTS 设置组 */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <Volume2 className="w-4 h-4" />
            语音 (TTS)
          </h3>
          <div className="glass-panel rounded-xl p-6 space-y-6">
            {/* 模式选择 */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">朗读模式</label>
              <div className="grid grid-cols-3 gap-2">
                {['none', 'word', 'sentence'].map(mode => (
                  <button
                    key={mode}
                    onClick={() => {
                      if (mode === 'sentence') {
                        updateSettings({ ttsMode: mode, speakDe: true, speakCn: settingsState.speakCn });
                      } else if (mode === 'none') {
                        updateSettings({ ttsMode: mode, speakDe: false, speakCn: false });
                      } else {
                        updateSettings({ ttsMode: mode });
                      }
                    }}
                    className={`py-3 text-sm font-bold rounded-lg transition-all border ${
                      settingsState.ttsMode === mode
                        ? 'text-white shadow-lg'
                        : 'glass-button text-gray-400 hover:text-gray-200'
                    }`}
                    style={settingsState.ttsMode === mode ? { 
                      backgroundColor: theme.primary,
                      borderColor: theme.primary,
                      boxShadow: `0 4px 12px ${theme.primary}40`
                    } : {}}
                  >
                    {mode === 'none' ? '静音' : mode === 'word' ? '仅单词' : '单词+例句'}
                  </button>
                ))}
              </div>
            </div>

            {/* 语言开关 */}
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-300 mb-2">德语发音</label>
                <button
                  onClick={() => updateSettings({ speakDe: !settingsState.speakDe })}
                  disabled={settingsState.ttsMode === 'none'}
                  className={`w-full py-2.5 rounded-lg text-sm font-bold transition ${
                    settingsState.speakDe 
                      ? 'text-white shadow-lg' 
                      : 'glass-button text-gray-500'
                  } disabled:opacity-30`}
                  style={settingsState.speakDe ? {
                    backgroundColor: theme.secondary,
                    borderColor: theme.secondary,
                    boxShadow: `0 4px 12px ${theme.secondary}40`
                  } : {}}
                >
                  {settingsState.speakDe ? '已开启' : '已关闭'}
                </button>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-300 mb-2">中文发音</label>
                <button
                  onClick={() => updateSettings({ speakCn: !settingsState.speakCn })}
                  disabled={settingsState.ttsMode === 'none'}
                  className={`w-full py-2.5 rounded-lg text-sm font-bold transition ${
                    settingsState.speakCn 
                      ? 'text-white shadow-lg' 
                      : 'glass-button text-gray-500'
                  } disabled:opacity-30`}
                  style={settingsState.speakCn ? {
                    backgroundColor: theme.secondary,
                    borderColor: theme.secondary,
                    boxShadow: `0 4px 12px ${theme.secondary}40`
                  } : {}}
                >
                  {settingsState.speakCn ? '已开启' : '已关闭'}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 学习计划 */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            学习计划
          </h3>
          <div className="glass-panel rounded-xl p-6 space-y-6">
             <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium text-gray-300">每日新词上限</label>
                <span className="text-sm font-mono" style={{ color: theme.primary }}>{settingsState.dailyNewLimit}</span>
              </div>
              <input
                type="range" min="0" max="50" step="5"
                value={settingsState.dailyNewLimit}
                onChange={e => updateSettings({ dailyNewLimit: Number(e.target.value) })}
                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
                style={{ accentColor: theme.primary }}
              />
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium text-gray-300">每日复习上限</label>
                <span className="text-sm font-mono" style={{ color: theme.primary }}>{settingsState.dailyReviewLimit}</span>
              </div>
              <input
                type="range" min="0" max="200" step="10"
                value={settingsState.dailyReviewLimit}
                onChange={e => updateSettings({ dailyReviewLimit: Number(e.target.value) })}
                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
                style={{ accentColor: theme.primary }}
              />
            </div>
          </div>
        </section>

        {/* 游戏参数设置 */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <Zap className="w-4 h-4" />
            游戏参数
          </h3>
          <div className="glass-panel rounded-xl p-6 space-y-6">
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium text-gray-300">下落速度</label>
                <span className="text-sm font-mono" style={{ color: theme.primary }}>{settingsState.speed}</span>
              </div>
              <input
                type="range" min="1" max="15" step="0.5"
                value={settingsState.speed}
                onChange={e => updateSettings({ speed: Number(e.target.value) })}
                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
                style={{ accentColor: theme.primary }}
              />
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium text-gray-300">生成间隔 (ms)</label>
                <span className="text-sm font-mono" style={{ color: theme.primary }}>{settingsState.spawnRate}</span>
              </div>
              <input
                type="range" min="500" max="5000" step="100"
                value={settingsState.spawnRate}
                onChange={e => updateSettings({ spawnRate: Number(e.target.value) })}
                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
                style={{ accentColor: theme.primary }}
              />
              <p className="text-xs text-gray-500 mt-2">值越小生成越快，难度越高</p>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium text-gray-300">同屏最大碎片数</label>
                <span className="text-sm font-mono" style={{ color: theme.primary }}>{settingsState.maxOnScreen}</span>
              </div>
              <input
                type="range" min="5" max="30" step="1"
                value={settingsState.maxOnScreen}
                onChange={e => updateSettings({ maxOnScreen: Number(e.target.value) })}
                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
                style={{ accentColor: theme.primary }}
              />
            </div>
          </div>
        </section>

        {/* API & 高级 */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <Key className="w-4 h-4" />
            API 与 数据
          </h3>
          <div className="glass-panel rounded-xl p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Gemini API Key</label>
              <input
                type="password"
                value={settingsState.apiKey || ''}
                onChange={e => updateSettings({ apiKey: e.target.value })}
                placeholder="在此粘贴您的 API Key"
                className="w-full glass-button cursor-text rounded-lg px-4 py-2.5 text-sm focus:ring-1 transition"
                style={{ '--tw-ring-color': theme.primary, borderColor: theme.primary }}
              />
              <p className="text-xs text-gray-500 mt-2">用于生成例句，密钥仅存储在本地浏览器中</p>
            </div>

            <div className="pt-4 border-t border-slate-700">
               <button
                onClick={handleResetData}
                className="w-full py-3 text-sm font-bold text-red-400 bg-red-900/10 border border-red-900/30 rounded-lg hover:bg-red-900/20 transition"
              >
                重置所有数据
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
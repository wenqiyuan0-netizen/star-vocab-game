import React, { useState } from 'react';
import {
  Download, Award, Calendar,
  Volume2, Key, Image, Sparkles, Bot,
  Clock, AlertTriangle
} from 'lucide-react';
import AvatarMenu from '../../../shared/components/ui/AvatarMenu';
import { WallpaperSettings } from '../../dashboard/views/WallpaperSettings';
import { GlassButton } from '../../../shared/components/ui/GlassButton';
import { CalendarModal } from '../../../shared/components/ui/CalendarModal';
import { useTheme } from '../../../shared/hooks/useTheme';
import { withOpacity, getOffToggleColor, parseColorToRgb } from '../../../utils/colorUtils';
import { getLocalDateString } from '../../../utils/dateUtils';
import { useAuth } from '../../auth/contexts/AuthContext';
import { getEffectiveSettings } from '../../learning/services/ClearanceHelper';

// Helper component for expandable sections with animation
const ExpandableSection = ({ isOpen, children, className = "" }) => (
  <div
    className={`overflow-hidden transition-all duration-300 ease-in-out ${className}`}
    style={{
      maxHeight: isOpen ? '500px' : '0',
      opacity: isOpen ? 1 : 0,
      transform: isOpen ? 'translateY(0)' : 'translateY(-10px)'
    }}
  >
    {children}
  </div>
);





// Delete Confirmation Modal
const DeleteConfirmModal = ({ isOpen, onConfirm, onCancel, theme }) => {
  if (!isOpen) return null;
  
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 shadow-2xl backdrop-blur-xl"
        style={{
          backgroundColor: withOpacity(theme.background, 0.95),
          border: `1px solid ${withOpacity(theme.primary, 0.3)}`
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center space-y-4">
          <div
            className="p-4 rounded-full"
            style={{
              backgroundColor: withOpacity(theme.accent, 0.15),
              color: theme.accent
            }}
          >
            <AlertTriangle className="w-8 h-8" />
          </div>
          
          <div>
            <h3 className="text-xl font-bold mb-2" style={{ color: theme.text }}>确认注销账号？</h3>
            <p className="text-sm opacity-70 leading-relaxed" style={{ color: theme.text }}>
              此操作将<span className="font-bold text-red-500">删除所有本地数据</span>并退出登录。<br/>
              云端数据可能保留，取决于同步状态。
            </p>
          </div>

          <div className="flex gap-3 w-full mt-4">
            <button
              onClick={onCancel}
              className="flex-1 py-3 rounded-xl font-bold text-sm transition-colors"
              style={{ 
                backgroundColor: withOpacity(theme.text, 0.05),
                color: withOpacity(theme.text, 0.8)
              }}
            >
              取消
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 py-3 rounded-xl font-bold text-sm text-white shadow-lg transition-transform active:scale-95"
              style={{ 
                backgroundColor: theme.accent, // Use accent color (usually red/orange for danger)
                boxShadow: `0 4px 12px ${withOpacity(theme.accent, 0.3)}`
              }}
            >
              确认注销
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export function ProfileView({
  settingsState = {},
  updateSettings,
  handleExportSave,
  setShowSaveModal,
  handleResetData,
  handleDeleteAccount,
  resetDataSilent,
  dailyStats = { reviewCount: 0, newCount: 0 },
  userProfile,
  getXPForLevel
}) {
  const safeSettings = settingsState || {};
  const [showWallpaperSettings, setShowWallpaperSettings] = useState(false);
  const [showAiSettings, setShowAiSettings] = useState(!!safeSettings.apiKey);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const theme = useTheme();
  const { user, signOut } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState(() => localStorage.getItem('space_vocab_avatar'));

  // 临时清理模式状态
  const [effectiveSettings, setEffectiveSettings] = useState(() => getEffectiveSettings());

  // 监听清理模式变化
  React.useEffect(() => {
    const handleClearanceModeChange = () => {
      setEffectiveSettings(getEffectiveSettings());
    };

    window.addEventListener('clearance-mode-changed', handleClearanceModeChange);
    return () => window.removeEventListener('clearance-mode-changed', handleClearanceModeChange);
  }, []);

  const isOnline = !!user;
  const displayName = userProfile?.name || (user?.email ? user.email.split('@')[0] : 'Star Explorer');

  // Calculate Level Progress
  const level = userProfile?.level || 1;
  const totalXP = userProfile?.totalXP || 0;
  const currentLevelBaseXP = getXPForLevel ? getXPForLevel(level) : 0;
  const nextLevelBaseXP = getXPForLevel ? getXPForLevel(level + 1) : 1000;
  const levelProgress = Math.min(100, Math.max(0,
    ((totalXP - currentLevelBaseXP) / (nextLevelBaseXP - currentLevelBaseXP)) * 100
  ));

  // Determine if today is completed (Mock logic based on quotas)
  const isMissionComplete =
    dailyStats.reviewCount >= (safeSettings.dailyReviewLimit ?? 30) &&
    dailyStats.newCount >= (safeSettings.dailyNewLimit ?? 10);

  // Calculate current week's check-in status (Sun - Sat)
  const checkInDates = userProfile?.checkInDates || [];
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun, 6=Sat

  // Find Sunday of this week
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - dayOfWeek);

  const currentWeekStatus = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    const dateStr = getLocalDateString(d);

    // Check if checked in (strict date match)
    const isCheckedIn = checkInDates.includes(dateStr);

    // Force light up if it's today and mission is complete (immediate visual feedback)
    const isTodayIndex = i === dayOfWeek;
    return isCheckedIn || (isTodayIndex && isMissionComplete);
  });

  const textColor = theme.text;

  // Calculate Brightness for Dynamic Color Assignment
  const getBrightness = (color) => {
    if (!color) return 0;
    const [r, g, b] = parseColorToRgb(color);
    return (r * 299 + g * 587 + b * 114) / 1000;
  };

  const primaryBrightness = getBrightness(theme.primary);
  const secondaryBrightness = getBrightness(theme.secondary);

  // Assign lighter color to highlight elements (numbers, active toggles)
  const highlightColor = primaryBrightness > secondaryBrightness ? theme.primary : theme.secondary;


  const handleWallpaperSave = (target, dataUrl, palette) => {
    try {
      if (target === 'home') {
        localStorage.setItem('star-vocab-wallpaper-home', dataUrl);
      } else {
        localStorage.setItem('star-vocab-wallpaper-system', dataUrl);
      }
      if (palette) {
        localStorage.setItem('star-vocab-theme-palette', JSON.stringify(palette));
      }
      window.dispatchEvent(new Event('wallpaper-changed'));
      window.dispatchEvent(new Event('theme-changed'));
      setShowWallpaperSettings(false);
    } catch (e) {
      console.error("Failed to save wallpaper", e);
      alert("保存壁纸失败，可能是图片过大");
    }
  };

  const handleChangeAvatar = (url) => {
    try {
      localStorage.setItem('space_vocab_avatar', url);
      setAvatarUrl(url);
      window.dispatchEvent(new Event('avatar-changed'));
    } catch { }
  };

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleDeleteAccountRequest = () => {
    if (handleDeleteAccount) {
      handleDeleteAccount();
    } else {
      setShowDeleteConfirm(true);
    }
  };

  const handleConfirmDeleteAccount = async () => {
    try {
      // 1. 调用静默重置数据逻辑 (清除本地)
      if (resetDataSilent) {
        resetDataSilent();
      } else if (handleResetData) {
        // Fallback for safety, though it triggers UI
        handleResetData();
      }
      
      // 2. 退出登录
      await signOut();
      
      setShowDeleteConfirm(false);
      window.location.reload();
    } catch (error) {
      console.error('Delete account failed:', error);
    }
  };



  if (showWallpaperSettings) {
    return <WallpaperSettings onSave={handleWallpaperSave} onClose={() => setShowWallpaperSettings(false)} />;
  }

  return (
    <div className="h-full overflow-y-auto p-6 pb-24 animate-fade-in custom-scrollbar">
      <div className="flex justify-end mb-2">
        <AvatarMenu
          avatarUrl={avatarUrl}
          displayName={displayName}
          onChangeAvatar={handleChangeAvatar}
          onLogout={handleLogout}
        />
      </div>
      
      <DeleteConfirmModal 
        isOpen={showDeleteConfirm}
        onConfirm={handleConfirmDeleteAccount}
        onCancel={() => setShowDeleteConfirm(false)}
        theme={theme}
      />
      {/* Profile Header */}
      <div className="flex items-center space-x-4 mb-8">
        <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold shadow-lg relative"
          style={{ background: theme.primary, color: (theme.roles ? theme.roles.buttonPrimaryText : theme.text) }}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="avatar" className="w-full h-full rounded-full object-cover" />
          ) : (
            displayName.charAt(0).toUpperCase()
          )}
          {isOnline && (
            <div className="absolute bottom-0 right-0 w-5 h-5 rounded-full border-2" title="已连接 Supabase"
              style={{ backgroundColor: (Array.isArray(theme.complementary) && theme.complementary[0] ? theme.complementary[0] : theme.accent), borderColor: (theme.roles ? theme.roles.buttonPrimaryText : theme.text) }} />
          )}
        </div>
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: withOpacity(theme.text, 0.6) }}>
            {displayName}
            {isOnline && <span className="text-xs px-2 py-1 rounded-full font-bold" style={{ backgroundColor: (Array.isArray(theme.complementary) && theme.complementary[0] ? withOpacity(theme.complementary[0], 0.2) : withOpacity(theme.accent, 0.2)), color: (Array.isArray(theme.complementary) && theme.complementary[0] ? theme.complementary[0] : theme.accent) }}>云端已连接</span>}
          </h2>
          <p className="opacity-60" style={{ color: withOpacity(theme.text, 0.6) }}>Level {level} Explorer</p>
        </div>
      </div>

      {/* Masonry-like Grid Layout */}
      <div className="grid grid-cols-12 gap-4">

        {/* --- Block 1: Level & XP (Large, spanning 7 cols) --- */}
        <div
          className="col-span-7 glass-panel rounded-3xl p-5 relative overflow-hidden group transition-all hover:scale-[1.02] duration-300"
        >
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-1">
              <Award className="w-5 h-5" style={{ color: highlightColor }} />
              <span className="text-xs font-bold uppercase tracking-wider opacity-70" style={{ color: highlightColor }}>Level Status</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-5xl font-black" style={{ color: highlightColor }}>{level}</span>
              <span className="text-sm font-bold opacity-60" style={{ color: highlightColor }}>Lv.</span>
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-xs font-bold mb-1 opacity-70" style={{ color: highlightColor }}>
                <span>{Math.floor(totalXP - currentLevelBaseXP)} XP</span>
                <span>{Math.floor(nextLevelBaseXP - currentLevelBaseXP)} XP</span>
              </div>
              <div className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: withOpacity(highlightColor, 0.2) }}>
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{ width: `${levelProgress}%`, backgroundColor: highlightColor }}
                />
              </div>
            </div>
            {/* 临时清理模式提示 */}
            {effectiveSettings.isTemporary && (
              <div
                className="mt-2 rounded-lg p-2 border"
                style={{
                  backgroundColor: withOpacity(theme.accent, 0.1),
                  borderColor: withOpacity(theme.accent, 0.3)
                }}
              >
                <div className="text-[10px] font-bold mb-1" style={{ color: theme.accent }}>
                  🔧 智能清理模式已启用
                </div>
                <div className="text-[9px] opacity-70" style={{ color: withOpacity(theme.text, 0.7) }}>
                  原设置: New {effectiveSettings.originalNewLimit} / Review {effectiveSettings.originalReviewLimit}
                </div>
                <div className="text-[9px] opacity-70" style={{ color: withOpacity(theme.text, 0.7) }}>
                  清理完成后将自动恢复
                </div>
              </div>
            )}
          </div>
          {/* Decorative circle */}
          <div
            className="absolute -right-6 -top-6 w-32 h-32 rounded-full opacity-20 transition-transform group-hover:scale-110"
            style={{ backgroundColor: highlightColor }}
          />
        </div>

        {/* --- Block 2: Check-in / Calendar (Small, spanning 5 cols) --- */}
        <button
          onClick={() => setShowCalendar(true)}
          className="col-span-5 glass-panel rounded-3xl p-4 flex flex-col justify-between relative overflow-hidden transition-all hover:scale-[1.02] duration-300 text-left group"
        >
          <div className="flex items-center justify-between z-10">
            <Calendar className="w-5 h-5" style={{ color: highlightColor }} />
            <span className="text-xs font-bold opacity-60" style={{ color: highlightColor }}>Streak</span>
          </div>
          <div className="z-10 mt-2 text-center">
            <span className="text-4xl font-black" style={{ color: highlightColor }}>{userProfile?.streak || 1}</span>
            <span className="text-xs font-bold ml-1 opacity-60" style={{ color: highlightColor }}>Days</span>
          </div>
          {/* Mini Calendar Visual */}
          <div className="grid grid-cols-7 gap-1 mt-3 opacity-40 group-hover:opacity-60 transition-opacity">
            {currentWeekStatus.map((isChecked, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-colors ${i === new Date().getDay() ? 'ring-1 ring-offset-1 ring-current opacity-100' : ''}`}
                style={{
                  backgroundColor: isChecked ? highlightColor : withOpacity(theme.text, 0.1),
                  color: highlightColor // for the ring
                }}
              />
            ))}
          </div>
        </button>

        <CalendarModal
          isOpen={showCalendar}
          onClose={() => setShowCalendar(false)}
          todayCompleted={isMissionComplete}
          checkInDates={userProfile?.checkInDates || []} // Assuming this exists or is empty
        />

        {/* --- Block 3: TTS Settings (Full Width, Expandable) --- */}
        <div
          className="col-span-12 glass-panel rounded-3xl p-5 transition-all duration-300"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm transition-colors duration-300"
                style={{
                  backgroundColor: safeSettings.ttsMode !== 'none' ? highlightColor : getOffToggleColor(theme),
                  color: safeSettings.ttsMode !== 'none' ? theme.text : withOpacity(theme.text, 0.6)
                }}
              >
                <Volume2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg leading-tight" style={{ color: safeSettings.ttsMode !== 'none' ? highlightColor : withOpacity(theme.text, 0.6) }}>语音朗读</h3>
                <p className="text-xs opacity-60" style={{ color: withOpacity(theme.text, 0.6) }}>Text-to-Speech</p>
              </div>
            </div>
            <button
              onClick={() => updateSettings({ ttsMode: safeSettings.ttsMode === 'none' ? 'word' : 'none' })}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 focus:outline-none shadow-inner`}
              style={{ backgroundColor: safeSettings.ttsMode !== 'none' ? highlightColor : getOffToggleColor(theme) }}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ${safeSettings.ttsMode !== 'none' ? 'translate-x-6' : 'translate-x-1'
                }`} />
            </button>
          </div>

          <ExpandableSection isOpen={safeSettings.ttsMode !== 'none'}>
            <div className="mt-4 pt-4 border-t border-black/5 space-y-4" style={{ borderColor: withOpacity(theme.primary, 0.08) }}>
              {/* Mode Select */}
              <div className="flex p-1 rounded-xl" style={{ backgroundColor: withOpacity(theme.text, 0.05) }}>
                {['word', 'sentence'].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => updateSettings({ ttsMode: mode })}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${safeSettings.ttsMode === mode ? 'shadow-sm scale-95' : 'hover:bg-black/5'
                      }`}
                    style={safeSettings.ttsMode === mode ? { backgroundColor: withOpacity(highlightColor, 0.12), color: highlightColor } : { color: textColor, opacity: 0.6 }}
                  >
                    {mode === 'word' ? '单词模式' : '例句模式'}
                  </button>
                ))}
              </div>

              {/* Word Mode Options */}
              {safeSettings.ttsMode === 'word' && (
                <div className="flex gap-3">
                  <button
                    onClick={() => updateSettings({ speakDe: !safeSettings.speakDe })}
                    className={`flex-1 py-3 rounded-xl border-2 text-xs font-bold transition-all flex items-center justify-center gap-2 ${safeSettings.speakDe ? 'shadow-sm' : 'opacity-60'
                      }`}
                    style={safeSettings.speakDe ? { backgroundColor: withOpacity(highlightColor, 0.12), borderColor: withOpacity(highlightColor, 0.3), color: highlightColor } : { borderColor: withOpacity(theme.text, 0.1), color: theme.text }}
                  >
                    <div className={`w-2 h-2 rounded-full ${safeSettings.speakDe ? 'animate-pulse' : ''}`} style={{ backgroundColor: safeSettings.speakDe ? highlightColor : getOffToggleColor(theme) }} />
                    德语发音
                  </button>
                  <button
                    onClick={() => updateSettings({ speakCn: !safeSettings.speakCn })}
                    className={`flex-1 py-3 rounded-xl border-2 text-xs font-bold transition-all flex items-center justify-center gap-2 ${safeSettings.speakCn ? 'shadow-sm' : 'opacity-60'
                      }`}
                    style={safeSettings.speakCn ? { backgroundColor: withOpacity(highlightColor, 0.12), borderColor: withOpacity(highlightColor, 0.3), color: highlightColor } : { borderColor: withOpacity(theme.text, 0.1), color: theme.text }}
                  >
                    <div className={`w-2 h-2 rounded-full ${safeSettings.speakCn ? 'animate-pulse' : ''}`} style={{ backgroundColor: safeSettings.speakCn ? highlightColor : getOffToggleColor(theme) }} />
                    中文发音
                  </button>
                </div>
              )}
            </div>
          </ExpandableSection>
        </div>

        {/* --- Block 4: Limits (Medium, 6 cols) --- */}
        <div
          className="col-span-6 glass-panel rounded-3xl p-4 flex flex-col justify-center gap-3"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
        >
          <div className="flex items-center justify-between mb-1 opacity-90" style={{ color: highlightColor }}>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span className="text-xs font-bold">Daily Goals</span>
            </div>
            {/* Save Button for Daily Goals */}
            <button
              onClick={() => {
                // Force update settings which will trigger cloud sync and re-plan
                updateSettings({
                  dailyNewLimit: safeSettings.dailyNewLimit,
                  dailyReviewLimit: safeSettings.dailyReviewLimit
                });
                // Optional: Show a visual feedback or toast could go here
              }}
              className="text-[10px] px-2 py-1 rounded-lg font-bold bg-white/20 hover:bg-white/30 transition-colors"
              title="保存并立即生效"
            >
              保存
            </button>
          </div>
          <div className="space-y-3">
            <div className="rounded-xl p-2 px-3 flex items-center justify-between" style={{ backgroundColor: withOpacity(highlightColor, 0.25) }}>
              <span className="text-xs font-bold opacity-90" style={{ color: highlightColor }}>New</span>
              <input
                type="number"
                value={safeSettings.dailyNewLimit}
                onChange={e => updateSettings({ dailyNewLimit: Number(e.target.value) })}
                className="w-10 bg-transparent text-right font-black outline-none"
                style={{ color: highlightColor }}
              />
            </div>
            <div className="rounded-xl p-2 px-3 flex items-center justify-between" style={{ backgroundColor: withOpacity(highlightColor, 0.25) }}>
              <span className="text-xs font-bold opacity-90" style={{ color: highlightColor }}>Review</span>
              <input
                type="number"
                value={safeSettings.dailyReviewLimit}
                onChange={e => updateSettings({ dailyReviewLimit: Number(e.target.value) })}
                className="w-10 bg-transparent text-right font-black outline-none"
                style={{ color: highlightColor }}
              />
            </div>
          </div>
        </div>

        {/* --- Block 5: Wallpaper (Medium, 6 cols) --- */}
        <button
          onClick={() => setShowWallpaperSettings(true)}
          className="col-span-6 glass-panel rounded-3xl p-4 flex flex-col items-center justify-center gap-3 text-center group transition-all hover:scale-[1.02]"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
        >
          <div className="w-12 h-12 rounded-full flex items-center justify-center group-hover:rotate-12 transition-transform" style={{ backgroundColor: withOpacity(highlightColor, 0.3), color: highlightColor }}>
            <Image className="w-6 h-6" />
          </div>
          <div>
            <span className="block text-sm font-black" style={{ color: highlightColor }}>壁纸设置</span>
            <span className="text-[10px] opacity-80" style={{ color: highlightColor }}>自定义主题</span>
          </div>
        </button>

        {/* --- Block 6: AI Gemini (Full Width, Expandable) --- */}
        <div
          className="col-span-12 glass-panel rounded-3xl p-5 transition-all duration-300"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm transition-colors duration-300"
                style={{
                  backgroundColor: showAiSettings ? highlightColor : getOffToggleColor(theme),
                  color: showAiSettings ? theme.text : withOpacity(theme.text, 0.6)
                }}
              >
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg leading-tight" style={{ color: showAiSettings ? highlightColor : withOpacity(theme.text, 0.6) }}>AI 助手</h3>
              </div>
            </div>
            <button
              onClick={() => setShowAiSettings(!showAiSettings)}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 focus:outline-none shadow-inner`}
              style={{ backgroundColor: showAiSettings ? highlightColor : getOffToggleColor(theme) }}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ${showAiSettings ? 'translate-x-6' : 'translate-x-1'
                }`} />
            </button>
          </div>

          <ExpandableSection isOpen={showAiSettings}>
            <div className="mt-4 pt-4 border-t border-black/5 space-y-3" style={{ borderColor: withOpacity(theme.secondary, 0.08) }}>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" style={{ color: textColor }}>
                  <Key className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={safeSettings.apiKey || ''}
                  onChange={e => updateSettings({ apiKey: e.target.value })}
                  placeholder="Paste Gemini API Key"
                  className="w-full rounded-xl py-3 pl-10 pr-4 text-xs font-mono outline-none border-2 border-transparent focus:border-current transition-colors"
                  style={{ color: highlightColor, backgroundColor: withOpacity(highlightColor, 0.12) }}
                />
              </div>
              <p className="text-[10px] opacity-50 text-center">
                配置 API Key 以解锁智能例句生成功能
              </p>
            </div>
          </ExpandableSection>
        </div>

        {/* --- Block 7: Actions (Full Width) --- */}
        <div className="col-span-12 mt-4 space-y-3">
          <GlassButton
            onClick={() => setShowSaveModal(true)}
            tone="secondary"
            variant="homeSecondary"
            size="md"
            fullWidth
            className="rounded-2xl opacity-80"
            leadingIcon={Download}
          >
            导出本地存档 (Backup)
          </GlassButton>

          <GlassButton
            onClick={handleResetData}
            tone="secondary"
            variant="homeSecondary"
            size="md"
            fullWidth
            className="rounded-2xl opacity-60"
          >
            重置所有游戏数据
          </GlassButton>

          <GlassButton
            onClick={handleDeleteAccountRequest}
            tone="secondary"
            variant="homeSecondary"
            size="md"
            fullWidth
            className="rounded-2xl opacity-80 text-red-400 hover:text-red-300 hover:bg-red-900/20 border-red-900/30"
            leadingIcon={AlertTriangle}
          >
            注销账户 (Delete Account)
          </GlassButton>
        </div>

      </div>
    </div>
  );
}

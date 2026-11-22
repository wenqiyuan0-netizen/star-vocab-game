import React, { useMemo, useState } from 'react';
import { useI18n } from '../../../shared/i18n';
import { LanguageSwitcher } from '../../../shared/components/ui/LanguageSwitcher';
import { DownloadPanel } from '../components/DownloadPanel';
import { IS_OFFLINE_BUILD } from '../../../shared/constants/config';
import { Play, BookOpen, Sparkles, Library, Download } from 'lucide-react';
import BrandLogo from '../../../shared/components/ui/BrandLogo';
import { useTheme } from '../../../shared/hooks/useTheme';
import { GlassButton } from '../../../shared/components/ui/GlassButton';
import { withOpacity } from '../../../utils/colorUtils';

export function HomeView({ 
  globalWordDb = [], 
  settingsState = {}, 
  onStartGame, 
  onNavigateToLibrary,
  dailyStats = { newCount: 0, reviewCount: 0 }
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const [showDownload, setShowDownload] = useState(false);
  
  // 计算今日任务
  const stats = useMemo(() => {
    const now = Date.now();
    const dbReviewCount = globalWordDb.filter(w => w.state !== 'new' && w.dueDate <= now).length;
    const dbNewCount = globalWordDb.filter(w => w.state === 'new').length;
    
    // 安全获取设置，防止 null/undefined
    const safeSettings = settingsState || {};
    const dailyReviewLimit = safeSettings.dailyReviewLimit ?? 30;
    const dailyNewLimit = safeSettings.dailyNewLimit ?? 10;
    
    // 计算剩余配额
    const remainingReviewQuota = Math.max(0, dailyReviewLimit - dailyStats.reviewCount);
    const remainingNewQuota = Math.max(0, dailyNewLimit - dailyStats.newCount);

    // 实际显示给用户的“待完成”数量，受限于配额
    // 如果配额没了，显示 0，告诉用户今天完事了
    const reviewCount = Math.min(dbReviewCount, remainingReviewQuota);
    const dailyNew = Math.min(dbNewCount, remainingNewQuota);
    
    return { reviewCount, dailyNew, total: globalWordDb.length };
  }, [globalWordDb, settingsState, dailyStats]);

  const isLibraryEmpty = stats.total === 0;
  const learnedCount = useMemo(() => globalWordDb.filter(w => w.state && w.state !== 'new').length, [globalWordDb]);
  const learnedPct = stats.total ? Math.round((learnedCount / stats.total) * 100) : 0;
  const muted = withOpacity(theme.text, 0.55);
  const hour = new Date().getHours();
  const greeting = t(hour < 6 ? 'home.greeting.night' : hour < 12 ? 'home.greeting.morning' : hour < 18 ? 'home.greeting.day' : 'home.greeting.evening');

  const StatCard = ({ icon: Icon, value, label, color }) => (
    <div className="glass-panel p-5 rounded-3xl flex flex-col items-center text-center transition-all duration-300 hover:-translate-y-1 group">
      <div
        className="mb-3 p-3 rounded-2xl group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300"
        style={{ backgroundColor: withOpacity(color, 0.12), color }}
      >
        <Icon className="w-6 h-6" />
      </div>
      <span className="text-4xl font-black tabular-nums" style={{ color: theme.text }}>{value}</span>
      <span className="text-xs uppercase tracking-wider mt-1 font-semibold" style={{ color: muted }}>{label}</span>
    </div>
  );

  return (
    <div className="relative h-full flex flex-col items-center justify-center p-6 space-y-10 animate-fade-in">
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        {!IS_OFFLINE_BUILD && (
          <button
            onClick={() => setShowDownload(true)}
            className="card-surface inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold"
            style={{ color: theme.text }}
          >
            <Download className="w-3.5 h-3.5" style={{ color: theme.primary }} />{t('home.download')}
          </button>
        )}
        <LanguageSwitcher compact />
      </div>
      {showDownload && <DownloadPanel onClose={() => setShowDownload(false)} />}
      <div className="flex flex-col items-center space-y-4">
        <div className="relative">
          <div className="absolute -inset-6 rounded-full blur-2xl opacity-40 animate-pulse" style={{ backgroundColor: theme.primary }} />
          <div className="relative z-10 animate-float" style={{ color: theme.primary }}>
            <BrandLogo size={72} />
          </div>
        </div>
        {/* Soft halo in the background colour keeps text legible over busy wallpapers */}
        <div className="text-center space-y-1.5" style={{ textShadow: `0 0 18px ${theme.background}, 0 0 6px ${theme.background}, 0 0 2px ${theme.background}` }}>
          <p className="text-xs font-bold uppercase tracking-[0.25em]" style={{ color: theme.primary }}>{greeting}</p>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight" style={{ color: theme.text }}>
            {t('home.title')}
          </h1>
          <p className="text-sm font-semibold tracking-wide" style={{ color: withOpacity(theme.text, 0.72) }}>{t('app.tagline')}</p>
        </div>
      </div>

      {!isLibraryEmpty ? (
        <div className="w-full max-w-md space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <StatCard icon={BookOpen} value={stats.reviewCount} label={t('home.dueReview')} color={theme.primary} />
            <StatCard icon={Sparkles} value={stats.dailyNew} label={t('home.newToday')} color={theme.accent} />
          </div>
          <div className="glass-panel rounded-2xl px-5 py-3">
            <div className="flex justify-between text-xs font-semibold mb-2" style={{ color: muted }}>
              <span>{t('home.learned', { n: learnedCount, total: stats.total })}</span>
              <span style={{ color: theme.primary }}>{learnedPct}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: withOpacity(theme.text, 0.08) }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${Math.max(learnedPct, 2)}%`, background: `linear-gradient(90deg, ${theme.primary}, ${theme.secondary})` }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-panel p-6 rounded-3xl max-w-md text-center">
          <Library className="w-10 h-10 mx-auto mb-3" style={{ color: theme.accent }} />
          <h3 className="text-lg font-bold mb-2" style={{ color: theme.text }}>{t('home.empty.title')}</h3>
          <p className="text-sm mb-4" style={{ color: muted }}>{t('home.empty.body')}</p>
          <GlassButton
            onClick={onNavigateToLibrary}
            tone="secondary"
            variant="homeSecondary"
            size="md"
            className="rounded-xl px-5 py-2 text-sm font-bold"
          >
            {t('home.empty.cta')}
          </GlassButton>
        </div>
      )}

      <button
        onClick={onStartGame}
        disabled={isLibraryEmpty}
        className="btn-hero group relative rounded-full px-12 py-5 text-lg font-black tracking-wider text-white disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`,
          boxShadow: `0 14px 34px -10px ${withOpacity(theme.primary, 0.7)}, inset 0 1px 0 rgba(255,255,255,0.35)`
        }}
      >
        <span className="relative z-10 flex items-center gap-3">
          <Play className="w-5 h-5 fill-current transition-transform group-hover:scale-125" />
          {t('home.start')}
        </span>
      </button>
    </div>
  );
}

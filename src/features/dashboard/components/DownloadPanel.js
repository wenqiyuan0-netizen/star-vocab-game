import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Monitor, Smartphone, Apple, ExternalLink, Download, X } from 'lucide-react';
import { useI18n } from '../../../shared/i18n';
import { useTheme } from '../../../shared/hooks/useTheme';
import { withOpacity } from '../../../utils/colorUtils';
import { RELEASES_URL, latestAsset } from '../../../shared/constants/config';

const isIOS = () => typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
const isAndroid = () => typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

function Row({ icon: Icon, title, children, highlight }) {
  const theme = useTheme();
  return (
    <div
      className="card-surface rounded-2xl p-4 flex gap-4 items-start"
      style={highlight ? { borderColor: withOpacity(theme.primary, 0.45), boxShadow: `0 0 0 3px ${withOpacity(theme.primary, 0.12)}` } : undefined}
    >
      <div className="p-2.5 rounded-xl shrink-0" style={{ backgroundColor: withOpacity(theme.primary, 0.12), color: theme.primary }}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm mb-2" style={{ color: theme.text }}>{title}</div>
        {children}
      </div>
    </div>
  );
}

function LinkButton({ href, children, primary }) {
  const theme = useTheme();
  return (
    <a
      href={href}
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold mr-2 mb-1"
      style={primary
        ? { background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`, color: '#fff' }
        : { background: 'var(--card-surface-muted)', color: theme.text, border: '1px solid var(--card-border)' }}
    >
      <Download className="w-3.5 h-3.5" />{children}
    </a>
  );
}

export function DownloadPanel({ onClose }) {
  const { t } = useI18n();
  const theme = useTheme();
  const muted = withOpacity(theme.text, 0.6);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <>
      <div className="layer-scrim" onClick={onClose} aria-hidden="true" />
      <div className="layer-modal flex items-center justify-center p-4 pointer-events-none">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('download.title')}
          className="card-elevated animate-card-pop pointer-events-auto w-full max-w-md rounded-[28px] p-6 max-h-[90vh] overflow-y-auto"
          style={{ color: theme.text }}
        >
          <div className="flex items-start justify-between mb-1">
            <h2 className="text-xl font-black">{t('download.title')}</h2>
            <button onClick={onClose} className="icon-btn w-8 h-8" aria-label={t('download.close')}><X className="w-4 h-4" /></button>
          </div>
          <p className="text-sm mb-5" style={{ color: muted }}>{t('download.subtitle')}</p>

          <div className="space-y-3">
            <Row icon={Monitor} title={t('download.windows')} highlight={!isIOS() && !isAndroid()}>
              <LinkButton href={latestAsset('StarVocab-Setup.exe')} primary>{t('download.windows.installer')}</LinkButton>
              <LinkButton href={latestAsset('StarVocab-Portable.exe')}>{t('download.windows.portable')}</LinkButton>
            </Row>
            <Row icon={Smartphone} title={t('download.android')} highlight={isAndroid()}>
              <LinkButton href={latestAsset('StarVocab.apk')} primary>{t('download.android.apk')}</LinkButton>
            </Row>
            <Row icon={Apple} title={t('download.ios')} highlight={isIOS()}>
              <p className="text-xs leading-relaxed" style={{ color: muted }}>{t('download.ios.pwa')}</p>
            </Row>
          </div>

          <p className="text-[11px] leading-relaxed mt-4" style={{ color: muted }}>{t('download.unsigned')}</p>
          <a
            href={RELEASES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-bold mt-3 hover:underline"
            style={{ color: theme.primary }}
          >
            {t('download.allReleases')} <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </>,
    document.body
  );
}

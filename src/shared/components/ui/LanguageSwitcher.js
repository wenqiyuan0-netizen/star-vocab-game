import React from 'react';
import { Languages } from 'lucide-react';
import { useI18n } from '../../i18n';

/** Segmented 中 / EN / DE switch. `tone="light"` for use on plain light backgrounds. */
export function LanguageSwitcher({ className = '', compact = false }) {
  const { lang, setLang, langs, t } = useI18n();
  return (
    <div
      role="radiogroup"
      aria-label={t('lang.label')}
      className={`card-surface inline-flex items-center gap-0.5 rounded-full p-1 ${className}`}
    >
      {!compact && <Languages className="w-3.5 h-3.5 mx-1.5 opacity-50" aria-hidden="true" />}
      {langs.map((l) => {
        const active = l.code === lang;
        return (
          <button
            key={l.code}
            role="radio"
            aria-checked={active}
            title={l.label}
            onClick={() => setLang(l.code)}
            className="px-2.5 py-1 rounded-full text-xs font-bold"
            style={{
              background: active ? 'var(--theme-primary)' : 'transparent',
              color: active ? '#fff' : 'var(--theme-text)',
              opacity: active ? 1 : 0.65,
            }}
          >
            {l.short}
          </button>
        );
      })}
    </div>
  );
}

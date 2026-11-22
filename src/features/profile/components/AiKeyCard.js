import React, { useState } from 'react';
import { Bot, Eye, EyeOff, Check, Trash2, ExternalLink } from 'lucide-react';
import { useTheme } from '../../../shared/hooks/useTheme';
import { withOpacity } from '../../../utils/colorUtils';
import { getAiConfig, setAiConfig, DEFAULT_GEMINI_MODEL } from '../../../shared/services/ai/AIService';
import { soundManager } from '../../../shared/services/audio/SoundManager';
import { useI18n } from '../../../shared/i18n';

/**
 * Bring-your-own-key settings for the AI example generator.
 * The key is stored only in this browser's localStorage and sent directly
 * to Google's Gemini API; the project ships no key and runs no proxy.
 */
export function AiKeyCard({ accentColor }) {
  const theme = useTheme();
  const { t } = useI18n();
  const color = accentColor || theme.primary;
  const initial = getAiConfig();
  const [hasKey, setHasKey] = useState(Boolean(initial.apiKey));
  const [draft, setDraft] = useState('');
  const [model, setModel] = useState(initial.model === DEFAULT_GEMINI_MODEL ? '' : initial.model);
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = () => {
    const key = draft.trim();
    if (!key && !hasKey) return;
    setAiConfig({ ...(key ? { apiKey: key } : {}), model: model.trim() });
    setHasKey(true);
    setDraft('');
    setSaved(true);
    soundManager.playToggle(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const clear = () => {
    setAiConfig({ apiKey: '', model: '' });
    setHasKey(false);
    setDraft('');
    setModel('');
    soundManager.playToggle(false);
  };

  const inputStyle = {
    backgroundColor: withOpacity(theme.text, 0.05),
    border: `1px solid ${withOpacity(theme.text, 0.1)}`,
    color: theme.text,
  };

  return (
    <div className="col-span-12 md:col-span-6 glass-panel rounded-3xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between" style={{ color }}>
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5" />
          <span className="text-sm font-bold">{t('ai.title')}</span>
        </div>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ backgroundColor: withOpacity(hasKey ? '#16a34a' : theme.text, 0.12), color: hasKey ? '#16a34a' : withOpacity(theme.text, 0.5) }}
        >
          {hasKey ? t('ai.configured') : t('ai.notConfigured')}
        </span>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={show ? 'text' : 'password'}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && save()}
            placeholder={hasKey ? t('ai.placeholder.saved') : t('ai.placeholder')}
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-xl pl-3 pr-9 py-2 text-xs outline-none"
            style={inputStyle}
          />
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 opacity-60 hover:opacity-100"
            style={{ color: theme.text }}
            aria-label={show ? t('ai.hide') : t('ai.show')}
          >
            {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
        <button
          onClick={save}
          className="px-3 rounded-xl text-xs font-bold text-white flex items-center gap-1"
          style={{ backgroundColor: color }}
        >
          <Check className="w-3.5 h-3.5" />{saved ? t('ai.saved') : t('ai.save')}
        </button>
        {hasKey && (
          <button
            onClick={clear}
            className="px-2 rounded-xl"
            style={{ ...inputStyle, color: '#dc2626' }}
            aria-label={t('ai.clear')}
            title={t('ai.clear')}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <input
        value={model}
        onChange={e => setModel(e.target.value)}
        placeholder={t('ai.model', { model: DEFAULT_GEMINI_MODEL })}
        className="w-full rounded-xl px-3 py-2 text-xs outline-none"
        style={inputStyle}
      />

      <p className="text-[10px] leading-relaxed" style={{ color: withOpacity(theme.text, 0.55) }}>
        {t('ai.note')}
        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 ml-1 font-bold underline-offset-2 hover:underline"
          style={{ color }}
        >
          {t('ai.getKey')} <ExternalLink className="w-3 h-3" />
        </a>
      </p>
    </div>
  );
}

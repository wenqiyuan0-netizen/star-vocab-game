import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { locales, LANGS } from './locales';

const STORAGE_KEY = 'star_vocab_lang';

export const detectLang = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && locales[saved]) return saved;
  } catch { }
  const nav = (typeof navigator !== 'undefined' && (navigator.languages?.[0] || navigator.language)) || 'zh';
  if (/^de/i.test(nav)) return 'de';
  if (/^zh/i.test(nav)) return 'zh';
  return 'en';
};

const interpolate = (str, vars) =>
  vars ? str.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : m)) : str;

// Usable outside React (services, plain functions). Reads the current language.
let currentLang = detectLang();
export const translate = (key, vars, lang = currentLang) => {
  const raw = locales[lang]?.[key] ?? locales.zh[key] ?? key;
  return interpolate(raw, vars);
};

const I18nContext = createContext({ lang: currentLang, setLang: () => { }, t: translate });

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(currentLang);

  const setLang = useCallback((next) => {
    if (!locales[next]) return;
    currentLang = next;
    try { localStorage.setItem(STORAGE_KEY, next); } catch { }
    setLangState(next);
  }, []);

  useEffect(() => {
    document.documentElement.lang = { zh: 'zh-CN', en: 'en', de: 'de' }[lang] || 'en';
  }, [lang]);

  const t = useCallback((key, vars) => translate(key, vars, lang), [lang]);
  const value = useMemo(() => ({ lang, setLang, t, langs: LANGS }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);

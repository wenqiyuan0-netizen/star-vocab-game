import React, { createContext, useContext, useState, useEffect, useMemo } from 'react'
import { extractPaletteFromImage, normalizePalette } from '../../utils/colorUtils'
// Theme constants
import { DEFAULT_WALLPAPER_URL } from '../constants/config'

const DEFAULT_THEME = {
  primary: 'rgb(79,70,229)',
  secondary: 'rgb(124,58,237)',
  accent: 'rgb(217,119,6)',
  background: 'rgb(244,242,236)',
  text: 'rgb(30,27,46)',
  overlay: 'rgb(248,247,243)',
  mode: 'light',
  analogous: [],
  mid: [],
  contrast: [],
  complementary: [],
  variants: { light: { analogous: [], mid: [], contrast: [], complementary: [] }, dark: { analogous: [], mid: [], contrast: [], complementary: [] } }
}

function parseRgb(str) {
  const m = typeof str === 'string' && str.startsWith('rgb') ? str.match(/\d+/g) : null
  return m ? m.slice(0, 3).map(Number) : [255, 255, 255]
}

function yiq(r, g, b) {
  const y = (r * 299 + g * 587 + b * 114) / 1000
  return y >= 128 ? '#000000' : '#FFFFFF'
}

function textOn(bg) {
  const [r, g, b] = parseRgb(bg)
  return yiq(r, g, b)
}

function pickMode(palette) {
  const prefersDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  const [r, g, b] = parseRgb(palette.background || palette.primary || '#000000')
  const y = (r * 299 + g * 587 + b * 114) / 1000
  const bgDark = y < 128
  const mode = prefersDark || bgDark ? 'dark' : 'light'
  return mode
}

function getThemeFromStorage() {
  try {
    const saved = localStorage.getItem('star-vocab-theme-palette')
    if (saved) {
      const parsed = normalizePalette(JSON.parse(saved))
      const mode = pickMode(parsed)
      const current = parsed.variants && parsed.variants[mode] ? parsed.variants[mode] : { analogous: [], mid: [], contrast: [], complementary: [] }
      const base = {
        primary: parsed.primary || DEFAULT_THEME.primary,
        secondary: parsed.secondary || DEFAULT_THEME.secondary,
        accent: parsed.accent || DEFAULT_THEME.accent,
        background: parsed.background || DEFAULT_THEME.background,
        text: parsed.text || textOn(parsed.background || parsed.primary || DEFAULT_THEME.background),
        overlay: parsed.overlay || DEFAULT_THEME.overlay,
        mode: parsed.mode || mode,
        analogous: parsed.analogous || current.analogous.map(x => x),
        mid: parsed.mid || current.mid.map(x => x),
        contrast: parsed.contrast || current.contrast.map(x => x),
        complementary: parsed.complementary || current.complementary.map(x => x),
        variants: parsed.variants || DEFAULT_THEME.variants
      }
      return base
    }
  } catch (e) {
    // ignore
  }
  return DEFAULT_THEME
}

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => getThemeFromStorage())

  useEffect(() => {
    const load = () => {
      setTheme(getThemeFromStorage())
    }
    
    const onStorage = () => load()
    const mm = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)')
    
    if (mm) mm.addEventListener('change', onStorage)
    window.addEventListener('storage', onStorage)
    window.addEventListener('theme-changed', onStorage)
    window.addEventListener('wallpaper-changed', onStorage)
    
    return () => {
      window.removeEventListener('storage', onStorage)
      if (mm) mm.removeEventListener('change', onStorage)
      window.removeEventListener('theme-changed', onStorage)
      window.removeEventListener('wallpaper-changed', onStorage)
    }
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem('star-vocab-theme-palette')
    if (!saved) {
      const storedWall = localStorage.getItem('star-vocab-wallpaper-system')
      const url = storedWall || DEFAULT_WALLPAPER_URL
      if (!storedWall) {
        localStorage.setItem('star-vocab-wallpaper-system', url)
        window.dispatchEvent(new Event('wallpaper-changed'))
      }
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        extractPaletteFromImage(img).then(palette => {
          localStorage.setItem('star-vocab-theme-palette', JSON.stringify(palette))
          const mode = pickMode(palette)
          const current = palette.variants && palette.variants[mode] ? palette.variants[mode] : { analogous: [], mid: [], contrast: [], complementary: [] }
          setTheme({
            primary: palette.primary,
            secondary: palette.secondary,
            accent: palette.accent,
            background: palette.background,
            text: palette.text || textOn(palette.background || palette.primary || DEFAULT_THEME.background),
            overlay: palette.overlay,
            mode: palette.mode || mode,
            analogous: palette.analogous || current.analogous,
            mid: palette.mid || current.mid,
            contrast: palette.contrast || current.contrast,
            complementary: palette.complementary || current.complementary,
            variants: palette.variants || DEFAULT_THEME.variants
          })
          window.dispatchEvent(new Event('theme-changed'))
        })
      }
      img.onerror = () => {
        // Fallback to default theme if image fails to load
        localStorage.setItem('star-vocab-theme-palette', JSON.stringify(DEFAULT_THEME))
        setTheme({ ...DEFAULT_THEME })
        window.dispatchEvent(new Event('theme-changed'))
      }
      img.src = url
    }
  }, [])

  // Expose theme to plain CSS (glass panels, focus rings, scrollbars)
  useEffect(() => {
    const root = document.documentElement
    const light = (theme.mode || 'light') === 'light'
    root.dataset.themeMode = light ? 'light' : 'dark'
    root.style.setProperty('--theme-primary', theme.primary)
    root.style.setProperty('--theme-accent', theme.accent)
    root.style.setProperty('--theme-text', theme.text)
    // Glass panels are the same family as cards: the card surface, slightly translucent.
    root.style.setProperty('--glass-bg', light ? 'rgba(252,251,248,0.80)' : 'rgba(28,27,38,0.78)')
    root.style.setProperty('--glass-bg-hover', light ? 'rgba(252,251,248,0.92)' : 'rgba(34,33,46,0.88)')
    root.style.setProperty('--glass-border', light ? 'rgba(30,27,46,0.07)' : 'rgba(255,255,255,0.10)')
    root.style.setProperty('--glass-shadow', light ? '0 1px 2px rgba(30,27,46,0.05), 0 8px 24px -12px rgba(30,27,46,0.16)' : '0 1px 2px rgba(0,0,0,0.4), 0 10px 28px -12px rgba(0,0,0,0.6)')
    // Unified card system: one surface, one border, two elevations, one scrim.
    root.style.setProperty('--card-surface', light ? 'rgba(252,251,248,0.97)' : 'rgba(28,27,38,0.97)')
    root.style.setProperty('--card-surface-muted', light ? 'rgba(30,27,46,0.04)' : 'rgba(255,255,255,0.05)')
    root.style.setProperty('--card-border', light ? 'rgba(30,27,46,0.08)' : 'rgba(255,255,255,0.10)')
    root.style.setProperty('--card-shadow', light ? '0 1px 2px rgba(30,27,46,0.06), 0 4px 12px -6px rgba(30,27,46,0.12)' : '0 1px 2px rgba(0,0,0,0.4), 0 6px 16px -8px rgba(0,0,0,0.6)')
    root.style.setProperty('--card-shadow-lg', light ? '0 24px 60px -20px rgba(30,27,46,0.35), 0 2px 6px rgba(30,27,46,0.06)' : '0 28px 70px -20px rgba(0,0,0,0.8)')
    root.style.setProperty('--scrim', light ? 'rgba(24,22,36,0.32)' : 'rgba(0,0,0,0.55)')
  }, [theme])

  const roles = useMemo(() => ({
    background: theme.background,
    overlay: theme.overlay,
    textOnBackground: textOn(theme.background),
    buttonPrimaryBg: theme.primary,
    buttonPrimaryText: textOn(theme.primary),
    cardHeader: theme.contrast[0] || theme.accent,
    border: (theme.contrast[0] || theme.secondary) + '4d'
  }), [theme])

  const gradients = useMemo(() => ({
    primary: `linear-gradient(to right, ${theme.primary}, ${theme.secondary})`,
    score: `linear-gradient(to right, ${theme.primary}, ${theme.accent})`,
    surface: `linear-gradient(to bottom right, ${theme.secondary}1A, ${theme.primary}0D)`
  }), [theme])

  const value = useMemo(() => ({ ...theme, roles, gradients }), [theme, roles, gradients])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    // Fallback for components used outside of ThemeProvider (if any)
    // We reconstruct the default object structure to prevent crashes
    const roles = {
      background: DEFAULT_THEME.background,
      overlay: DEFAULT_THEME.overlay,
      textOnBackground: textOn(DEFAULT_THEME.background),
      buttonPrimaryBg: DEFAULT_THEME.primary,
      buttonPrimaryText: textOn(DEFAULT_THEME.primary),
      cardHeader: DEFAULT_THEME.accent,
      border: DEFAULT_THEME.secondary + '4d'
    }
    const gradients = {
      primary: `linear-gradient(to right, ${DEFAULT_THEME.primary}, ${DEFAULT_THEME.secondary})`,
      score: `linear-gradient(to right, ${DEFAULT_THEME.primary}, ${DEFAULT_THEME.accent})`,
      surface: `linear-gradient(to bottom right, ${DEFAULT_THEME.secondary}1A, ${DEFAULT_THEME.primary}0D)`
    }
    return { ...DEFAULT_THEME, roles, gradients }
  }
  return context
}

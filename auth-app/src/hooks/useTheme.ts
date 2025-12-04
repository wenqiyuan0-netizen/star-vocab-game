'use client'
import { useState, useEffect } from 'react'
import { adjustColorBrightness } from '@/utils/colorUtils'

const DEFAULT_THEME = {
  primary: '#7c3aed',
  secondary: '#475569',
  accent: '#db2777',
  background: '#0f172a',
  text: '#ffffff',
  overlay: '#5b21b6'
}

type BaseTheme = typeof DEFAULT_THEME
type Theme = BaseTheme & { gradients: { primary: string; score: string; surface: string } }

export function useTheme(): Theme {
  const [theme, setTheme] = useState<BaseTheme>(DEFAULT_THEME)

  useEffect(() => {
    const loadTheme = () => {
      try {
        const saved = localStorage.getItem('star-vocab-theme-palette')
        if (saved) {
          const parsed = JSON.parse(saved)
          if (parsed.primary) parsed.overlay = adjustColorBrightness(parsed.primary)
          setTheme(parsed)
        } else {
          setTheme(DEFAULT_THEME)
        }
      } catch (e) {
        setTheme(DEFAULT_THEME)
      }
    }
    loadTheme()
    const handler = () => loadTheme()
    window.addEventListener('storage', handler)
    return () => {
      window.removeEventListener('storage', handler)
    }
  }, [])

  const extended: Theme = {
    ...theme,
    gradients: {
      primary: `linear-gradient(to right, ${theme.primary}, ${theme.secondary})`,
      score: `linear-gradient(to right, ${theme.primary}, ${theme.accent})`,
      surface: `linear-gradient(to bottom right, ${theme.secondary}1A, ${theme.primary}0D)`
    }
  }

  return extended
}

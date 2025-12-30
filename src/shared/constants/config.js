const getBackendUrl = () => {
  const stored = typeof window !== 'undefined' ? localStorage.getItem('star-vocab-backend') : null
  if (stored && typeof stored === 'string' && stored.trim()) return stored.trim()
  const env = process.env.REACT_APP_BACKEND_URL
  if (env && typeof env === 'string' && env.trim()) return env.trim()
  // Fallback to production URL if env is missing
  return 'https://vokmatch-backend.vercel.app'
}

export const BACKEND_URL = getBackendUrl()

const getDefaultWallpaperUrl = () => {
  const base = process.env.PUBLIC_URL || ''
  // Use the new default wallpaper
  return `${base}/wallpapers/default.jpg`
}

export const DEFAULT_WALLPAPER_URL = getDefaultWallpaperUrl()

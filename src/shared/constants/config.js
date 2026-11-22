// Build-time switches.
// REACT_APP_OFFLINE=true produces a pure local build (used for the desktop .exe):
// no login, no cloud sync, everything stays in localStorage.
export const IS_OFFLINE_BUILD = process.env.REACT_APP_OFFLINE === 'true'

export const CLOUD_CONFIGURED = Boolean(
  !IS_OFFLINE_BUILD &&
  process.env.REACT_APP_SUPABASE_URL &&
  process.env.REACT_APP_SUPABASE_ANON_KEY
)

const getDefaultWallpaperUrl = () => {
  const base = process.env.PUBLIC_URL || ''
  return `${base}/wallpapers/default.jpg`
}

export const DEFAULT_WALLPAPER_URL = getDefaultWallpaperUrl()

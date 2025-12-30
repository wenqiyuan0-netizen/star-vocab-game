const getBackendUrl = () => {
  // 优先级1: localStorage（开发测试用）
  const stored = typeof window !== 'undefined' ? localStorage.getItem('star-vocab-backend') : null
  if (stored && typeof stored === 'string' && stored.trim()) return stored.trim()

  // 优先级2: 环境变量
  const env = process.env.REACT_APP_BACKEND_URL
  if (env && typeof env === 'string' && env.trim()) return env.trim()

  // 优先级3: 硬编码生产URL（先试旧的，因为旧的现在能用）
  return 'https://star-vocab-game-amzy.vercel.app'
}

export const BACKEND_URL = getBackendUrl()

const getDefaultWallpaperUrl = () => {
  const base = process.env.PUBLIC_URL || ''
  // Use the new default wallpaper
  return `${base}/wallpapers/default.jpg`
}

export const DEFAULT_WALLPAPER_URL = getDefaultWallpaperUrl()

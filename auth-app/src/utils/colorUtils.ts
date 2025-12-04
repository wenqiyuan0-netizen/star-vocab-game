export function withOpacity(color: string | undefined, alpha = 1) {
  if (!color) return `rgba(0,0,0,${alpha})`
  if (color.startsWith('rgb(')) {
    const nums = color.match(/\d+/g)
    if (!nums) return `rgba(0,0,0,${alpha})`
    const [r, g, b] = nums.map(Number)
    return `rgba(${r},${g},${b},${alpha})`
  }
  if (color.startsWith('#')) {
    const hex = color.replace('#', '')
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)
    return `rgba(${r},${g},${b},${alpha})`
  }
  return color
}

export function glassStyle(baseColor: string, alpha = 0.3, blurPx = 10, borderAlpha = 0.5) {
  const bg = withOpacity(baseColor, alpha)
  const border = withOpacity(baseColor, borderAlpha)
  return {
    backgroundColor: bg,
    backdropFilter: `blur(${blurPx}px)`,
    WebkitBackdropFilter: `blur(${blurPx}px)`,
    border: `1px solid ${border}`
  }
}

export function adjustColorBrightness(hexOrRgb: string | number[] | undefined, targetBrightness = 0.5) {
  let r: number | undefined, g: number | undefined, b: number | undefined
  if (typeof hexOrRgb === 'string' && hexOrRgb.startsWith('#')) {
    const hex = hexOrRgb.replace('#', '')
    r = parseInt(hex.substring(0, 2), 16)
    g = parseInt(hex.substring(2, 4), 16)
    b = parseInt(hex.substring(4, 6), 16)
  } else if (typeof hexOrRgb === 'string' && hexOrRgb.startsWith('rgb')) {
    const match = hexOrRgb.match(/\d+/g)
    if (match) {
      ;[r, g, b] = match.map(Number)
    }
  } else if (Array.isArray(hexOrRgb)) {
    ;[r, g, b] = hexOrRgb
  }
  if (r === undefined) return '#5b21b6'
  const currentBrightness = (r * 299 + g! * 587 + b! * 114) / 1000
  if (currentBrightness < 50) {
    const mixFactor = 0.6
    r = Math.floor(r + (255 - r) * mixFactor)
    g = Math.floor(g! + (255 - g!) * mixFactor)
    b = Math.floor(b! + (255 - b!) * mixFactor)
  } else if (currentBrightness < 100) {
    const mixFactor = 0.4
    r = Math.floor(r + (255 - r) * mixFactor)
    g = Math.floor(g! + (255 - g!) * mixFactor)
    b = Math.floor(b! + (255 - b!) * mixFactor)
  }
  return `rgb(${r},${g},${b})`
}

import { rgbToHsl, hslToRgb, getBrightestVariant, adjustColorBrightness, generateAnalogousColor, parseColorToRgb } from './colorUtils'

test('rgbToHsl and hslToRgb roundtrip', () => {
  const samples = [
    [0, 0, 0],
    [255, 255, 255],
    [124, 58, 237],
    [219, 39, 119],
    [15, 23, 42]
  ]
  for (const [r, g, b] of samples) {
    const [h, s, l] = rgbToHsl(r, g, b)
    const [rr, gg, bb] = hslToRgb(h, s, l)
    expect(Math.abs(rr - r)).toBeLessThan(2)
    expect(Math.abs(gg - g)).toBeLessThan(2)
    expect(Math.abs(bb - b)).toBeLessThan(2)
  }
})

test('getBrightestVariant increases brightness', () => {
  const dark = 'rgb(30,30,30)'
  const bright = getBrightestVariant(dark, 0.85)
  const [dr, dg, db] = parseColorToRgb(dark)
  const [br, bg, bb] = parseColorToRgb(bright)
  const dY = (dr * 299 + dg * 587 + db * 114) / 1000
  const bY = (br * 299 + bg * 587 + bb * 114) / 1000
  expect(bY).toBeGreaterThan(dY)
})

test('adjustColorBrightness lifts very dark colors', () => {
  const darkHex = '#101010'
  const adjusted = adjustColorBrightness(darkHex)
  const [dr, dg, db] = parseColorToRgb(darkHex)
  const [ar, ag, ab] = parseColorToRgb(adjusted)
  const dY = (dr * 299 + dg * 587 + db * 114) / 1000
  const aY = (ar * 299 + ag * 587 + ab * 114) / 1000
  expect(aY).toBeGreaterThan(dY)
})

test('generateAnalogousColor returns rgba string', () => {
  const c = generateAnalogousColor('rgb(124,58,237)', 30, 0.9)
  expect(typeof c).toBe('string')
  expect(c.startsWith('rgba(')).toBe(true)
})


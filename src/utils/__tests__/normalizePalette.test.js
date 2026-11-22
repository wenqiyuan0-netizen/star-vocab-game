import { normalizePalette, parseColorToRgb } from '../colorUtils';

// WCAG relative luminance / contrast, independent of the implementation under test
const lum = (c) => {
  const [r, g, b] = parseColorToRgb(c).map(v => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// Raw extraction output: dominant color is stored as `primary`
const raw = (dominant, others = []) => ({
  primary: dominant,
  secondary: others[0] || dominant,
  accent: others[1] || dominant,
  background: others[2] || dominant,
  analogous: [], mid: [], contrast: [], complementary: [],
});

describe('normalizePalette', () => {
  const cases = {
    'near-white monochrome wallpaper (the old bug)': raw('rgb(240,240,224)', ['rgb(192,176,160)']),
    'pure white': raw('rgb(255,255,255)'),
    'dark night sky': raw('rgb(12,14,30)', ['rgb(40,60,120)', 'rgb(200,160,60)']),
    'saturated mid-tone': raw('rgb(30,120,200)', ['rgb(240,90,40)']),
    'grey': raw('rgb(128,128,128)'),
  };

  Object.entries(cases).forEach(([name, input]) => {
    it(`guarantees readable colors for ${name}`, () => {
      const p = normalizePalette(input);
      // Mid-tone backgrounds cap out below 7:1 even with pure black/white, so assert WCAG AA.
      expect(contrast(p.text, p.background)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.primary, p.background)).toBeGreaterThanOrEqual(3);
      expect(contrast(p.accent, p.background)).toBeGreaterThanOrEqual(3);
      expect(['light', 'dark']).toContain(p.mode);
    });
  });

  it('keeps the wallpaper dominant color as background', () => {
    const p = normalizePalette(raw('rgb(240,240,224)'));
    expect(parseColorToRgb(p.background)).toEqual([240, 240, 224]);
    expect(p.mode).toBe('light');
  });

  it('is idempotent', () => {
    const once = normalizePalette(raw('rgb(240,240,224)', ['rgb(192,176,160)']));
    expect(normalizePalette(once)).toEqual(once);
  });
});

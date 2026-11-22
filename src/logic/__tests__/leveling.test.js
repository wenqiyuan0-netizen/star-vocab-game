import { calculateLevel, getXPForLevel, levelProgress } from '../leveling';

describe('leveling', () => {
  it('maps XP thresholds to levels exactly', () => {
    expect(calculateLevel(0)).toBe(1);
    expect(calculateLevel(999)).toBe(1);
    expect(calculateLevel(1000)).toBe(2);
    expect(calculateLevel(2999)).toBe(2);
    expect(calculateLevel(3000)).toBe(3);
    expect(calculateLevel(6000)).toBe(4);
  });

  it('is the inverse of getXPForLevel for every level up to 200', () => {
    for (let l = 1; l <= 200; l++) {
      expect(calculateLevel(getXPForLevel(l))).toBe(l);
    }
    for (let l = 2; l <= 200; l++) {
      expect(calculateLevel(getXPForLevel(l) - 1)).toBe(l - 1);
    }
  });

  it('never goes down as XP grows', () => {
    let prev = 1;
    for (let xp = 0; xp < 50000; xp += 37) {
      const l = calculateLevel(xp);
      expect(l).toBeGreaterThanOrEqual(prev);
      prev = l;
    }
  });

  it('handles bad input safely', () => {
    expect(calculateLevel(-50)).toBe(1);
    expect(calculateLevel(undefined)).toBe(1);
    expect(calculateLevel('abc')).toBe(1);
  });

  it('reports progress inside the current level', () => {
    expect(levelProgress(1500)).toEqual({ level: 2, intoLevel: 500, span: 2000, ratio: 0.25 });
    const p = levelProgress(0);
    expect(p.level).toBe(1);
    expect(p.ratio).toBe(0);
  });
});

// Leveling curve: reaching level L needs 500 * (L^2 - L) total XP
// (L2 = 1000, L3 = 3000, L4 = 6000, ...). Level is always derived from XP.

export const getXPForLevel = (level) => 500 * (level * level - level);

export const calculateLevel = (xp) => {
  const safe = Math.max(0, Number(xp) || 0);
  let level = Math.floor((1 + Math.sqrt(1 + safe / 125)) / 2);
  // Guard against floating-point edge cases right at a threshold.
  while (getXPForLevel(level + 1) <= safe) level += 1;
  while (level > 1 && getXPForLevel(level) > safe) level -= 1;
  return Math.max(1, level);
};

export const levelProgress = (xp) => {
  const safe = Math.max(0, Number(xp) || 0);
  const level = calculateLevel(safe);
  const base = getXPForLevel(level);
  const next = getXPForLevel(level + 1);
  return { level, intoLevel: safe - base, span: next - base, ratio: (safe - base) / (next - base) };
};

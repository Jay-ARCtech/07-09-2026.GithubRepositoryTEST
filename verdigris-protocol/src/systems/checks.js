// Skill checks: d20 + stat vs DC (5e's math, see RESEARCH.md §18). Odds are
// always computed and shown before the player commits — DESIGN.md §3's
// fairness rule made concrete: nothing here is a hidden roll.

export const DC = { easy: 8, medium: 12, hard: 16, certain: 0 };

/** Cyberware spends Essence against Empathy while equipped — the one
 * passive stat cost on gear (bio-augments cost Bloomstrain on use instead,
 * handled in combat.js/content resolution, not here). */
export function effectiveStats(character, items) {
  const base = { ...character.stats };
  const essenceSpent = (character.equipped?.cyberware || [])
    .map((id) => items[id]?.essenceCost || 0)
    .reduce((a, b) => a + b, 0);
  return { ...base, empathy: Math.max(0, base.empathy - essenceSpent) };
}

export function successProbability(statValue, difficulty) {
  if (difficulty === 'certain') return 1;
  const dc = DC[difficulty] ?? DC.medium;
  const needed = dc - statValue; // roll >= needed to succeed
  const p = (21 - needed) / 20;
  return Math.max(0.05, Math.min(0.97, p));
}

export function oddsBand(statValue, difficulty) {
  if (difficulty === 'certain') return 'certain';
  const p = successProbability(statValue, difficulty);
  if (p >= 0.72) return 'good';
  if (p >= 0.42) return 'fair';
  return 'poor';
}

export function oddsLabel(band) {
  return { good: 'Good odds', fair: 'Fair odds', poor: 'Poor odds', certain: 'No roll' }[band] || 'Fair odds';
}

/** Resolves a d20 + stat check against a difficulty. Always logs what
 * happened in plain terms so a failure is explainable, never opaque. */
export function resolveCheck(rng, statValue, difficulty) {
  if (difficulty === 'certain') return { success: true, roll: null, dc: 0, statValue, certain: true };
  const dc = DC[difficulty] ?? DC.medium;
  const roll = rng.d20();
  const total = roll + statValue;
  return { success: total >= dc, roll, dc, statValue, total, certain: false };
}

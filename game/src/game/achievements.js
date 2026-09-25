export const ACHIEVEMENTS = {
  first_blood: { name: "First Blood", desc: "Kill your first enemy." },
  survivor_5: { name: "Getting the Hang of It", desc: "Survive 5 minutes in one run." },
  survivor_15: { name: "Veteran", desc: "Survive 15 minutes in one run." },
  boss_slayer: { name: "Boss Slayer", desc: "Defeat a boss." },
  triple_boss: { name: "Cycle Breaker", desc: "Defeat three bosses in one run." },
  evolved: { name: "Evolution", desc: "Evolve a weapon." },
  chest_hoarder: { name: "Chest Hoarder", desc: "Open 10 chests across all runs." },
  cores_1000: { name: "Well Funded", desc: "Accumulate 1000 total Cores." },
  daily_win: { name: "Daily Grind", desc: "Complete a Daily Challenge run." },
  no_hit_boss: { name: "Untouchable", desc: "Defeat a boss without taking damage during the fight." },
};

export function unlockAchievement(meta, id, onUnlock) {
  if (meta.achievements[id]) return false;
  meta.achievements[id] = { unlockedAt: Date.now() };
  onUnlock?.(ACHIEVEMENTS[id]);
  return true;
}

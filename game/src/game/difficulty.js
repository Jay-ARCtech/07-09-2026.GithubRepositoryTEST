// Twelve selectable Survival-mode difficulties. Each is a small bundle of
// knobs -- a spawn-weight table plus pacing/power/elite/obstacle
// multipliers -- consumed by director.js (composition + pacing),
// enemies.js/bosses.js (hp/dmg/elite-chance), and scenery.js (obstacle
// density). Picking a difficulty never branches gameplay code by name; it
// only changes which numbers/table gets plugged into systems that already
// exist. War Mode and the Daily Challenge never set world.difficultyId, so
// getDifficultyMods() falls back to "hard" for them -- today's behavior,
// unchanged.

// Walks an ordered [maxTime, table] list and returns the first table whose
// maxTime the given time is still under (last entry should be Infinity).
function tieredTable(t, tiers) {
  for (const [maxT, table] of tiers) {
    if (t < maxT) return table;
  }
  return tiers[tiers.length - 1][1];
}

// The original tuning this whole game shipped with -- kept verbatim as the
// "Hard" difficulty and reused by God's War/Gauntlet/Elite Uprising, which
// only change power/obstacle/elite knobs, not composition.
function hardWeightTable(t) {
  return tieredTable(t, [
    [30, { grunt: 55, runner: 25, shooter: 12, skirmisher: 8 }],
    [75, { grunt: 34, runner: 18, tank: 10, shooter: 14, skirmisher: 10, splitter: 8, gatling: 8, healer: 4, mimic: 4 }],
    [
      150,
      {
        grunt: 22,
        runner: 14,
        tank: 12,
        shooter: 10,
        skirmisher: 8,
        splitter: 8,
        gatling: 8,
        sniper: 6,
        launcher: 6,
        heavyGunner: 6,
        healer: 5,
        summoner: 5,
        engineer: 5,
        mimic: 6,
      },
    ],
    [
      300,
      {
        grunt: 16,
        runner: 12,
        tank: 12,
        shooter: 9,
        skirmisher: 7,
        splitter: 8,
        gatling: 9,
        sniper: 8,
        launcher: 7,
        heavyGunner: 8,
        siegeCannon: 4,
        healer: 6,
        summoner: 6,
        engineer: 6,
        mimic: 8,
      },
    ],
    [
      Infinity,
      {
        grunt: 14,
        runner: 10,
        tank: 12,
        shooter: 9,
        skirmisher: 7,
        splitter: 8,
        gatling: 9,
        sniper: 9,
        launcher: 8,
        heavyGunner: 8,
        siegeCannon: 6,
        healer: 6,
        summoner: 6,
        engineer: 6,
        mimic: 9,
      },
    ],
  ]);
}

// Tougher archetypes exist in the table far earlier than Hard's, but at
// low weight and gated behind long windows -- when they do show up, it's
// in trickles, never in force.
function easyWeightTable(t) {
  return tieredTable(t, [
    [90, { grunt: 60, runner: 26, shooter: 10, skirmisher: 4 }],
    [240, { grunt: 46, runner: 22, shooter: 12, skirmisher: 6, tank: 6, splitter: 5, gatling: 3 }],
    [
      420,
      { grunt: 38, runner: 20, shooter: 12, skirmisher: 6, tank: 7, splitter: 6, gatling: 4, healer: 3, mimic: 3, sniper: 1, launcher: 1 },
    ],
    [
      720,
      {
        grunt: 32,
        runner: 18,
        shooter: 11,
        skirmisher: 6,
        tank: 8,
        splitter: 6,
        gatling: 5,
        healer: 4,
        mimic: 4,
        sniper: 2,
        launcher: 2,
        heavyGunner: 1,
        summoner: 1,
        engineer: 1,
      },
    ],
    [
      Infinity,
      {
        grunt: 28,
        runner: 16,
        shooter: 10,
        skirmisher: 6,
        tank: 8,
        splitter: 6,
        gatling: 6,
        healer: 4,
        mimic: 5,
        sniper: 3,
        launcher: 3,
        heavyGunner: 2,
        summoner: 2,
        engineer: 2,
        siegeCannon: 1,
      },
    ],
  ]);
}

// Slower version of Hard's ramp, plus a graduation mechanic: each boss kill
// bumps world.difficultyState.gradLevel (see onBossKilled below), and every
// bump permanently strikes the next tier of "basics" out of the table --
// after the first boss, no more grunt/runner/shooter; after the second, no
// more skirmisher/tank either. What's left is the harder roster, unlocked
// by clearing fights rather than by the clock.
const NORMAL_GRADUATION_TIERS = [
  ["grunt", "runner", "shooter"],
  ["skirmisher", "tank"],
];

function normalBaseTable(t) {
  return tieredTable(t, [
    [60, { grunt: 46, runner: 22, shooter: 14, skirmisher: 8 }],
    [150, { grunt: 30, runner: 18, tank: 10, shooter: 14, skirmisher: 9, splitter: 7, gatling: 6, healer: 3, mimic: 3 }],
    [
      300,
      {
        grunt: 20,
        runner: 14,
        tank: 12,
        shooter: 11,
        skirmisher: 8,
        splitter: 8,
        gatling: 8,
        sniper: 4,
        launcher: 4,
        heavyGunner: 4,
        healer: 4,
        summoner: 4,
        engineer: 4,
        mimic: 5,
      },
    ],
    [
      Infinity,
      {
        grunt: 14,
        runner: 11,
        tank: 12,
        shooter: 10,
        skirmisher: 7,
        splitter: 8,
        gatling: 9,
        sniper: 7,
        launcher: 6,
        heavyGunner: 7,
        siegeCannon: 3,
        healer: 5,
        summoner: 5,
        engineer: 5,
        mimic: 8,
      },
    ],
  ]);
}

function normalWeightTable(t, world) {
  const table = { ...normalBaseTable(t) };
  const gradLevel = world?.difficultyState?.gradLevel || 0;
  for (let i = 0; i < Math.min(gradLevel, NORMAL_GRADUATION_TIERS.length); i++) {
    for (const id of NORMAL_GRADUATION_TIERS[i]) delete table[id];
  }
  if (Object.keys(table).length === 0) table.mimic = 1; // never hand back an empty table
  return table;
}

function normalOnBossKilled(world) {
  world.difficultyState = world.difficultyState || { gradLevel: 0 };
  world.difficultyState.gradLevel += 1;
}

// No ramp at all -- every archetype is already at a meaningful weight from
// the moment the run starts.
function nightmareWeightTable(t) {
  return {
    grunt: 12,
    runner: 10,
    tank: 9,
    shooter: 9,
    skirmisher: 7,
    splitter: 8,
    gatling: 8,
    sniper: 7,
    launcher: 7,
    heavyGunner: 7,
    siegeCannon: 5 + Math.min(4, t / 120),
    healer: 6,
    summoner: 6,
    engineer: 6,
    mimic: 8 + Math.min(6, t / 90),
  };
}

// cloneMode forces every spawn through spawnMimicEnemy regardless of the
// weighted pick, so this table is only a fallback for any caller that
// doesn't check cloneMode first.
function cloneWeightTable() {
  return { mimic: 1 };
}

// Engineers dropping hazards backed by long-range gunners -- the field
// itself becomes half the threat.
function engineerCorpsWeightTable(t) {
  return tieredTable(t, [
    [60, { grunt: 30, runner: 14, shooter: 16, engineer: 12, skirmisher: 8, gatling: 8 }],
    [180, { grunt: 18, runner: 10, shooter: 14, engineer: 16, skirmisher: 8, gatling: 12, sniper: 10, launcher: 8, tank: 4 }],
    [
      Infinity,
      {
        grunt: 10,
        runner: 8,
        shooter: 12,
        engineer: 18,
        skirmisher: 6,
        gatling: 12,
        sniper: 14,
        launcher: 12,
        heavyGunner: 10,
        siegeCannon: 6,
        tank: 4,
        mimic: 6,
      },
    ],
  ]);
}

// Glass-cannon numbers: weak individually (hpMult/dmgMult below cut them
// down further), but the sheer volume is the threat.
function swarmWeightTable(t) {
  return tieredTable(t, [
    [90, { grunt: 70, runner: 26, splitter: 4 }],
    [240, { grunt: 62, runner: 24, splitter: 10, skirmisher: 4 }],
    [Infinity, { grunt: 55, runner: 22, splitter: 14, skirmisher: 5, shooter: 4 }],
  ]);
}

// The inverse of Swarm: far fewer spawns, but almost everything that shows
// up is heavy artillery.
function siegeWeightTable(t) {
  return tieredTable(t, [
    [90, { tank: 30, launcher: 20, grunt: 20, shooter: 10 }],
    [240, { tank: 22, launcher: 22, siegeCannon: 10, heavyGunner: 14, grunt: 14, shooter: 8 }],
    [Infinity, { tank: 16, launcher: 20, siegeCannon: 20, heavyGunner: 18, grunt: 10, shooter: 6, mimic: 4 }],
  ]);
}

// Healers and Summoners keep the horde topped up and reinforced -- letting
// them live is what actually kills you here, not their own hitbox.
function supportOverdriveWeightTable(t) {
  return tieredTable(t, [
    [90, { grunt: 34, runner: 18, healer: 14, summoner: 12, shooter: 12 }],
    [240, { grunt: 24, runner: 14, healer: 18, summoner: 16, engineer: 10, shooter: 10, tank: 8 }],
    [Infinity, { grunt: 18, runner: 12, healer: 20, summoner: 18, engineer: 12, shooter: 8, tank: 8, gatling: 4 }],
  ]);
}

export const DIFFICULTIES = {
  easy: {
    id: "easy",
    name: "Easy",
    tagline: "Tougher troops trickle in late, and never in force.",
    color: "#4ade80",
    icon: "●",
    weightTableForTime: easyWeightTable,
    spawnBudgetMult: 0.7,
    spawnIntervalMult: 1.25,
    hpMult: 0.85,
    dmgMult: 0.85,
    eliteChanceMult: 0.6,
    obstacleMult: 1,
  },
  normal: {
    id: "normal",
    name: "Normal",
    tagline: "A steady climb -- clearing bosses graduates the horde off the basics.",
    color: "#7dd3fc",
    icon: "◐",
    weightTableForTime: normalWeightTable,
    spawnBudgetMult: 0.85,
    spawnIntervalMult: 1.1,
    hpMult: 1,
    dmgMult: 1,
    eliteChanceMult: 1,
    obstacleMult: 1,
    onBossKilled: normalOnBossKilled,
  },
  hard: {
    id: "hard",
    name: "Hard",
    tagline: "The standard fight. No favors.",
    color: "#f87171",
    icon: "◆",
    weightTableForTime: hardWeightTable,
    spawnBudgetMult: 1,
    spawnIntervalMult: 1,
    hpMult: 1,
    dmgMult: 1,
    eliteChanceMult: 1,
    obstacleMult: 1,
  },
  nightmare: {
    id: "nightmare",
    name: "Nightmare",
    tagline: "Every archetype is live the moment you spawn in.",
    color: "#7c3aed",
    icon: "☠",
    weightTableForTime: nightmareWeightTable,
    spawnBudgetMult: 1.6,
    spawnIntervalMult: 0.7,
    hpMult: 1.1,
    dmgMult: 1.15,
    eliteChanceMult: 1.5,
    obstacleMult: 1,
  },
  godsWar: {
    id: "godsWar",
    name: "God's War",
    tagline: "Normal composition and pace -- but every hit lands twice as hard, from a horde twice as tough.",
    color: "#fbbf24",
    icon: "⚡",
    weightTableForTime: hardWeightTable,
    spawnBudgetMult: 1,
    spawnIntervalMult: 1,
    hpMult: 2,
    dmgMult: 2,
    eliteChanceMult: 1,
    obstacleMult: 1,
  },
  clone: {
    id: "clone",
    name: "Clone",
    tagline: "Every enemy is a mirror of you -- your weapons, your drones, your build, growing as you do.",
    color: "#22d3ee",
    icon: "☻",
    weightTableForTime: cloneWeightTable,
    cloneMode: true,
    spawnBudgetMult: 0.8,
    spawnIntervalMult: 1,
    hpMult: 1,
    dmgMult: 1,
    eliteChanceMult: 0,
    obstacleMult: 1,
  },
  gauntlet: {
    id: "gauntlet",
    name: "Gauntlet",
    tagline: "The rooftop is packed with billboards and pylons -- half the fight is finding room to move.",
    color: "#a3a3a3",
    icon: "▦",
    weightTableForTime: hardWeightTable,
    spawnBudgetMult: 0.9,
    spawnIntervalMult: 1,
    hpMult: 1,
    dmgMult: 1,
    eliteChanceMult: 1,
    obstacleMult: 2.4,
  },
  engineerCorps: {
    id: "engineerCorps",
    name: "Engineer Corps",
    tagline: "Hazard-dropping Engineers backed by long-range gunners dominate the field.",
    color: "#f472b6",
    icon: "⛭",
    weightTableForTime: engineerCorpsWeightTable,
    spawnBudgetMult: 1,
    spawnIntervalMult: 1,
    hpMult: 1,
    dmgMult: 1,
    eliteChanceMult: 1,
    obstacleMult: 1,
  },
  swarm: {
    id: "swarm",
    name: "Swarm",
    tagline: "Glass-cannon numbers -- weak alone, relentless in the mass.",
    color: "#fb923c",
    icon: "≡",
    weightTableForTime: swarmWeightTable,
    spawnBudgetMult: 2.2,
    spawnIntervalMult: 0.55,
    hpMult: 0.6,
    dmgMult: 0.7,
    eliteChanceMult: 0.4,
    obstacleMult: 1,
  },
  siege: {
    id: "siege",
    name: "Siege",
    tagline: "Far fewer enemies, but every one of them is heavy artillery.",
    color: "#fbbf24",
    icon: "◙",
    weightTableForTime: siegeWeightTable,
    spawnBudgetMult: 0.55,
    spawnIntervalMult: 1.5,
    hpMult: 1.2,
    dmgMult: 1.3,
    eliteChanceMult: 1,
    obstacleMult: 1,
  },
  eliteUprising: {
    id: "eliteUprising",
    name: "Elite Uprising",
    tagline: "Nearly every enemy rolls elite -- bigger, tankier, and worth every bit of the fight.",
    color: "#facc15",
    icon: "★",
    weightTableForTime: hardWeightTable,
    spawnBudgetMult: 0.9,
    spawnIntervalMult: 1.1,
    hpMult: 1,
    dmgMult: 1.05,
    eliteChanceMult: 4,
    obstacleMult: 1,
  },
  supportOverdrive: {
    id: "supportOverdrive",
    name: "Support Overdrive",
    tagline: "Healers and Summoners keep reinforcing the line -- focus fire or get swarmed.",
    color: "#86efac",
    icon: "✚",
    weightTableForTime: supportOverdriveWeightTable,
    spawnBudgetMult: 1.1,
    spawnIntervalMult: 0.95,
    hpMult: 1,
    dmgMult: 1,
    eliteChanceMult: 1,
    obstacleMult: 1,
  },
};

// Display order for the difficulty-select screen: baseline progression
// first (easy -> hard -> nightmare), then the flavor/game-mode difficulties.
export const DIFFICULTY_LIST = [
  "easy",
  "normal",
  "hard",
  "nightmare",
  "godsWar",
  "clone",
  "gauntlet",
  "engineerCorps",
  "swarm",
  "siege",
  "eliteUprising",
  "supportOverdrive",
].map((id) => DIFFICULTIES[id]);

export function getDifficulty(id) {
  return DIFFICULTIES[id] || DIFFICULTIES.hard;
}

// Every consumer site reads difficulty knobs through this so War Mode and
// the Daily Challenge (which never set world.difficultyId) transparently
// keep today's "Hard" behavior instead of needing their own null checks.
export function getDifficultyMods(world) {
  return world?.difficultyDef || DIFFICULTIES.hard;
}

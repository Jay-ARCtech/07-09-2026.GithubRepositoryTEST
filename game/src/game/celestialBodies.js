// Maps each of the 12 Survival difficulties onto a celestial body -- the
// Planet Select screen (screens.js) uses this to decide what the portal
// shows and how the sidebar list reads; startRun() (main.js) uses the same
// `palette` to recolor the actual battle arena (scenery.js/renderWorld), so
// the destination you pick is genuinely the map you fight on, not just a
// different label on an unchanged arena.
//
// `kind` selects which procedural scene renderer in engine/portal.js draws
// the body: 'planet' (a shaded, banded sphere with atmosphere glow),
// 'moon' (smaller, cratered, no atmosphere), 'asteroidField' (no central
// body -- a drifting field of tumbling rock silhouettes), 'nebula' (layered
// soft-edged gas clouds, no discrete body), or 'blackHole' (a dark disc
// ringed by a glowing accretion band with lensed starlight).
import { DIFFICULTIES } from "./difficulty.js";

export const CELESTIAL_BODIES = {
  easy: {
    number: "01",
    name: "Earth",
    kind: "planet",
    bands: ["#0c4a6e", "#0369a1", "#34d399", "#166534"],
    glow: "#7dd3fc",
    palette: {
      bg: "#041018",
      ring: "rgba(52,211,153,0.35)",
      grid: "rgba(125,211,252,0.06)",
      billboardColors: ["#34d399", "#7dd3fc", "#4ade80"],
      pylonColor: "#34d399",
      farLightColors: ["#7dd3fc", "#34d399"],
      accent: "#34d399",
    },
  },
  normal: {
    number: "02",
    name: "Mars",
    kind: "planet",
    bands: ["#7c2d12", "#c2410c", "#ea580c", "#9a3412"],
    glow: "#fb923c",
    palette: {
      bg: "#180a05",
      ring: "rgba(248,113,113,0.35)",
      grid: "rgba(251,146,60,0.06)",
      billboardColors: ["#f87171", "#fb923c", "#facc15"],
      pylonColor: "#f87171",
      farLightColors: ["#fb923c", "#f87171"],
      accent: "#f87171",
    },
  },
  hard: {
    number: "03",
    name: "Mercury",
    kind: "planet",
    bands: ["#57534e", "#a8a29e", "#78716c", "#44403c"],
    glow: "#fbbf24",
    palette: {
      bg: "#0f0906",
      ring: "rgba(251,191,36,0.3)",
      grid: "rgba(168,162,158,0.06)",
      billboardColors: ["#fbbf24", "#a8a29e", "#f97316"],
      pylonColor: "#fbbf24",
      farLightColors: ["#fbbf24", "#a8a29e"],
      accent: "#fbbf24",
    },
  },
  nightmare: {
    number: "04",
    name: "Venus",
    kind: "planet",
    bands: ["#854d0e", "#ca8a04", "#a3e635", "#65a30d"],
    glow: "#facc15",
    palette: {
      bg: "#120d02",
      ring: "rgba(250,204,21,0.35)",
      grid: "rgba(163,230,53,0.05)",
      billboardColors: ["#facc15", "#a3e635", "#f97316"],
      pylonColor: "#facc15",
      farLightColors: ["#facc15", "#f97316"],
      accent: "#facc15",
    },
  },
  godsWar: {
    number: "05",
    name: "Jupiter",
    kind: "planet",
    bands: ["#7c2d12", "#c2410c", "#fde68a", "#fb923c"],
    glow: "#fb923c",
    palette: {
      bg: "#140a02",
      ring: "rgba(251,146,60,0.4)",
      grid: "rgba(253,224,71,0.06)",
      billboardColors: ["#fb923c", "#fde68a", "#c2410c"],
      pylonColor: "#fb923c",
      farLightColors: ["#fb923c", "#fde68a"],
      accent: "#fb923c",
    },
  },
  clone: {
    number: "06",
    name: "The Moon",
    kind: "moon",
    bands: ["#cbd5e1", "#94a3b8", "#e2e8f0"],
    glow: "#e2e8f0",
    palette: {
      bg: "#0a0a0c",
      ring: "rgba(226,232,240,0.3)",
      grid: "rgba(148,163,184,0.06)",
      billboardColors: ["#e2e8f0", "#94a3b8", "#cbd5e1"],
      pylonColor: "#e2e8f0",
      farLightColors: ["#e2e8f0", "#94a3b8"],
      accent: "#cbd5e1",
    },
  },
  gauntlet: {
    number: "07",
    name: "Asteroid Field",
    kind: "asteroidField",
    bands: ["#78716c", "#a8a29e", "#57534e"],
    glow: "#d6d3d1",
    palette: {
      bg: "#0c0906",
      ring: "rgba(168,162,158,0.35)",
      grid: "rgba(120,113,108,0.07)",
      billboardColors: ["#a8a29e", "#78716c", "#d6d3d1"],
      pylonColor: "#a8a29e",
      farLightColors: ["#a8a29e", "#78716c"],
      accent: "#a8a29e",
    },
  },
  engineerCorps: {
    number: "08",
    name: "Saturn",
    kind: "planet",
    bands: ["#a16207", "#eab308", "#fde68a", "#ca8a04"],
    glow: "#facc15",
    ringed: true,
    palette: {
      bg: "#100c04",
      ring: "rgba(250,204,21,0.35)",
      grid: "rgba(212,175,55,0.06)",
      billboardColors: ["#facc15", "#eab308", "#fde68a"],
      pylonColor: "#facc15",
      farLightColors: ["#facc15", "#eab308"],
      accent: "#eab308",
    },
  },
  swarm: {
    number: "09",
    name: "Nebula",
    kind: "nebula",
    bands: ["#d946ef", "#a78bfa", "#f472b6"],
    glow: "#d946ef",
    palette: {
      bg: "#0a0512",
      ring: "rgba(217,70,239,0.35)",
      grid: "rgba(167,139,250,0.07)",
      billboardColors: ["#d946ef", "#a78bfa", "#f472b6"],
      pylonColor: "#d946ef",
      farLightColors: ["#d946ef", "#a78bfa"],
      accent: "#d946ef",
    },
  },
  siege: {
    number: "10",
    name: "Uranus",
    kind: "planet",
    bands: ["#0e7490", "#22d3ee", "#67e8f9", "#0891b2"],
    glow: "#67e8f9",
    palette: {
      bg: "#04121a",
      ring: "rgba(103,232,249,0.35)",
      grid: "rgba(94,234,212,0.06)",
      billboardColors: ["#67e8f9", "#5eead4", "#a5f3fc"],
      pylonColor: "#67e8f9",
      farLightColors: ["#67e8f9", "#5eead4"],
      accent: "#67e8f9",
    },
  },
  eliteUprising: {
    number: "11",
    name: "Black Hole",
    kind: "blackHole",
    bands: ["#facc15", "#f97316", "#7c3aed"],
    glow: "#facc15",
    palette: {
      bg: "#000000",
      ring: "rgba(250,204,21,0.5)",
      grid: "rgba(124,58,237,0.05)",
      billboardColors: ["#facc15", "#f97316", "#7c3aed"],
      pylonColor: "#facc15",
      farLightColors: ["#facc15", "#7c3aed"],
      accent: "#facc15",
    },
  },
  supportOverdrive: {
    number: "12",
    name: "Neptune",
    kind: "planet",
    bands: ["#1e3a8a", "#2563eb", "#60a5fa", "#3730a3"],
    glow: "#60a5fa",
    palette: {
      bg: "#050a1a",
      ring: "rgba(96,165,250,0.35)",
      grid: "rgba(59,130,246,0.06)",
      billboardColors: ["#60a5fa", "#38bdf8", "#818cf8"],
      pylonColor: "#60a5fa",
      farLightColors: ["#60a5fa", "#818cf8"],
      accent: "#60a5fa",
    },
  },
};

// The arena palette War Mode/the Daily Challenge fall back to -- they never
// set world.difficultyId, so getArenaPalette(null) must keep today's actual
// cyan/magenta look unchanged rather than silently landing on Mercury's.
export const DEFAULT_ARENA_PALETTE = {
  bg: "#05030c",
  ring: "rgba(0,240,255,0.3)",
  grid: "rgba(255,43,214,0.05)",
  billboardColors: ["#00f0ff", "#ff2bd6", "#7c3aed", "#fbbf24", "#34d399"],
  pylonColor: "#00f0ff",
  farLightColors: ["#00f0ff", "#ff2bd6", "#fbbf24"],
  accent: "#00f0ff",
};

export function getCelestialBody(difficultyId) {
  return (difficultyId && CELESTIAL_BODIES[difficultyId]) || null;
}

export function getArenaPalette(difficultyId) {
  return getCelestialBody(difficultyId)?.palette || DEFAULT_ARENA_PALETTE;
}

function densityLabel(spawnBudgetMult) {
  if (spawnBudgetMult < 0.6) return "Low";
  if (spawnBudgetMult < 0.95) return "Reduced";
  if (spawnBudgetMult <= 1.05) return "Standard";
  if (spawnBudgetMult <= 1.8) return "High";
  return "Overwhelming";
}

function powerLabel(hpMult, dmgMult) {
  const avg = (hpMult + dmgMult) / 2;
  if (avg < 0.85) return "Weakened";
  if (avg <= 1.05) return "Standard";
  if (avg <= 1.6) return "Amplified";
  return "Doubled";
}

function eliteLabel(eliteChanceMult) {
  if (eliteChanceMult <= 0) return "None";
  if (eliteChanceMult < 0.7) return "Rare";
  if (eliteChanceMult <= 1.05) return "Standard";
  if (eliteChanceMult <= 2) return "Elevated";
  return "Frequent";
}

function paceLabel(spawnIntervalMult) {
  if (spawnIntervalMult < 0.8) return "Relentless";
  if (spawnIntervalMult <= 1.05) return "Standard";
  return "Unhurried";
}

// Facts are derived straight from the real DIFFICULTIES entry rather than
// separately hand-written, so they can't drift out of sync with an actual
// tuning change the way independent lore text could.
export function celestialFacts(difficultyId) {
  const diff = DIFFICULTIES[difficultyId];
  if (!diff) return [];
  return [
    ["Threat:", diff.tagline],
    ["Enemy Density:", `${densityLabel(diff.spawnBudgetMult)} spawn volume, ${paceLabel(diff.spawnIntervalMult).toLowerCase()} pace.`],
    ["Enemy Power:", `${powerLabel(diff.hpMult, diff.dmgMult)} hp & damage scaling.`],
    ["Elite Chance:", `${eliteLabel(diff.eliteChanceMult)} elite roll rate.`],
  ];
}

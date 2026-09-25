// Run structure: a branching node map per Cycle (FTL/Slay the Spire shape,
// RESEARCH.md §5/§12), encounter resolution, loot, and the Legacy
// meta-progression + epilogue composition that make permadeath feel like
// material for the next character instead of just a stop (DESIGN.md §9-10).

import { Rng } from '../engine/rng.js';
import { clamp } from '../engine/state.js';
import { ENCOUNTERS, COMPANIONS, PERSONAL_FATE, CITY_STATE, dominantFaction, ZONE_ORDER } from '../data/content.js';
import { enemiesForZoneAndTier, bossForZone } from '../data/bestiary.js';
import { RARITY_WEIGHT, itemsByType } from '../data/items.js';

export const CYCLES_PER_RUN = 3;
const NODES_PER_LAYER = 3;
const PICK_LAYERS = 4;

const KIND_WEIGHTS = [
  { item: 'combat', weight: 34 },
  { item: 'skill', weight: 22 },
  { item: 'faction', weight: 16 },
  { item: 'cache', weight: 16 },
  { item: 'companion', weight: 12 },
];

const ZONE_WEIGHTS_BY_CYCLE = {
  1: [{ item: 'sprawl', weight: 38 }, { item: 'canopy', weight: 34 }, { item: 'liminal', weight: 18 }, { item: 'choir', weight: 10 }],
  2: [{ item: 'sprawl', weight: 32 }, { item: 'canopy', weight: 30 }, { item: 'liminal', weight: 20 }, { item: 'choir', weight: 18 }],
  3: [{ item: 'sprawl', weight: 28 }, { item: 'canopy', weight: 26 }, { item: 'liminal', weight: 20 }, { item: 'choir', weight: 26 }],
};

const BOSS_BY_CYCLE = { 1: 'sprawl', 2: 'canopy', 3: 'choir' };

const FILLER_ENCOUNTER = {
  id: 'enc_filler_quiet_stretch', kind: 'skill', zones: ZONE_ORDER, minCycle: 1,
  title: 'A Quiet Stretch',
  body: 'For once, nothing is immediately trying to kill you, recruit you, or scan you. You take the block at a normal pace and let your guard down by exactly one notch.',
  choices: [{ stat: 'grit', difficulty: 'certain', label: 'Keep moving.', success: { text: 'Nothing happens. You needed that.', effects: { health: 3 } } }],
};

function clampIndex(i, n) { return Math.max(0, Math.min(n - 1, i)); }

export function generateNodeMap(seed, cycle) {
  const rng = new Rng(seed + cycle * 7919);
  const zoneWeights = ZONE_WEIGHTS_BY_CYCLE[Math.min(cycle, 3)];
  const layers = [];
  for (let L = 0; L < PICK_LAYERS; L++) {
    const layerNodes = [];
    for (let i = 0; i < NODES_PER_LAYER; i++) {
      const kind = rng.pickWeighted(KIND_WEIGHTS);
      const zone = rng.pickWeighted(zoneWeights);
      layerNodes.push({ id: `c${cycle}_l${L}_n${i}`, kind, zone, layer: L, index: i, connectsTo: [] });
    }
    layers.push(layerNodes);
  }
  // guarantee one breather node per cycle so pacing doesn't spike straight through
  layers[Math.min(2, PICK_LAYERS - 1)][0].kind = 'rest';

  for (let L = 0; L < PICK_LAYERS - 1; L++) {
    for (const node of layers[L]) {
      const targets = new Set([clampIndex(node.index, NODES_PER_LAYER)]);
      targets.add(clampIndex(node.index + (rng.chance(0.5) ? 1 : -1), NODES_PER_LAYER));
      node.connectsTo = [...targets].map((i) => layers[L + 1][i].id);
    }
  }
  const bossZone = BOSS_BY_CYCLE[Math.min(cycle, 3)];
  const bossNode = { id: `c${cycle}_boss`, kind: 'boss', zone: bossZone, layer: PICK_LAYERS, index: 0, connectsTo: [] };
  for (const node of layers[PICK_LAYERS - 1]) node.connectsTo = [bossNode.id];
  layers.push([bossNode]);
  return { cycle, seed, layers, startNodeIds: layers[0].map((n) => n.id) };
}

export function flattenNodes(nodeMap) {
  return nodeMap.layers.flat();
}

export function findNode(nodeMap, nodeId) {
  return flattenNodes(nodeMap).find((n) => n.id === nodeId) || null;
}

export function reachableNodeIds(nodeMap, currentNodeId) {
  if (!currentNodeId) return nodeMap.startNodeIds;
  const current = findNode(nodeMap, currentNodeId);
  return current ? current.connectsTo : [];
}

function tierForCycle(cycle) { return Math.min(Math.max(cycle, 1), 3); }

export function pickEnemiesForNode(rng, node, cycle) {
  if (node.kind === 'boss') return [bossForZone(node.zone).id];
  const pool = enemiesForZoneAndTier(node.zone, tierForCycle(cycle));
  const count = rng.chance(cycle >= 2 ? 0.45 : 0.25) ? 2 : 1;
  const chosen = [];
  for (let i = 0; i < count && pool.length; i++) chosen.push(rng.pick(pool).id);
  return chosen.length ? chosen : ['en_scrap_hound'];
}

export function pickEncounterForNode(node, cycle, character, usedEncounterIds) {
  const recruitedIds = new Set(character.companions.map((c) => c.companionId));
  const candidates = Object.values(ENCOUNTERS).filter((e) => {
    if (e.kind !== node.kind) return false;
    if (!e.zones.includes(node.zone)) return false;
    if (e.minCycle > cycle) return false;
    if (usedEncounterIds.includes(e.id)) return false;
    if (e.kind === 'companion') {
      const recruitIds = e.choices.flatMap((c) => [c.success?.effects?.companionRecruit, c.fail?.effects?.companionRecruit]).filter(Boolean);
      if (recruitIds.some((id) => recruitedIds.has(id))) return false;
    }
    return true;
  });
  if (candidates.length) return candidates[0];
  const widerZone = Object.values(ENCOUNTERS).filter((e) => e.kind === node.kind && e.minCycle <= cycle && !usedEncounterIds.includes(e.id));
  if (widerZone.length) return widerZone[0];
  return FILLER_ENCOUNTER;
}

// ---------------- effect application ----------------

export function applyEffects(state, character, effects) {
  if (!effects) return;
  if (effects.faction) {
    const f = { ...state.factions };
    for (const [k, v] of Object.entries(effects.faction)) {
      if (k in f) f[k] = clamp(f[k] + v, -100, 100);
    }
    state.factions = f;
  }
  if (typeof effects.health === 'number') character.health.current = clamp(character.health.current + effects.health, 0, character.health.max);
  if (typeof effects.heat === 'number') character.heat = clamp(character.heat + effects.heat, 0, 100);
  if (typeof effects.bloomstrain === 'number') character.bloomstrain = clamp(character.bloomstrain + effects.bloomstrain, 0, 100);
  if (typeof effects.power === 'number') character.power.current = clamp(character.power.current + effects.power, 0, character.power.max);
  if (Array.isArray(effects.items)) {
    for (const itemId of effects.items) {
      const existing = character.inventory.find((i) => i.itemId === itemId);
      if (existing) existing.qty += 1; else character.inventory.push({ itemId, qty: 1 });
    }
  }
  if (effects.flags) {
    state.flags = { ...state.flags, ...effects.flags };
  }
  if (effects.companionRecruit) {
    const id = effects.companionRecruit;
    if (!character.companions.some((c) => c.companionId === id)) {
      character.companions = [...character.companions, { companionId: id, bond: 10, alive: true }];
    }
  }
  if (effects.companionBond) {
    for (const [id, delta] of Object.entries(effects.companionBond)) {
      const c = character.companions.find((c) => c.companionId === id);
      if (c) c.bond = clamp(c.bond + delta, -100, 100);
    }
  }
  if (effects.journal) {
    if (!character.journal.includes(effects.journal)) character.journal = [...character.journal, effects.journal];
  }
}

// ---------------- loot ----------------

export function rollLoot(rng, node, cycle) {
  const gearTypes = ['weapon', 'cyberware', 'augment', 'armor'];
  const wantsGear = rng.chance(node.kind === 'boss' ? 0.95 : 0.35);
  if (!wantsGear) return null;
  const type = rng.pick(gearTypes);
  const pool = itemsByType(type);
  if (!pool.length) return null;
  const rarityFloor = cycle >= 3 ? 'uncommon' : 'common';
  const weighted = pool
    .filter((it) => RARITY_WEIGHT[it.rarity] <= RARITY_WEIGHT[rarityFloor] || cycle >= 2)
    .map((it) => ({ item: it, weight: RARITY_WEIGHT[it.rarity] }));
  if (!weighted.length) return null;
  return rng.pickWeighted(weighted).id;
}

// ---------------- legacy + epilogue ----------------

export function computeLegacyPoints(state, endingType) {
  let pts = 5;
  pts += (state.run.cycle - 1) * 10;
  pts += Object.values(state.factions).filter((v) => v >= 30).length * 5;
  pts += state.character.companions.length * 3;
  pts += state.character.companions.filter((c) => c.alive).length * 2;
  if (endingType === 'boss_victory') pts += 15;
  return pts;
}

export function causeOfDeathText(endingType) {
  if (endingType === 'health_loss') return 'Went down in the field.';
  if (endingType === 'bloomstrain_complete') return 'The Bloomstrain finished its work.';
  return 'Walked away standing, for now.';
}

export function composeEpilogue(state, endingType) {
  const name = state.character.name;
  const personal = PERSONAL_FATE[endingType]?.text(name) || PERSONAL_FATE.health_loss.text(name);
  const dom = dominantFaction(state.factions);
  const city = (CITY_STATE[dom] || CITY_STATE.balanced)(name);
  const companionLines = state.character.companions.map((c) => {
    const def = COMPANIONS[c.companionId];
    if (!def) return null;
    if (!c.alive) return def.lossFlavor;
    if (c.bond >= 40) return `${def.name} carries what happened this run forward, and carries it well.`;
    return `${def.name} is still out there, changed a little by knowing ${name}.`;
  }).filter(Boolean);
  return { personal, city, companionLines };
}

export function checkRunEnding(state) {
  if (state.character.health.current <= 0) return 'health_loss';
  if (state.character.bloomstrain >= 100) return 'bloomstrain_complete';
  return null;
}

export function advanceCycle(state) {
  state.run.cycle += 1;
  state.run.nodeMap = null;
  state.run.currentNodeId = null;
  state.run.completedNodeIds = [];
}

const ORIGIN_UNLOCK_THRESHOLDS = { choir_touched: 20, warden_washout: 45 };

export function applyLegacyUnlocks(legacy) {
  const unlocked = new Set(legacy.unlockedOriginIds);
  for (const [originId, threshold] of Object.entries(ORIGIN_UNLOCK_THRESHOLDS)) {
    if (legacy.legacyPoints >= threshold) unlocked.add(originId);
  }
  return { ...legacy, unlockedOriginIds: [...unlocked] };
}

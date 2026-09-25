// Save/load. This is the one place in the game that reads data this browser
// session did not itself produce a moment ago — a localStorage blob that
// could predate a version change, or a file the player imports that could
// have been hand-edited or come from someone else entirely. Treat all of it
// as hostile input.
//
// Two deliberate rules, explained in DESIGN.md §12:
//   1. Every field is read by explicit literal name (raw.character.name,
//      raw.factions.ashgrove, ...) — never `for (const k in raw)` copied
//      onto a live object. That is what actually prevents prototype
//      pollution; JSON.parse itself does not create a live __proto__
//      setter, but a naive generic merge loop over its keys would.
//   2. Where a map genuinely needs dynamic keys (flags), the sanitized
//      copy is built on Object.create(null) — a prototype-less object has
//      no __proto__ accessor to trigger even if a bad key slipped past
//      the filter, so this is enforced twice, not once.
//
// What this does NOT try to do: stop a player from hand-editing their own
// localStorage to give themselves max stats. That costs them nothing but
// their own single-player experience and is out of scope on purpose — see
// DESIGN.md §12. Corrupted/malformed data is rejected; a technically
// well-formed save with generous stats is the player's own business.

import { SAVE_VERSION, LEGACY_VERSION, clamp, newCharacterShell, newRunShell } from './state.js';
import { ZONE_ORDER, NODE_KINDS, COMPANIONS, JOURNAL_ENTRIES } from '../data/content.js';
import { ITEMS } from '../data/items.js';
import { ORIGINS } from '../data/stats.js';

const ZONE_SET = new Set(ZONE_ORDER);
const NODE_KIND_SET = new Set(NODE_KINDS);
// A string field that names a real thing elsewhere in the game (an item,
// an origin, a companion, a journal entry) is a foreign key, not free text.
// Every one of these gets checked against its actual catalog here, at the
// one boundary that reads outside data this session produced a moment ago
// — not because a wrong id is likely, but because several render paths
// (AbilitySlot's item.powerCost chief among them) index straight into the
// catalog and assume a hit. An unresolvable id is dropped rather than
// carried through as an inert string, on the theory a render path we
// haven't audited might do the same unchecked lookup somewhere else.
function isRealItem(id, type) { const it = ITEMS[id]; return Boolean(it && (!type || it.type === type)); }

const SAVE_KEY = 'verdigris_protocol_save_v1';
const LEGACY_KEY = 'verdigris_protocol_legacy_v1';
const MAX_STRING = 4000;
const MAX_NAME = 24;
const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const KEY_PATTERN = /^[a-z][a-z0-9_]{0,40}$/;

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function safeStr(v, max = MAX_STRING, fallback = '') {
  if (typeof v !== 'string') return fallback;
  // eslint-disable-next-line no-control-regex
  const stripped = v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  return stripped.slice(0, max);
}

export function sanitizeName(v) {
  const s = safeStr(v, MAX_NAME, '').trim();
  return s.length ? s : 'Unnamed';
}

function safeInt(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return clamp(Math.round(n), min, max);
}

function safeBool(v, fallback = false) {
  return typeof v === 'boolean' ? v : fallback;
}

/** Build a dynamically-keyed map with no usable prototype, filtering keys twice. */
function safeDynamicMap(raw, { maxEntries = 200, valueFn }) {
  const out = Object.create(null);
  if (!isPlainObject(raw)) return out;
  let count = 0;
  for (const key of Object.keys(raw)) {
    if (count >= maxEntries) break;
    if (BAD_KEYS.has(key) || !KEY_PATTERN.test(key)) continue;
    out[key] = valueFn(raw[key]);
    count++;
  }
  return out;
}

function safeStats(raw) {
  const s = isPlainObject(raw) ? raw : {};
  return {
    body: safeInt(s.body, 0, 12, 1),
    reflex: safeInt(s.reflex, 0, 12, 1),
    synth: safeInt(s.synth, 0, 12, 1),
    grit: safeInt(s.grit, 0, 12, 1),
    empathy: safeInt(s.empathy, 0, 12, 1),
    resonance: safeInt(s.resonance, 0, 12, 1),
  };
}

function safeInventory(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 200).map((it) => ({
    itemId: safeStr(it?.itemId, 64, ''),
    qty: safeInt(it?.qty, 1, 999, 1),
  })).filter((it) => it.itemId && isRealItem(it.itemId));
}

function safeEquipped(raw) {
  const e = isPlainObject(raw) ? raw : {};
  return {
    weapon: e.weapon && isRealItem(e.weapon, 'weapon') ? e.weapon : null,
    armor: e.armor && isRealItem(e.armor, 'armor') ? e.armor : null,
    cyberware: Array.isArray(e.cyberware) ? e.cyberware.slice(0, 12).filter((x) => isRealItem(x, 'cyberware')) : [],
    augments: Array.isArray(e.augments) ? e.augments.slice(0, 12).filter((x) => isRealItem(x, 'augment')) : [],
  };
}

function safeCompanions(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 20).map((c) => ({
    companionId: safeStr(c?.companionId, 64, ''),
    bond: safeInt(c?.bond, -100, 100, 0),
    alive: safeBool(c?.alive, true),
  })).filter((c) => c.companionId && COMPANIONS[c.companionId]);
}

function safeCharacter(raw) {
  const c = isPlainObject(raw) ? raw : {};
  const shell = newCharacterShell();
  const maxHealth = safeInt(c.health?.max, 1, 999, shell.health.max);
  const maxPower = safeInt(c.power?.max, 0, 99, shell.power.max);
  return {
    name: sanitizeName(c.name),
    originId: c.originId && ORIGINS[c.originId] ? c.originId : null,
    stats: safeStats(c.stats),
    health: { current: safeInt(c.health?.current, 0, maxHealth, maxHealth), max: maxHealth },
    heat: safeInt(c.heat, 0, 100, 0),
    bloomstrain: safeInt(c.bloomstrain, 0, 100, 0),
    power: { current: safeInt(c.power?.current, 0, maxPower, maxPower), max: maxPower },
    inventory: safeInventory(c.inventory),
    equipped: safeEquipped(c.equipped),
    companions: safeCompanions(c.companions),
    journal: Array.isArray(c.journal) ? c.journal.slice(0, 300).map((x) => safeStr(x, 64, '')).filter((id) => JOURNAL_ENTRIES[id]) : [],
  };
}

function safeFactions(raw) {
  const f = isPlainObject(raw) ? raw : {};
  const clampRep = (v) => safeInt(v, -100, 100, 0);
  return {
    ashgrove: clampRep(f.ashgrove),
    commons: clampRep(f.commons),
    undertow: clampRep(f.undertow),
    choir: clampRep(f.choir),
    wardens: clampRep(f.wardens),
  };
}

function safeNode(raw) {
  if (!isPlainObject(raw)) return null;
  const kind = NODE_KIND_SET.has(raw.kind) ? raw.kind : null;
  const zone = ZONE_SET.has(raw.zone) ? raw.zone : null;
  const id = safeStr(raw.id, 64, '');
  if (!kind || !zone || !id) return null;
  return {
    id, kind, zone,
    layer: safeInt(raw.layer, 0, 100, 0),
    index: safeInt(raw.index, 0, 100, 0),
    connectsTo: Array.isArray(raw.connectsTo) ? raw.connectsTo.slice(0, 20).map((x) => safeStr(x, 64, '')).filter(Boolean) : [],
  };
}

/** main.js's enterMap() only regenerates a fresh map when run.nodeMap is
 * falsy — a well-formed-but-malicious nodeMap (e.g. a zone string that
 * isn't in ZONES) would otherwise be used as-is and crash MapScreen's
 * render (ZONES[node.zone].name on an unknown zone). So this validates
 * for real rather than passing the shape through unchecked; anything that
 * doesn't fully check out is rejected as a whole (returns null), and
 * MapScreen already has a "no map generated" fallback for that case —
 * failing closed to a safe screen beats silently serving a half-broken,
 * unreachable map. */
function safeNodeMap(raw) {
  if (!isPlainObject(raw) || !Array.isArray(raw.layers)) return null;
  const layers = raw.layers.slice(0, 20).map((layer) => (Array.isArray(layer) ? layer.slice(0, 20).map(safeNode).filter(Boolean) : []));
  if (!layers.length || layers.some((l) => !l.length)) return null;
  const allIds = new Set(layers.flat().map((n) => n.id));
  for (const layer of layers) for (const node of layer) node.connectsTo = node.connectsTo.filter((id) => allIds.has(id));
  const startNodeIds = Array.isArray(raw.startNodeIds) ? raw.startNodeIds.slice(0, 20).map((x) => safeStr(x, 64, '')).filter((id) => allIds.has(id)) : [];
  if (!startNodeIds.length) return null;
  return { cycle: safeInt(raw.cycle, 1, 999, 1), seed: safeInt(raw.seed, 0, 0xffffffff, 0), layers, startNodeIds };
}

function safeRun(raw) {
  const r = isPlainObject(raw) ? raw : {};
  const shell = newRunShell();
  return {
    cycle: safeInt(r.cycle, 1, 999, shell.cycle),
    seed: safeInt(r.seed, 0, 0xffffffff, 0),
    nodeMap: safeNodeMap(r.nodeMap),
    currentNodeId: r.currentNodeId ? safeStr(r.currentNodeId, 64, '') || null : null,
    completedNodeIds: Array.isArray(r.completedNodeIds) ? r.completedNodeIds.slice(0, 500).map((x) => safeStr(x, 64, '')).filter(Boolean) : [],
    usedEncounterIds: Array.isArray(r.usedEncounterIds) ? r.usedEncounterIds.slice(0, 500).map((x) => safeStr(x, 64, '')).filter(Boolean) : [],
    pendingEncounterId: r.pendingEncounterId ? safeStr(r.pendingEncounterId, 64, '') || null : null,
  };
}

export function validateState(raw) {
  if (!isPlainObject(raw)) return null;
  const validPhases = new Set(['title', 'charcreate', 'tutorial', 'hub', 'map', 'encounter', 'combat', 'dialogue', 'dead', 'epilogue']);
  const phase = validPhases.has(raw.phase) ? raw.phase : 'title';
  return {
    version: SAVE_VERSION,
    createdAt: safeInt(raw.createdAt, 0, Number.MAX_SAFE_INTEGER, Date.now()),
    lastSavedAt: Date.now(),
    phase,
    character: safeCharacter(raw.character),
    factions: safeFactions(raw.factions),
    flags: safeDynamicMap(raw.flags, { maxEntries: 300, valueFn: (v) => (typeof v === 'string' ? safeStr(v, 200) : typeof v === 'number' ? clamp(v, -999999, 999999) : Boolean(v)) }),
    run: safeRun(raw.run),
    combat: null, // combat state is always transient and rebuilt, never trusted from a save
    log: Array.isArray(raw.log) ? raw.log.slice(-60).map((x) => safeStr(x, 240)) : [],
    tutorialDone: safeBool(raw.tutorialDone, false),
  };
}

function safePastCharacters(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(-50).map((p) => ({
    name: sanitizeName(p?.name),
    originId: safeStr(p?.originId, 64, 'unknown'),
    cycleReached: safeInt(p?.cycleReached, 1, 999, 1),
    endingId: safeStr(p?.endingId, 64, 'unknown'),
    causeOfDeath: safeStr(p?.causeOfDeath, 200, 'Unrecorded.'),
    timestamp: safeInt(p?.timestamp, 0, Number.MAX_SAFE_INTEGER, Date.now()),
  }));
}

export function validateLegacy(raw) {
  if (!isPlainObject(raw)) return null;
  return {
    version: LEGACY_VERSION,
    legacyPoints: safeInt(raw.legacyPoints, 0, 999999, 0),
    unlockedOriginIds: Array.isArray(raw.unlockedOriginIds) ? raw.unlockedOriginIds.slice(0, 32).map((x) => safeStr(x, 64)).filter(Boolean) : [],
    pastCharacters: safePastCharacters(raw.pastCharacters),
    perks: safeDynamicMap(raw.perks, { maxEntries: 100, valueFn: Boolean }),
  };
}

function safeJSONParse(text) {
  if (typeof text !== 'string' || text.length > 2_000_000) return null;
  try { return JSON.parse(text); } catch { return null; }
}

export function saveGame(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...state, lastSavedAt: Date.now() }));
    return true;
  } catch (err) {
    console.warn('Save failed', err);
    return false;
  }
}

export function loadGame() {
  const raw = safeJSONParse(localStorage.getItem(SAVE_KEY));
  return raw ? validateState(raw) : null;
}

export function clearGame() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}

export function saveLegacy(legacy) {
  try {
    localStorage.setItem(LEGACY_KEY, JSON.stringify(legacy));
    return true;
  } catch (err) {
    console.warn('Legacy save failed', err);
    return false;
  }
}

export function loadLegacy() {
  const raw = safeJSONParse(localStorage.getItem(LEGACY_KEY));
  return raw ? validateLegacy(raw) : null;
}

export function exportSaveFile(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = sanitizeName(state?.character?.name).replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  a.download = `verdigris-protocol-${safeName || 'save'}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function importSaveFile(file) {
  return new Promise((resolve, reject) => {
    if (!file || file.size > 2_000_000) {
      reject(new Error('That file is not a valid Verdigris Protocol save.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = () => {
      const raw = safeJSONParse(String(reader.result || ''));
      const validated = raw ? validateState(raw) : null;
      if (!validated) { reject(new Error('That file is not a valid Verdigris Protocol save.')); return; }
      resolve(validated);
    };
    reader.readAsText(file);
  });
}

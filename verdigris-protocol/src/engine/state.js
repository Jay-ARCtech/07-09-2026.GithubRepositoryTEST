// Central state store: a plain object plus a tiny pub/sub. No framework —
// screens re-render fully from state on every change, which is cheap enough
// for a turn-based game and keeps the whole render path one-directional
// (state -> DOM), which matters for keeping untrusted data out of the DOM
// safely (see dom.js).

export const SAVE_VERSION = 1;
export const LEGACY_VERSION = 1;

export function clamp(n, min, max) {
  n = Number(n);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export function newCharacterShell() {
  return {
    name: 'Unnamed',
    originId: null,
    stats: { body: 1, reflex: 1, synth: 1, grit: 1, empathy: 1, resonance: 1 },
    health: { current: 10, max: 10 },
    heat: 0,
    bloomstrain: 0,
    power: { current: 3, max: 3 },
    inventory: [],
    equipped: { weapon: null, armor: null, cyberware: [], augments: [] },
    companions: [],
    journal: [],
  };
}

export function newRunShell() {
  return {
    cycle: 1,
    seed: 0,
    nodeMap: null,
    currentNodeId: null,
    completedNodeIds: [],
    usedEncounterIds: [],
    pendingEncounterId: null,
  };
}

export function createInitialState() {
  return {
    version: SAVE_VERSION,
    createdAt: Date.now(),
    lastSavedAt: Date.now(),
    phase: 'title',
    character: newCharacterShell(),
    factions: { ashgrove: 0, commons: 0, undertow: 0, choir: 0, wardens: 0 },
    flags: {},
    run: newRunShell(),
    combat: null,
    log: [],
    tutorialDone: false,
  };
}

export function createInitialLegacy() {
  return {
    version: LEGACY_VERSION,
    legacyPoints: 0,
    unlockedOriginIds: ['corpo_defector', 'commons_raised', 'undertow_runner', 'bloom_orphan'],
    pastCharacters: [],
    perks: {},
  };
}

export class Store {
  constructor(initial) {
    this._state = initial;
    this._subs = new Set();
  }
  getState() { return this._state; }
  setState(patch) {
    this._state = typeof patch === 'function' ? patch(this._state) : { ...this._state, ...patch };
    for (const fn of this._subs) fn(this._state);
  }
  subscribe(fn) {
    this._subs.add(fn);
    return () => this._subs.delete(fn);
  }
  appendLog(entry) {
    const log = [...this._state.log, entry].slice(-60);
    this.setState({ log });
  }
}

// Seeded PRNG (mulberry32) — deterministic per run so a given seed always
// produces the same node map, same encounter rolls, same loot. Not
// cryptographic; not meant to be. There is no server and nothing here
// protects against a player editing their own save (see DESIGN.md §12 —
// that is explicitly not a threat this game defends against).

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeSeed() {
  // crypto.getRandomValues is available in every browser this game targets;
  // Math.random is an acceptable fallback since this only seeds flavor RNG.
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0];
  }
  return Math.floor(Math.random() * 0xffffffff);
}

export class Rng {
  constructor(seed) {
    this.seed = seed >>> 0;
    this._next = mulberry32(this.seed);
  }
  float() { return this._next(); }
  int(min, max) { // inclusive
    return Math.floor(this.float() * (max - min + 1)) + min;
  }
  chance(p) { return this.float() < p; }
  pick(arr) { return arr[this.int(0, arr.length - 1)]; }
  pickWeighted(entries) { // [{item, weight}]
    const total = entries.reduce((s, e) => s + e.weight, 0);
    let roll = this.float() * total;
    for (const e of entries) {
      if (roll < e.weight) return e.item;
      roll -= e.weight;
    }
    return entries[entries.length - 1]?.item;
  }
  shuffle(arr) {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
  d20() { return this.int(1, 20); }
}

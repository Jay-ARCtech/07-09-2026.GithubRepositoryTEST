/**
 * Local save with integrity checking.
 *
 * Everything lives in localStorage on the device. There is no account, no
 * server, and no network call - so there is nothing to breach, and the app can
 * honestly declare "no data collected" on both stores.
 *
 * The checksum is NOT anti-cheat. A determined player can edit their own save
 * and that is their business; there are no leaderboards to poison. It exists so
 * that a *corrupt* or partially-written save is detected and reset cleanly
 * instead of crashing the game on launch with an undefined field.
 */

const CHECK_KEY = '__sig';

export interface StorageResult<T> {
  value: T;
  recovered: boolean;
}

/** FNV-1a over the serialised payload. Cheap, stable, no dependencies. */
function checksum(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

function available(): boolean {
  try {
    const k = '__probe__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch {
    // Private mode, disabled storage, or a quota of zero. The game still runs,
    // it just cannot persist.
    return false;
  }
}

export class Storage {
  private readonly prefix: string;
  private readonly ok: boolean;
  /** In-memory fallback so a run still works when localStorage is unavailable. */
  private memory = new Map<string, string>();

  constructor(prefix: string) {
    this.prefix = prefix;
    this.ok = available();
  }

  get persistent(): boolean {
    return this.ok;
  }

  private read(key: string): string | null {
    if (!this.ok) return this.memory.get(key) ?? null;
    try {
      return localStorage.getItem(this.prefix + key);
    } catch {
      return null;
    }
  }

  private write(key: string, value: string): void {
    if (!this.ok) {
      this.memory.set(key, value);
      return;
    }
    try {
      localStorage.setItem(this.prefix + key, value);
    } catch {
      // Quota exceeded or storage revoked mid-session; degrade to memory.
      this.memory.set(key, value);
    }
  }

  /**
   * Loads and validates. `migrate` gets whatever was stored (already known to
   * be a plain object) and must return a fully-populated, valid value.
   * Any failure at any stage falls back to `fallback` with recovered=true.
   */
  load<T>(
    key: string,
    fallback: T,
    migrate: (raw: Record<string, unknown>) => T,
  ): StorageResult<T> {
    const raw = this.read(key);
    if (raw === null) return { value: fallback, recovered: false };

    try {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return { value: fallback, recovered: true };
      }
      const obj = parsed as Record<string, unknown>;
      const sig = obj[CHECK_KEY];
      delete obj[CHECK_KEY];
      const expected = checksum(JSON.stringify(obj));
      const recovered = typeof sig !== 'string' || sig !== expected;
      // A failed checksum does not discard the save - the data may still be
      // perfectly usable. It is migrated through the same validator and simply
      // flagged, which is far friendlier than wiping someone's progress.
      return { value: migrate(obj), recovered };
    } catch {
      return { value: fallback, recovered: true };
    }
  }

  save<T extends object>(key: string, value: T): void {
    try {
      const body = JSON.stringify(value);
      const withSig = JSON.stringify({ ...JSON.parse(body), [CHECK_KEY]: checksum(body) });
      this.write(key, withSig);
    } catch {
      /* serialisation failed; nothing sensible to do but keep playing */
    }
  }

  remove(key: string): void {
    if (!this.ok) {
      this.memory.delete(key);
      return;
    }
    try {
      localStorage.removeItem(this.prefix + key);
    } catch {
      /* ignore */
    }
  }
}

// --- Validation helpers used by the save migrator ---------------------------

export function num(v: unknown, fallback: number, min = -Infinity, max = Infinity): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return Math.min(Math.max(n, min), max);
}

export function int(v: unknown, fallback: number, min = -Infinity, max = Infinity): number {
  return Math.floor(num(v, fallback, min, max));
}

export function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

export function str(v: unknown, fallback: string, allowed?: readonly string[]): string {
  if (typeof v !== 'string') return fallback;
  if (allowed && !allowed.includes(v)) return fallback;
  return v;
}

/** Keeps only strings that appear in `allowed`, de-duplicated and capped. */
export function strList(v: unknown, allowed: readonly string[], cap = 128): string[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  for (const item of v) {
    if (typeof item === 'string' && allowed.includes(item)) seen.add(item);
    if (seen.size >= cap) break;
  }
  return [...seen];
}

/** Numeric map with unknown keys dropped and values clamped. */
export function numMap(
  v: unknown,
  allowed: readonly string[],
  min: number,
  max: number,
): Record<string, number> {
  const out: Record<string, number> = {};
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return out;
  const src = v as Record<string, unknown>;
  for (const key of allowed) {
    if (key in src) out[key] = int(src[key], min, min, max);
  }
  return out;
}

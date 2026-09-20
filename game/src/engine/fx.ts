/**
 * Particle + floating-text system, built on fixed-size pools.
 *
 * Nothing is allocated during play. Pools are filled once at construction and
 * recycled, because a garbage-collection pause in the middle of a 40x parry
 * chain is exactly the kind of stutter players describe as "laggy" in reviews.
 */
import { TAU, clamp01, ease } from './math';

export const enum PKind {
  Spark = 0,
  Ring = 1,
  Shard = 2,
  Glow = 3,
  Dust = 4,
}

export interface Particle {
  active: boolean;
  kind: PKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  endSize: number;
  rot: number;
  spin: number;
  drag: number;
  color: string;
  additive: boolean;
}

export interface FloatText {
  active: boolean;
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
  text: string;
  color: string;
  size: number;
}

const MAX_PARTICLES = 520;
const MAX_TEXTS = 28;

export class Fx {
  private particles: Particle[] = [];
  private texts: FloatText[] = [];
  private cursor = 0;
  private textCursor = 0;

  constructor() {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({
        active: false,
        kind: PKind.Spark,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 1,
        size: 1,
        endSize: 0,
        rot: 0,
        spin: 0,
        drag: 1.4,
        color: '#fff',
        additive: true,
      });
    }
    for (let i = 0; i < MAX_TEXTS; i++) {
      this.texts.push({
        active: false,
        x: 0,
        y: 0,
        vy: -40,
        life: 0,
        maxLife: 1,
        text: '',
        color: '#fff',
        size: 16,
      });
    }
  }

  clear(): void {
    for (const p of this.particles) p.active = false;
    for (const t of this.texts) t.active = false;
  }

  /**
   * Claims the next slot. When the pool is saturated this overwrites the
   * oldest-claimed particle rather than dropping the new one - a burst that is
   * silently skipped reads as an input that "did nothing".
   */
  private claim(): Particle {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const idx = (this.cursor + i) % MAX_PARTICLES;
      const p = this.particles[idx]!;
      if (!p.active) {
        this.cursor = (idx + 1) % MAX_PARTICLES;
        return p;
      }
    }
    const p = this.particles[this.cursor]!;
    this.cursor = (this.cursor + 1) % MAX_PARTICLES;
    return p;
  }

  spark(
    x: number,
    y: number,
    angle: number,
    opts: {
      count?: number;
      speed?: number;
      spread?: number;
      life?: number;
      size?: number;
      color?: string;
      drag?: number;
      rand?: () => number;
    } = {},
  ): void {
    const count = opts.count ?? 8;
    const speed = opts.speed ?? 240;
    const spread = opts.spread ?? 0.7;
    const life = opts.life ?? 0.42;
    const size = opts.size ?? 3;
    const color = opts.color ?? '#7df9ff';
    const drag = opts.drag ?? 2.4;
    const rnd = opts.rand ?? Math.random;

    for (let i = 0; i < count; i++) {
      const p = this.claim();
      const a = angle + (rnd() - 0.5) * spread * 2;
      const s = speed * (0.45 + rnd() * 0.85);
      p.active = true;
      p.kind = PKind.Spark;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * s;
      p.vy = Math.sin(a) * s;
      p.maxLife = life * (0.7 + rnd() * 0.7);
      p.life = p.maxLife;
      p.size = size * (0.7 + rnd() * 0.8);
      p.endSize = 0;
      p.rot = a;
      p.spin = 0;
      p.drag = drag;
      p.color = color;
      p.additive = true;
    }
  }

  ring(x: number, y: number, radius: number, endRadius: number, life: number, color: string): void {
    const p = this.claim();
    p.active = true;
    p.kind = PKind.Ring;
    p.x = x;
    p.y = y;
    p.vx = 0;
    p.vy = 0;
    p.maxLife = life;
    p.life = life;
    p.size = radius;
    p.endSize = endRadius;
    p.drag = 0;
    p.color = color;
    p.additive = true;
  }

  shards(
    x: number,
    y: number,
    count: number,
    color: string,
    speed = 200,
    rand: () => number = Math.random,
  ): void {
    for (let i = 0; i < count; i++) {
      const p = this.claim();
      const a = rand() * TAU;
      const s = speed * (0.3 + rand() * 1.1);
      p.active = true;
      p.kind = PKind.Shard;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * s;
      p.vy = Math.sin(a) * s;
      p.maxLife = 0.5 + rand() * 0.5;
      p.life = p.maxLife;
      p.size = 3 + rand() * 4;
      p.endSize = 0;
      p.rot = a;
      p.spin = (rand() - 0.5) * 14;
      p.drag = 1.6;
      p.color = color;
      p.additive = false;
    }
  }

  glow(x: number, y: number, size: number, life: number, color: string): void {
    const p = this.claim();
    p.active = true;
    p.kind = PKind.Glow;
    p.x = x;
    p.y = y;
    p.vx = 0;
    p.vy = 0;
    p.maxLife = life;
    p.life = life;
    p.size = size;
    p.endSize = size * 1.6;
    p.drag = 0;
    p.color = color;
    p.additive = true;
  }

  dust(x: number, y: number, vx: number, vy: number, life: number, size: number, color: string): void {
    const p = this.claim();
    p.active = true;
    p.kind = PKind.Dust;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.maxLife = life;
    p.life = life;
    p.size = size;
    p.endSize = 0;
    p.drag = 0.6;
    p.color = color;
    p.additive = true;
  }

  text(x: number, y: number, str: string, color: string, size = 18, rise = 54): void {
    let t: FloatText | undefined;
    for (let i = 0; i < MAX_TEXTS; i++) {
      const idx = (this.textCursor + i) % MAX_TEXTS;
      if (!this.texts[idx]!.active) {
        t = this.texts[idx]!;
        this.textCursor = (idx + 1) % MAX_TEXTS;
        break;
      }
    }
    if (!t) {
      t = this.texts[this.textCursor]!;
      this.textCursor = (this.textCursor + 1) % MAX_TEXTS;
    }
    t.active = true;
    t.x = x;
    t.y = y;
    t.text = str;
    t.color = color;
    t.size = size;
    t.maxLife = 0.85;
    t.life = t.maxLife;
    t.vy = -rise;
  }

  update(dt: number): void {
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.drag > 0) {
        const f = Math.exp(-p.drag * dt);
        p.vx *= f;
        p.vy *= f;
      }
      p.rot += p.spin * dt;
    }
    for (const t of this.texts) {
      if (!t.active) continue;
      t.life -= dt;
      if (t.life <= 0) {
        t.active = false;
        continue;
      }
      t.y += t.vy * dt;
      t.vy *= Math.exp(-3.2 * dt);
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    for (const p of this.particles) {
      if (!p.active) continue;
      const t = clamp01(p.life / p.maxLife);
      const alpha = p.kind === PKind.Ring ? ease.outQuad(t) : t;
      ctx.globalAlpha = alpha;
      ctx.globalCompositeOperation = p.additive ? 'lighter' : 'source-over';

      switch (p.kind) {
        case PKind.Spark: {
          const s = p.size * t;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = Math.max(1, s);
          ctx.lineCap = 'round';
          ctx.beginPath();
          // Streak the spark along its velocity: a moving dot reads as a smear
          // to the eye, and drawing it that way makes it feel faster.
          const tail = 0.035;
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * tail, p.y - p.vy * tail);
          ctx.stroke();
          break;
        }
        case PKind.Ring: {
          const r = p.size + (p.endSize - p.size) * (1 - t);
          ctx.strokeStyle = p.color;
          ctx.lineWidth = Math.max(1, 5 * t);
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.5, r), 0, TAU);
          ctx.stroke();
          break;
        }
        case PKind.Shard: {
          const s = p.size * t;
          ctx.fillStyle = p.color;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillRect(-s * 0.5, -s * 0.22, s, s * 0.44);
          ctx.restore();
          break;
        }
        case PKind.Glow: {
          const r = p.size + (p.endSize - p.size) * (1 - t);
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, Math.max(1, r));
          grad.addColorStop(0, p.color);
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(1, r), 0, TAU);
          ctx.fill();
          break;
        }
        case PKind.Dust: {
          const s = Math.max(0.5, p.size * t);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, s, 0, TAU);
          ctx.fill();
          break;
        }
      }
    }
    ctx.restore();
  }

  drawTexts(ctx: CanvasRenderingContext2D, fontFamily: string): void {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of this.texts) {
      if (!t.active) continue;
      const k = clamp01(t.life / t.maxLife);
      // Pop in over the first 20% of life, then fade.
      const grow = k > 0.8 ? ease.outBack((1 - k) / 0.2) : 1;
      ctx.globalAlpha = k > 0.6 ? 1 : k / 0.6;
      ctx.fillStyle = t.color;
      ctx.font = `700 ${Math.round(t.size * grow)}px ${fontFamily}`;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.restore();
  }

  get activeCount(): number {
    let n = 0;
    for (const p of this.particles) if (p.active) n++;
    return n;
  }
}

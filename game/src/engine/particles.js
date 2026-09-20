// Pooled particle + floating-text system. Pooling avoids per-frame GC
// churn, which matters once explosions are spawning dozens of particles
// a second during boss fights.

class Particle {
  constructor() {
    this.reset();
  }
  reset() {
    this.active = false;
  }
}

class FloatText {
  constructor() {
    this.active = false;
  }
}

export class ParticleSystem {
  constructor(maxParticles = 900, maxTexts = 140) {
    this.pool = Array.from({ length: maxParticles }, () => new Particle());
    this.textPool = Array.from({ length: maxTexts }, () => new FloatText());
    this.densityScale = 1;
  }

  setDensity(mode) {
    this.densityScale = mode === "low" ? 0.35 : mode === "medium" ? 0.65 : 1;
  }

  spawnBurst(x, y, color, count, opts = {}) {
    const n = Math.max(1, Math.round(count * this.densityScale));
    const speed = opts.speed ?? 180;
    const life = opts.life ?? 0.5;
    const size = opts.size ?? 3;
    for (let i = 0; i < n; i++) {
      const p = this.pool.find((p) => !p.active);
      if (!p) return;
      const ang = Math.random() * Math.PI * 2;
      const spd = speed * (0.4 + Math.random() * 0.9);
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(ang) * spd;
      p.vy = Math.sin(ang) * spd;
      p.life = life * (0.6 + Math.random() * 0.8);
      p.maxLife = p.life;
      p.color = color;
      p.size = size * (0.6 + Math.random() * 0.8);
      p.gravity = opts.gravity ?? 0;
      p.shape = opts.shape ?? "square";
    }
  }

  spawnRing(x, y, color, opts = {}) {
    const p = this.pool.find((p) => !p.active);
    if (!p) return;
    p.active = true;
    p.x = x;
    p.y = y;
    p.vx = 0;
    p.vy = 0;
    p.life = opts.life ?? 0.35;
    p.maxLife = p.life;
    p.color = color;
    p.size = opts.size ?? 20;
    p.shape = "ring";
    p.gravity = 0;
  }

  spawnText(x, y, text, color = "#fff", opts = {}) {
    const t = this.textPool.find((t) => !t.active);
    if (!t) return;
    t.active = true;
    t.x = x;
    t.y = y;
    t.vy = -60;
    t.text = text;
    t.color = color;
    t.life = opts.life ?? 0.7;
    t.maxLife = t.life;
    t.size = opts.size ?? 16;
  }

  update(dt) {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.vy += (p.gravity || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
    }
    for (const t of this.textPool) {
      if (!t.active) continue;
      t.life -= dt;
      if (t.life <= 0) {
        t.active = false;
        continue;
      }
      t.y += t.vy * dt;
      t.vy *= 0.9;
    }
  }

  render(ctx) {
    for (const p of this.pool) {
      if (!p.active) continue;
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.strokeStyle = p.color;
      if (p.shape === "ring") {
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - a) + p.size * 0.3, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        const s = p.size * a + 1;
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      }
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "center";
    for (const t of this.textPool) {
      if (!t.active) continue;
      const a = Math.max(0, t.life / t.maxLife);
      ctx.globalAlpha = a;
      ctx.font = `bold ${t.size}px 'Segoe UI', system-ui, sans-serif`;
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }
}

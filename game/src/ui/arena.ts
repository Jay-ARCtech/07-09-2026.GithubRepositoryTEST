/**
 * Arena renderer.
 *
 * Readability is the whole job here. The player has roughly a second to see a
 * shot, identify its type and decide what to do about it, so every projectile
 * kind is separated on three channels at once - colour, silhouette and motion -
 * rather than colour alone. Roughly 8% of men have some form of colour vision
 * deficiency; a game that encodes "do not block this" purely in purple-vs-cyan
 * is unplayable for them.
 */
import { TAU, clamp01, ease, lerp } from '../engine/math';
import { ARENA, ENERGY, PALETTE, PROJ_COLORS, TURRET } from '../game/config';
import type { Projectile, Run, Turret } from '../game/run';
import { FONT, withAlpha } from './theme';

export interface ArenaLayout {
  cx: number;
  cy: number;
  /** Pixels per unit of r. r = 1.0 is the arena boundary. */
  radius: number;
}

/** Converts a polar game position to screen pixels. */
export function toScreen(layout: ArenaLayout, r: number, a: number): { x: number; y: number } {
  const rad = r * layout.radius;
  return { x: layout.cx + Math.cos(a) * rad, y: layout.cy + Math.sin(a) * rad };
}

export class ArenaRenderer {
  private gridSpin = 0;
  private corePulse = 0;
  /** Recent shield angles, for the motion trail. */
  private shieldTrail: number[] = [];

  update(dt: number, run: Run | null): void {
    this.gridSpin = (this.gridSpin + dt * 0.035) % TAU;
    this.corePulse += dt;
    if (run) {
      this.shieldTrail.push(run.shieldCenter);
      if (this.shieldTrail.length > 5) this.shieldTrail.shift();
    } else if (this.shieldTrail.length > 0) {
      this.shieldTrail.length = 0;
    }
  }

  drawBackdrop(
    ctx: CanvasRenderingContext2D,
    layout: ArenaLayout,
    width: number,
    height: number,
    intensity: number,
  ): void {
    ctx.fillStyle = PALETTE.bg;
    ctx.fillRect(0, 0, width, height);

    // A wide, very soft glow behind the core keeps the middle of the screen
    // from reading as a flat black hole.
    const g = ctx.createRadialGradient(
      layout.cx,
      layout.cy,
      0,
      layout.cx,
      layout.cy,
      layout.radius * 1.45,
    );
    g.addColorStop(0, withAlpha(PALETTE.accent, 0.075 + intensity * 0.05));
    g.addColorStop(0.55, withAlpha(PALETTE.accent, 0.02));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);

    // Slowly rotating polar grid. Motion here is almost subliminal: enough to
    // stop the background feeling static, slow enough never to pull the eye.
    ctx.save();
    ctx.translate(layout.cx, layout.cy);
    ctx.rotate(this.gridSpin);
    ctx.strokeStyle = PALETTE.bgGrid;
    ctx.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * layout.radius * 0.2, Math.sin(a) * layout.radius * 0.2);
      ctx.lineTo(Math.cos(a) * layout.radius * 1.3, Math.sin(a) * layout.radius * 1.3);
      ctx.stroke();
    }
    for (const r of [0.34, 0.68, 1.0, 1.3]) {
      ctx.beginPath();
      ctx.arc(0, 0, layout.radius * r, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawBoundary(ctx: CanvasRenderingContext2D, layout: ArenaLayout, danger: number): void {
    const R = layout.radius;
    ctx.save();
    ctx.translate(layout.cx, layout.cy);

    ctx.strokeStyle = withAlpha(PALETTE.accent, 0.2 + danger * 0.35);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, TAU);
    ctx.stroke();

    // Ticks every 15 degrees give the eye a reference for angle, which is what
    // the whole control scheme is built on.
    ctx.strokeStyle = withAlpha(PALETTE.accent, 0.16);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU;
      const long = i % 6 === 0;
      const inner = R * (long ? 0.965 : 0.982);
      ctx.lineWidth = long ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
      ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawCore(
    ctx: CanvasRenderingContext2D,
    layout: ArenaLayout,
    run: Run,
    time: number,
  ): void {
    const R = layout.radius;
    const coreR = ARENA.coreRadius * R;
    const hpFrac = run.maxHp > 0 ? run.hp / run.maxHp : 0;
    const hurt = 1 - hpFrac;
    const invuln = run.invulnT > 0;

    ctx.save();
    ctx.translate(layout.cx, layout.cy);

    // Energy ring: sits just outside the core so charge is readable without
    // taking the eye off the middle of the screen.
    const energyFrac = run.overdriveReady ? 1 : run.energy / ENERGY.max;
    const ringR = coreR * 1.42;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(232, 240, 255, 0.08)';
    ctx.beginPath();
    ctx.arc(0, 0, ringR, 0, TAU);
    ctx.stroke();
    if (energyFrac > 0.001) {
      ctx.strokeStyle = PALETTE.energy;
      if (run.overdriveReady) {
        ctx.shadowColor = PALETTE.energy;
        ctx.shadowBlur = 10 + Math.sin(time * 9) * 6;
      }
      ctx.beginPath();
      ctx.arc(0, 0, ringR, -Math.PI / 2, -Math.PI / 2 + TAU * energyFrac);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // The core itself: a hexagon that breathes, faster and redder as it takes
    // damage. Health is on the shape, not only on a number in the corner.
    const breath = 1 + Math.sin(this.corePulse * (2 + hurt * 5)) * (0.02 + hurt * 0.05);
    const tint = hurt > 0.5 ? PALETTE.danger : PALETTE.accent;
    const flash = invuln && Math.floor(time * 12) % 2 === 0 ? 0.55 : 0;

    ctx.save();
    ctx.scale(breath, breath);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU - Math.PI / 2;
      const x = Math.cos(a) * coreR;
      const y = Math.sin(a) * coreR;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();

    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, coreR);
    grad.addColorStop(0, withAlpha(tint, 0.55 + flash));
    grad.addColorStop(0.7, withAlpha(tint, 0.16));
    grad.addColorStop(1, withAlpha(tint, 0.06));
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = withAlpha(tint, 0.85);
    ctx.lineWidth = 2;
    ctx.stroke();

    // Fracture lines appear as integrity drops - a second, non-colour channel
    // for "you are nearly dead".
    const cracks = run.maxHp - run.hp;
    if (cracks > 0) {
      ctx.strokeStyle = withAlpha(PALETTE.danger, 0.75);
      ctx.lineWidth = 1.4;
      for (let i = 0; i < cracks; i++) {
        const a = (i / Math.max(1, cracks)) * TAU + 0.6;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * coreR * 0.92, Math.sin(a) * coreR * 0.92);
        ctx.lineTo(
          Math.cos(a + 0.35) * coreR * 0.55,
          Math.sin(a + 0.35) * coreR * 0.55,
        );
        ctx.stroke();
      }
    }
    ctx.restore();
    ctx.restore();
  }

  drawShield(ctx: CanvasRenderingContext2D, layout: ArenaLayout, run: Run, time: number): void {
    const R = layout.radius;
    const orbit = ARENA.shieldOrbit * R;
    const thickness = Math.max(7, ARENA.shieldHalfThickness * 2 * R);
    const half = run.halfArc;
    const sweetHalf = half * run.sweetFraction;
    const center = run.shieldCenter;
    const stunned = run.stunT > 0;

    ctx.save();
    ctx.translate(layout.cx, layout.cy);

    // Aim guide: a faint spoke from the core out through the shield. Without
    // it, judging "is my sweet spot actually on that shot" is guesswork.
    ctx.strokeStyle = withAlpha(PALETTE.accent, stunned ? 0.06 : 0.14);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.cos(center) * ARENA.coreRadius * R * 1.6, Math.sin(center) * ARENA.coreRadius * R * 1.6);
    ctx.lineTo(Math.cos(center) * R * 1.02, Math.sin(center) * R * 1.02);
    ctx.stroke();

    if (stunned) {
      // Disabled shield: broken, red, unmistakable.
      const blink = Math.floor(time * 14) % 2 === 0 ? 0.55 : 0.2;
      ctx.strokeStyle = withAlpha(PALETTE.danger, blink);
      ctx.lineWidth = thickness * 0.55;
      ctx.lineCap = 'butt';
      const seg = (half * 2) / 5;
      for (let i = 0; i < 5; i += 2) {
        ctx.beginPath();
        ctx.arc(0, 0, orbit, center - half + i * seg, center - half + (i + 1) * seg);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }

    // Motion trail: previous shield positions, fading. This is what makes a
    // fast sweep feel fast rather than teleported.
    ctx.lineCap = 'round';
    for (let i = 0; i < this.shieldTrail.length - 1; i++) {
      const a = this.shieldTrail[i]!;
      const t = (i + 1) / this.shieldTrail.length;
      ctx.globalAlpha = t * 0.18;
      ctx.strokeStyle = PALETTE.shield;
      ctx.lineWidth = thickness * (0.5 + t * 0.4);
      ctx.beginPath();
      ctx.arc(0, 0, orbit, a - half, a + half);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Body of the shield.
    ctx.strokeStyle = withAlpha(PALETTE.shield, 0.75);
    ctx.lineWidth = thickness;
    ctx.beginPath();
    ctx.arc(0, 0, orbit, center - half, center + half);
    ctx.stroke();

    // Sweet spot. Brighter, thicker, and flanked by two notches so it reads as
    // a distinct zone rather than "slightly lighter blue".
    if (run.overdriveReady) {
      ctx.shadowColor = PALETTE.energy;
      ctx.shadowBlur = 14 + Math.sin(time * 10) * 5;
    }
    ctx.strokeStyle = run.overdriveReady ? PALETTE.energy : PALETTE.sweet;
    ctx.lineWidth = thickness * 1.18;
    ctx.beginPath();
    ctx.arc(0, 0, orbit, center - sweetHalf, center + sweetHalf);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = withAlpha(PALETTE.sweet, 0.5);
    ctx.lineWidth = 2;
    for (const side of [-1, 1]) {
      const a = center + side * sweetHalf;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (orbit - thickness), Math.sin(a) * (orbit - thickness));
      ctx.lineTo(Math.cos(a) * (orbit + thickness), Math.sin(a) * (orbit + thickness));
      ctx.stroke();
    }
    ctx.restore();
  }

  drawProjectiles(
    ctx: CanvasRenderingContext2D,
    layout: ArenaLayout,
    run: Run,
    time: number,
  ): void {
    for (const p of run.projectiles) {
      if (!p.active) continue;
      this.drawProjectile(ctx, layout, p, time);
    }
  }

  private drawProjectile(
    ctx: CanvasRenderingContext2D,
    layout: ArenaLayout,
    p: Projectile,
    time: number,
  ): void {
    const R = layout.radius;
    const pos = toScreen(layout, p.r, p.a);
    const size = p.radius * R;
    const color = PROJ_COLORS[p.kind];
    const alpha = p.telegraph;
    const outward = p.outbound || p.returning;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(pos.x, pos.y);
    // Point every shot along its direction of travel, so silhouette also
    // encodes "coming at you" vs "heading away".
    ctx.rotate(p.a + (outward ? 0 : Math.PI));

    // Trail.
    const trailLen = size * (p.kind === 'swift' ? 4.2 : 2.2) * (p.outbound ? 1.6 : 1);
    const grad = ctx.createLinearGradient(0, 0, -trailLen, 0);
    grad.addColorStop(0, withAlpha(color, 0.5));
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.55);
    ctx.lineTo(-trailLen, 0);
    ctx.lineTo(0, size * 0.55);
    ctx.closePath();
    ctx.fill();

    ctx.globalCompositeOperation = 'lighter';
    switch (p.kind) {
      case 'basic': {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, TAU);
        ctx.fill();
        ctx.fillStyle = withAlpha('#ffffff', 0.85);
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.42, 0, TAU);
        ctx.fill();
        break;
      }
      case 'swift': {
        // A dart. Long and thin: reads as fast even standing still.
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(size * 1.5, 0);
        ctx.lineTo(-size * 0.7, -size * 0.85);
        ctx.lineTo(-size * 0.2, 0);
        ctx.lineTo(-size * 0.7, size * 0.85);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'heavy': {
        ctx.fillStyle = withAlpha(color, 0.55);
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(3, size * 0.32);
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.78, 0, TAU);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-size * 0.5, 0);
        ctx.lineTo(size * 0.5, 0);
        ctx.moveTo(0, -size * 0.5);
        ctx.lineTo(0, size * 0.5);
        ctx.stroke();
        break;
      }
      case 'splitter': {
        // Drawn as two halves with a visible seam: it looks like it is about
        // to come apart, because it is.
        ctx.fillStyle = color;
        const gap = size * 0.18 + Math.sin(time * 7) * size * 0.06;
        ctx.beginPath();
        ctx.arc(0, -gap, size * 0.82, Math.PI, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, gap, size * 0.82, 0, Math.PI);
        ctx.fill();
        break;
      }
      case 'void': {
        // Hollow, with an inward chevron. The silhouette says "let me through".
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(2.5, size * 0.28);
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, TAU);
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = PALETTE.bg;
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.72, 0, TAU);
        ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        for (let i = 0; i < 2; i++) {
          const off = size * (0.15 + i * 0.4);
          ctx.beginPath();
          ctx.moveTo(off + size * 0.35, -size * 0.42);
          ctx.lineTo(off - size * 0.1, 0);
          ctx.lineTo(off + size * 0.35, size * 0.42);
          ctx.stroke();
        }
        break;
      }
      case 'armored': {
        ctx.fillStyle = withAlpha(color, 0.25);
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.7, 0, TAU);
        ctx.fill();
        // Faceted shell: only a clean parry gets through it.
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(2.5, size * 0.3);
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU;
          const x = Math.cos(a) * size;
          const y = Math.sin(a) * size;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
        break;
      }
    }
    ctx.restore();

    // Boundary telegraph: a bright tick on the arena ring at the shot's angle
    // while it fades in, so the eye is pulled to where it will come from.
    if (p.telegraph < 1 && !p.outbound) {
      const t = 1 - p.telegraph;
      const edge = toScreen(layout, 1.0, p.a);
      ctx.save();
      ctx.globalAlpha = t * 0.9;
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(edge.x, edge.y, 6 + t * 26, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawTurrets(ctx: CanvasRenderingContext2D, layout: ArenaLayout, run: Run, time: number): void {
    for (const t of run.turrets) {
      if (!t.active) continue;
      this.drawTurret(ctx, layout, t, time);
    }
  }

  private drawTurret(
    ctx: CanvasRenderingContext2D,
    layout: ArenaLayout,
    t: Turret,
    time: number,
  ): void {
    const R = layout.radius;
    const pos = toScreen(layout, ARENA.turretRadius, t.a);
    const size = TURRET.radius * R;
    const spawning = t.spawnT > 0;
    const appear = spawning ? clamp01(1 - t.spawnT / 1.2) : 1;

    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(t.a + Math.PI / 2);
    ctx.globalAlpha = ease.outCubic(appear);
    const scale = lerp(0.3, 1, ease.outBack(appear));
    ctx.scale(scale, scale);

    const flash = t.hitFlash > 0 ? clamp01(t.hitFlash / 0.18) : 0;
    const col = flash > 0 ? '#ffffff' : PALETTE.danger;

    ctx.fillStyle = withAlpha(col, 0.22 + flash * 0.5);
    ctx.strokeStyle = col;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(size * 0.92, size * 0.75);
    ctx.lineTo(-size * 0.92, size * 0.75);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Charge glow just before firing.
    if (!spawning && t.fireT < 0.6) {
      const k = 1 - t.fireT / 0.6;
      ctx.globalAlpha = k * 0.8;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, -size * 0.25, size * 0.3 * k, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // Health arc above the turret.
    if (!spawning && t.hp < t.maxHp) {
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = withAlpha(PALETTE.danger, 0.9);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, size * 1.5, -Math.PI, -Math.PI + Math.PI * (t.hp / t.maxHp));
      ctx.stroke();
      ctx.restore();
    }

    if (spawning) {
      // Warning ring so a turret never simply materialises and fires.
      const k = clamp01(t.spawnT / 1.2);
      ctx.save();
      ctx.globalAlpha = k;
      ctx.strokeStyle = PALETTE.danger;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.lineDashOffset = -time * 40;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, size * (1.4 + k * 1.6), 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawBlast(ctx: CanvasRenderingContext2D, layout: ArenaLayout, run: Run): void {
    if (!run.blastActive) return;
    const R = layout.radius;
    const r = run.blastR * R;
    const fade = clamp01(run.blastT / 0.55);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(layout.cx, layout.cy, r * 0.62, layout.cx, layout.cy, r);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.75, withAlpha(PALETTE.energy, 0.26 * fade));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(layout.cx, layout.cy, r, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = withAlpha(PALETTE.energy, fade);
    ctx.lineWidth = 3 + fade * 5;
    ctx.beginPath();
    ctx.arc(layout.cx, layout.cy, r, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  /** The floating stick, drawn only while a finger is down. */
  drawStick(
    ctx: CanvasRenderingContext2D,
    originX: number,
    originY: number,
    x: number,
    y: number,
    magnitude: number,
  ): void {
    ctx.save();
    ctx.globalAlpha = 0.24 + magnitude * 0.22;
    ctx.strokeStyle = PALETTE.accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(originX, originY, 34, 0, TAU);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(x, y);
    ctx.stroke();

    ctx.globalAlpha = 0.4 + magnitude * 0.3;
    ctx.fillStyle = PALETTE.accent;
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  /**
   * Wave number, drawn huge and faint *behind* the play area rather than over
   * it. A banner on top of the shield hides the one thing the player is
   * looking at, at exactly the moment a new wave starts.
   */
  drawWaveBanner(
    ctx: CanvasRenderingContext2D,
    layout: ArenaLayout,
    wave: number,
    t: number,
  ): void {
    if (t <= 0) return;
    const k = clamp01(t / 1.6);
    const appear = ease.outCubic(clamp01((1 - k) * 5));
    const fade = k > 0.45 ? 1 : k / 0.45;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.1 * fade * appear;
    ctx.fillStyle = PALETTE.ink;
    const size = layout.radius * (0.9 + (1 - appear) * 0.25);
    ctx.font = `700 ${Math.round(size)}px ${FONT}`;
    ctx.fillText(String(wave), layout.cx, layout.cy);

    ctx.globalAlpha = 0.5 * fade * appear;
    ctx.fillStyle = PALETTE.accent;
    ctx.font = `700 12px ${FONT}`;
    ctx.fillText('WAVE', layout.cx, layout.cy - layout.radius * 0.92);
    ctx.restore();
  }
}

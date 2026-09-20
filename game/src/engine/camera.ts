/**
 * Camera feel: trauma-based shake, hit-stop and zoom punch.
 *
 * Shake uses the trauma model (shake = trauma^2) rather than a raw offset.
 * Squaring makes small events barely wobble and big events slam, which is what
 * gives a range of impacts distinct weight instead of one uniform rattle.
 *
 * Hit-stop freezes the simulation for a few milliseconds on a strong parry.
 * It is the single highest-value "juice" technique available: the pause
 * registers the impact before the effects even play.
 */
import { TAU, clamp01, damp } from './math';

export class Camera {
  x = 0;
  y = 0;
  zoom = 1;
  angle = 0;

  private trauma = 0;
  private traumaDecay = 1.6;
  private seed = 1337;
  private time = 0;
  private zoomTarget = 1;
  private zoomPunch = 0;

  /** Seconds of simulation freeze remaining. */
  hitStop = 0;

  /** Player-facing accessibility switch; halves shake and disables rotation. */
  reducedMotion = false;

  /** @param amount 0..1; values stack but saturate at 1. */
  shake(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  /** @param seconds typically 0.03-0.12. Longer than ~0.15 reads as a bug. */
  stop(seconds: number): void {
    this.hitStop = Math.max(this.hitStop, seconds);
  }

  punch(amount: number): void {
    this.zoomPunch = Math.max(this.zoomPunch, amount);
  }

  setZoom(target: number): void {
    this.zoomTarget = target;
  }

  reset(): void {
    this.x = this.y = 0;
    this.angle = 0;
    this.zoom = this.zoomTarget = 1;
    this.trauma = 0;
    this.zoomPunch = 0;
    this.hitStop = 0;
  }

  /** Consumes hit-stop time; returns true when the simulation should run. */
  consumeHitStop(dt: number): boolean {
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      return false;
    }
    return true;
  }

  update(dt: number, maxOffset = 18): void {
    this.time += dt;

    this.trauma = Math.max(0, this.trauma - this.traumaDecay * dt);
    const shake = this.trauma * this.trauma * (this.reducedMotion ? 0.35 : 1);

    if (shake > 0.0001) {
      // Two decorrelated sine stacks approximate smooth noise without the cost
      // (or the frame-to-frame jitter) of random offsets.
      const t = this.time * 34;
      this.x = maxOffset * shake * (Math.sin(t * 1.13 + this.seed) * 0.6 + Math.sin(t * 2.31) * 0.4);
      this.y =
        maxOffset * shake * (Math.sin(t * 1.47 + this.seed * 1.7) * 0.6 + Math.sin(t * 2.79) * 0.4);
      this.angle = this.reducedMotion ? 0 : 0.012 * shake * Math.sin(t * 0.9);
    } else {
      this.x = damp(this.x, 0, 14, dt);
      this.y = damp(this.y, 0, 14, dt);
      this.angle = damp(this.angle, 0, 14, dt);
    }

    this.zoomPunch = Math.max(0, this.zoomPunch - dt * 3.4);
    const punch = Math.sin(clamp01(this.zoomPunch) * Math.PI) * 0.06;
    this.zoom = damp(this.zoom, this.zoomTarget + punch, 12, dt);
  }

  /** Applies the camera transform around a pivot, in CSS pixels. */
  apply(ctx: CanvasRenderingContext2D, pivotX: number, pivotY: number): void {
    ctx.translate(pivotX + this.x, pivotY + this.y);
    if (this.angle !== 0) ctx.rotate(this.angle);
    if (this.zoom !== 1) ctx.scale(this.zoom, this.zoom);
    ctx.translate(-pivotX, -pivotY);
  }

  get traumaLevel(): number {
    return this.trauma;
  }

  /** Deterministic directional kick, used when an impact has a clear vector. */
  directionalShake(angle: number, amount: number): void {
    this.shake(amount);
    this.x += Math.cos(angle) * amount * 10;
    this.y += Math.sin(angle) * amount * 10;
    this.seed = (this.seed + Math.floor(angle * 1000)) % TAU;
  }
}

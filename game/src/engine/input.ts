/**
 * One-thumb input.
 *
 * The shield is steered by a *floating virtual stick*: press anywhere, and the
 * direction from the press origin to your finger becomes the shield's angle.
 * This is deliberately not "point at the spot you want" - on a phone held in
 * one hand the thumb physically cannot reach the top of the screen, so an
 * absolute scheme would lock out a third of the play circle. A relative stick
 * reaches all 360 degrees from a two-centimetre flick.
 *
 * The origin also *trails* the finger past a maximum radius, so long drags
 * re-centre instead of running out of travel.
 */
import { TAU, clamp } from './math';

export interface TapEvent {
  x: number;
  y: number;
}

const DEAD_ZONE = 10; // px of travel before an aim is registered
const MAX_STICK = 64; // px; beyond this the origin trails the finger
const TAP_MAX_MS = 280;
const TAP_MAX_DIST = 16;

export class Input {
  /** Current shield aim in radians, or null when the player is not steering. */
  aimAngle: number | null = null;
  /** 0..1 how far past the dead zone the stick is pushed. */
  stickMagnitude = 0;
  /** True while a finger/mouse button is held down. */
  isDown = false;

  /** Live pointer position in CSS pixels (last known, even when up). */
  x = 0;
  y = 0;
  /** Floating stick origin, for drawing the on-screen stick. */
  originX = 0;
  originY = 0;

  private pointerId: number | null = null;
  private downTime = 0;
  private downX = 0;
  private downY = 0;
  private moved = 0;
  private pendingTaps: TapEvent[] = [];
  private keys = new Set<string>();
  private keyAngle: number | null = null;
  private el: HTMLElement | null = null;
  private enabled = true;

  attach(el: HTMLElement): void {
    this.el = el;
    el.addEventListener('pointerdown', this.onDown);
    // Move/up are bound to the window so a drag that leaves the canvas (or the
    // screen edge) still tracks, and a release outside still ends the drag.
    window.addEventListener('pointermove', this.onMove, { passive: false });
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    // Block the long-press context menu; it interrupts play on Android.
    el.addEventListener('contextmenu', this.preventDefault);
  }

  detach(): void {
    this.el?.removeEventListener('pointerdown', this.onDown);
    this.el?.removeEventListener('contextmenu', this.preventDefault);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.el = null;
  }

  /** Drops all held state. Used when the app is backgrounded. */
  reset(): void {
    this.pointerId = null;
    this.isDown = false;
    this.aimAngle = null;
    this.stickMagnitude = 0;
    this.keys.clear();
    this.keyAngle = null;
    this.pendingTaps.length = 0;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) this.reset();
  }

  /** Pops the oldest tap, if any. UI screens poll this once per frame. */
  consumeTap(): TapEvent | null {
    return this.pendingTaps.shift() ?? null;
  }

  clearTaps(): void {
    this.pendingTaps.length = 0;
  }

  isKeyDown(code: string): boolean {
    return this.keys.has(code);
  }

  private preventDefault = (e: Event): void => {
    e.preventDefault();
  };

  private localPoint(e: PointerEvent): { x: number; y: number } {
    const rect = this.el?.getBoundingClientRect();
    return {
      x: e.clientX - (rect?.left ?? 0),
      y: e.clientY - (rect?.top ?? 0),
    };
  }

  private onDown = (e: PointerEvent): void => {
    if (!this.enabled) return;
    // Multi-touch: the first finger owns the stick. Extra fingers are ignored
    // rather than fighting over the aim, which is what players expect.
    if (this.pointerId !== null) return;
    this.pointerId = e.pointerId;
    const p = this.localPoint(e);
    this.isDown = true;
    this.x = this.originX = this.downX = p.x;
    this.y = this.originY = this.downY = p.y;
    this.downTime = performance.now();
    this.moved = 0;
    this.stickMagnitude = 0;
    try {
      this.el?.setPointerCapture(e.pointerId);
    } catch {
      /* capture is best-effort; the window listeners cover the fallback */
    }
    e.preventDefault();
  };

  private onMove = (e: PointerEvent): void => {
    if (!this.enabled || e.pointerId !== this.pointerId) return;
    const p = this.localPoint(e);
    this.x = p.x;
    this.y = p.y;
    this.moved = Math.max(this.moved, Math.hypot(p.x - this.downX, p.y - this.downY));

    let dx = this.x - this.originX;
    let dy = this.y - this.originY;
    const dist = Math.hypot(dx, dy);

    if (dist > MAX_STICK) {
      // Drag the origin along behind the finger so the stick never bottoms out.
      const pull = dist - MAX_STICK;
      this.originX += (dx / dist) * pull;
      this.originY += (dy / dist) * pull;
      dx = this.x - this.originX;
      dy = this.y - this.originY;
    }

    const mag = Math.hypot(dx, dy);
    if (mag >= DEAD_ZONE) {
      this.aimAngle = Math.atan2(dy, dx);
      this.stickMagnitude = clamp((mag - DEAD_ZONE) / (MAX_STICK - DEAD_ZONE), 0, 1);
    } else {
      // Inside the dead zone we hold the previous angle rather than snapping to
      // zero, so a momentary thumb wobble does not fling the shield to the right.
      this.stickMagnitude = 0;
    }
    e.preventDefault();
  };

  private onUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    const heldMs = performance.now() - this.downTime;
    if (heldMs <= TAP_MAX_MS && this.moved <= TAP_MAX_DIST) {
      this.pendingTaps.push({ x: this.downX, y: this.downY });
      // Cap the queue: a frame that never polls taps should not grow forever.
      if (this.pendingTaps.length > 8) this.pendingTaps.shift();
    }
    try {
      this.el?.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    this.pointerId = null;
    this.isDown = false;
    this.stickMagnitude = 0;
    // aimAngle is intentionally kept: releasing leaves the shield where it was.
  };

  private onBlur = (): void => {
    this.reset();
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!this.enabled) return;
    this.keys.add(e.code);
    if (e.code === 'Space' || e.code === 'Enter') {
      // Keyboard "tap" lands at the screen centre; screens treat a centre tap
      // as "confirm the primary action".
      this.pendingTaps.push({ x: -1, y: -1 });
    }
    this.updateKeyAim();
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
    this.updateKeyAim();
  };

  /** Desktop fallback so the game is playable (and testable) without a touch screen. */
  private updateKeyAim(): void {
    let dx = 0;
    let dy = 0;
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) dx -= 1;
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) dx += 1;
    if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) dy -= 1;
    if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) dy += 1;
    if (dx === 0 && dy === 0) {
      this.keyAngle = null;
      return;
    }
    this.keyAngle = Math.atan2(dy, dx);
    this.aimAngle = this.keyAngle;
    this.stickMagnitude = 1;
  }
}

/** Normalises any angle into [0, TAU) - re-exported for call sites. */
export function normalizeAim(a: number): number {
  const x = a % TAU;
  return x < 0 ? x + TAU : x;
}

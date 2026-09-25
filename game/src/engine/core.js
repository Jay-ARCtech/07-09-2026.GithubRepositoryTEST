import { clamp, lerp } from "./utils.js";

export class Camera {
  constructor() {
    this.zoom = 1;
    this.targetZoom = 1;
    this.shakeTime = 0;
    this.shakeMag = 0;
    this.shakeEnabled = true;
  }
  kick(mag, time) {
    if (!this.shakeEnabled) return;
    this.shakeMag = Math.max(this.shakeMag, mag);
    this.shakeTime = Math.max(this.shakeTime, time);
  }
  pulseZoom(amount, _duration = 0.25) {
    this.targetZoom = 1 + amount;
  }
  update(dt) {
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
    } else {
      this.shakeMag = 0;
    }
    this.targetZoom = lerp(this.targetZoom, 1, dt * 3);
    this.zoom = lerp(this.zoom, this.targetZoom, dt * 8);
  }
  getShakeOffset() {
    if (this.shakeMag <= 0) return { x: 0, y: 0 };
    const t = this.shakeTime;
    const decay = clamp(t, 0, 1);
    return {
      x: (Math.random() * 2 - 1) * this.shakeMag * decay,
      y: (Math.random() * 2 - 1) * this.shakeMag * decay,
    };
  }
}

export function setupCanvas(canvas) {
  const ctx = canvas.getContext("2d", { alpha: false });
  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", resize);
  resize();
  return ctx;
}

// Fixed max-dt RAF loop: prevents huge dt spikes (tab backgrounded, dev
// tools open) from teleporting entities or breaking collision.
export function startLoop(callback) {
  let last = performance.now();
  let rafId = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    callback(dt, now);
    rafId = requestAnimationFrame(frame);
  }
  rafId = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(rafId);
}

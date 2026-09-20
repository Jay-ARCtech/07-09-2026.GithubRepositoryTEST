/**
 * Fixed-timestep game loop with a rendering interpolation budget.
 *
 * Simulation runs at a fixed 120Hz regardless of display refresh rate. That
 * matters here because parry windows are measured in milliseconds: a variable
 * timestep would make the game measurably easier on a 120Hz phone than on a
 * 60Hz one, which is exactly the kind of unfairness that shows up in reviews.
 */

export const SIM_HZ = 120;
export const SIM_DT = 1 / SIM_HZ;

/** Hard ceiling on catch-up steps, so a backgrounded tab cannot spiral. */
const MAX_STEPS_PER_FRAME = 8;
/** Frame deltas longer than this are treated as a pause, not as lost time. */
const MAX_FRAME_DELTA = 0.25;

export interface LoopCallbacks {
  /** Advances the simulation by exactly SIM_DT seconds. */
  update(dt: number): void;
  /** Draws a frame. `alpha` is the interpolation factor into the next step. */
  render(alpha: number, frameDt: number): void;
}

export class GameLoop {
  private running = false;
  private rafId = 0;
  private lastTime = 0;
  private accumulator = 0;
  private cbs: LoopCallbacks;

  /** Smoothed frames-per-second, for the debug overlay. */
  fps = 60;

  constructor(cbs: LoopCallbacks) {
    this.cbs = cbs;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  /**
   * Discards accumulated time without simulating it. Call this when returning
   * from background so the player does not eat a burst of missed frames.
   */
  resetClock(): void {
    this.lastTime = performance.now();
    this.accumulator = 0;
  }

  get isRunning(): boolean {
    return this.running;
  }

  private tick = (now: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.tick);

    let frameDt = (now - this.lastTime) / 1000;
    this.lastTime = now;

    if (frameDt > 0) this.fps += (1 / frameDt - this.fps) * 0.08;

    // A long gap means the app was suspended. Swallow it rather than
    // fast-forwarding the player into a wall of projectiles.
    if (frameDt > MAX_FRAME_DELTA) frameDt = SIM_DT;

    this.accumulator += frameDt;

    let steps = 0;
    while (this.accumulator >= SIM_DT && steps < MAX_STEPS_PER_FRAME) {
      this.cbs.update(SIM_DT);
      this.accumulator -= SIM_DT;
      steps++;
    }

    // If we hit the step ceiling we are running behind; drop the remainder so
    // the backlog does not compound frame after frame.
    if (steps >= MAX_STEPS_PER_FRAME) this.accumulator = 0;

    this.cbs.render(this.accumulator / SIM_DT, frameDt);
  };
}

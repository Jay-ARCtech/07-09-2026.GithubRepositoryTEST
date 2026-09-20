/**
 * Canvas sizing, device-pixel-ratio handling and safe-area insets.
 *
 * The game is laid out in CSS pixels; the canvas backing store is scaled up by
 * the DPR so everything stays crisp on retina panels. DPR is capped because a
 * 3x backing store on a large phone costs roughly 2.5x the fill rate of a 2x
 * one for no visible gain.
 */

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const MAX_DPR = 2.5;

export class Viewport {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;

  /** Logical size in CSS pixels. */
  width = 0;
  height = 0;
  dpr = 1;

  /** Safe-area insets in CSS pixels (notch, home indicator, status bar). */
  insets: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

  private probe: HTMLDivElement;
  private onResize: (() => void) | null = null;
  private resizeHandler = (): void => this.resize();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (!ctx) throw new Error('2D canvas context unavailable');
    this.ctx = ctx;

    // A zero-size probe whose padding is driven by env(safe-area-inset-*).
    // Reading its computed padding is the only reliable cross-platform way to
    // get the insets as numbers.
    this.probe = document.createElement('div');
    this.probe.setAttribute('aria-hidden', 'true');
    this.probe.style.cssText =
      'position:fixed;top:0;left:0;width:0;height:0;pointer-events:none;visibility:hidden;' +
      'padding-top:env(safe-area-inset-top);padding-right:env(safe-area-inset-right);' +
      'padding-bottom:env(safe-area-inset-bottom);padding-left:env(safe-area-inset-left);';
    document.body.appendChild(this.probe);
  }

  start(onResize: () => void): void {
    this.onResize = onResize;
    window.addEventListener('resize', this.resizeHandler, { passive: true });
    window.addEventListener('orientationchange', this.resizeHandler, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', this.resizeHandler, { passive: true });
    }
    this.resize();
  }

  stop(): void {
    window.removeEventListener('resize', this.resizeHandler);
    window.removeEventListener('orientationchange', this.resizeHandler);
    window.visualViewport?.removeEventListener('resize', this.resizeHandler);
    this.probe.remove();
    this.onResize = null;
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width || window.innerWidth));
    const h = Math.max(1, Math.round(rect.height || window.innerHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);

    const bw = Math.round(w * dpr);
    const bh = Math.round(h * dpr);

    // Only touch the backing store when it actually changes: assigning to
    // canvas.width clears the surface and reallocates GPU memory.
    if (this.canvas.width !== bw || this.canvas.height !== bh) {
      this.canvas.width = bw;
      this.canvas.height = bh;
    }

    this.width = w;
    this.height = h;
    this.dpr = dpr;
    this.readInsets();
    this.onResize?.();
  }

  private readInsets(): void {
    const cs = getComputedStyle(this.probe);
    this.insets = {
      top: parseFloat(cs.paddingTop) || 0,
      right: parseFloat(cs.paddingRight) || 0,
      bottom: parseFloat(cs.paddingBottom) || 0,
      left: parseFloat(cs.paddingLeft) || 0,
    };
  }

  /** Resets the transform to CSS-pixel space for a new frame. */
  beginFrame(): void {
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  /** Usable rect after safe-area insets, in CSS pixels. */
  get safeTop(): number {
    return this.insets.top;
  }
  get safeBottom(): number {
    return this.height - this.insets.bottom;
  }
  get safeLeft(): number {
    return this.insets.left;
  }
  get safeRight(): number {
    return this.width - this.insets.right;
  }
  get safeWidth(): number {
    return this.safeRight - this.safeLeft;
  }
  get safeHeight(): number {
    return this.safeBottom - this.safeTop;
  }
}

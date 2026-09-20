/**
 * Drawing primitives and a tiny immediate-mode UI.
 *
 * All UI is drawn on the canvas rather than in the DOM. That is a deliberate
 * choice: a game that mixes canvas with HTML buttons ends up with two different
 * scroll behaviours, two focus models, and a visible seam on notched displays.
 * It is also the difference between an app and a web page in a wrapper, which
 * matters for App Store review.
 *
 * The UI is immediate-mode: screens call `ui.button(...)` every frame and get
 * back whether it was pressed. There is no retained widget tree to keep in sync
 * with game state, which for a handful of screens is far less code and far
 * fewer bugs.
 */
import { TAU, clamp01, ease, pointInRect } from '../engine/math';
import { PALETTE } from '../game/config';

export const FONT =
  'ui-monospace, "SF Mono", "Roboto Mono", Menlo, Consolas, monospace';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function rect(x: number, y: number, w: number, h: number): Rect {
  return { x, y, w, h };
}

export function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

/**
 * Draws text with manual letter spacing.
 *
 * `ctx.letterSpacing` exists but is still missing or buggy in some webviews,
 * and the whole look of this game leans on wide tracking - so it is done by
 * hand, which works everywhere.
 */
export function trackedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  tracking: number,
  align: CanvasTextAlign = 'center',
): void {
  if (tracking <= 0) {
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
    return;
  }
  const widths: number[] = [];
  let total = 0;
  for (const ch of text) {
    const w = ctx.measureText(ch).width;
    widths.push(w);
    total += w + tracking;
  }
  total -= tracking;

  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  let i = 0;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += (widths[i] ?? 0) + tracking;
    i++;
  }
  ctx.textAlign = prevAlign;
}

export function measureTracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  tracking: number,
): number {
  let total = 0;
  for (const ch of text) total += ctx.measureText(ch).width + tracking;
  return Math.max(0, total - tracking);
}

/** Wraps `text` to `maxWidth`, returning the lines. */
export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function withAlpha(hex: string, alpha: number): string {
  // Accepts #rgb / #rrggbb only; anything else is returned untouched so
  // rgba() strings from the palette still work.
  if (!hex.startsWith('#')) return hex;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1]! + hex[1]!, 16);
    g = parseInt(hex[2]! + hex[2]!, 16);
    b = parseInt(hex[3]! + hex[3]!, 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.slice(1, 3), 16);
    g = parseInt(hex.slice(3, 5), 16);
    b = parseInt(hex.slice(5, 7), 16);
  } else {
    return hex;
  }
  return `rgba(${r}, ${g}, ${b}, ${clamp01(alpha)})`;
}

export interface ButtonStyle {
  tone?: 'primary' | 'ghost' | 'danger' | 'gold';
  disabled?: boolean;
  small?: boolean;
  badge?: string;
}

/**
 * Immediate-mode UI context.
 *
 * `begin()` is called once per frame with the tap (if any) that arrived this
 * frame. Widgets consume it. Anything not consumed is dropped, which keeps a
 * stray tap from firing a button on a screen that has since changed.
 */
export class Ui {
  ctx: CanvasRenderingContext2D;
  private tapX = -1;
  private tapY = -1;
  private tapUsed = true;
  /** Rising 0..1 used to fade a screen in. */
  transition = 1;
  /** Press feedback keyed by button label. */
  private pressT = new Map<string, number>();

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  begin(tap: { x: number; y: number } | null, dt: number): void {
    if (tap) {
      this.tapX = tap.x;
      this.tapY = tap.y;
      this.tapUsed = false;
    } else {
      this.tapUsed = true;
    }
    for (const [k, v] of this.pressT) {
      const nv = v - dt * 4;
      if (nv <= 0) this.pressT.delete(k);
      else this.pressT.set(k, nv);
    }
  }

  /** True if the pending tap falls inside `r`; consumes it. */
  hit(r: Rect): boolean {
    if (this.tapUsed) return false;
    // A centre tap (-1,-1) is the keyboard's "confirm"; it is handled by the
    // caller via `keyboardConfirm`, not by hit-testing.
    if (this.tapX < 0 || this.tapY < 0) return false;
    if (!pointInRect(this.tapX, this.tapY, r.x, r.y, r.w, r.h)) return false;
    this.tapUsed = true;
    return true;
  }

  /** True when the pending tap is the keyboard confirm; consumes it. */
  keyboardConfirm(): boolean {
    if (this.tapUsed) return false;
    if (this.tapX >= 0 || this.tapY >= 0) return false;
    this.tapUsed = true;
    return true;
  }

  /** True if the pending tap landed anywhere; consumes it. */
  anyTap(): boolean {
    if (this.tapUsed) return false;
    this.tapUsed = true;
    return true;
  }

  panel(r: Rect, opts: { radius?: number; alpha?: number; edge?: string } = {}): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = (opts.alpha ?? 1) * this.transition;
    roundRectPath(ctx, r.x, r.y, r.w, r.h, opts.radius ?? 18);
    ctx.fillStyle = PALETTE.panel;
    ctx.fill();
    ctx.strokeStyle = opts.edge ?? PALETTE.panelEdge;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  label(
    text: string,
    x: number,
    y: number,
    opts: {
      size?: number;
      color?: string;
      weight?: number;
      tracking?: number;
      align?: CanvasTextAlign;
      alpha?: number;
    } = {},
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = (opts.alpha ?? 1) * this.transition;
    ctx.fillStyle = opts.color ?? PALETTE.ink;
    ctx.font = `${opts.weight ?? 600} ${opts.size ?? 15}px ${FONT}`;
    ctx.textBaseline = 'middle';
    trackedText(ctx, text, x, y, opts.tracking ?? 0, opts.align ?? 'center');
    ctx.restore();
  }

  /** Draws a button and returns true when it was pressed this frame. */
  button(r: Rect, text: string, style: ButtonStyle = {}): boolean {
    const ctx = this.ctx;
    const tone = style.tone ?? 'primary';
    const disabled = style.disabled === true;
    const pressed = !disabled && this.hit(r);
    if (pressed) this.pressT.set(text, 1);

    const press = this.pressT.get(text) ?? 0;
    const squash = 1 - ease.pop(press) * 0.035;

    const colors: Record<string, { fill: string; edge: string; ink: string }> = {
      primary: {
        fill: withAlpha(PALETTE.accent, 0.14),
        edge: withAlpha(PALETTE.accent, 0.55),
        ink: PALETTE.accent,
      },
      ghost: {
        fill: 'rgba(232, 240, 255, 0.05)',
        edge: 'rgba(232, 240, 255, 0.2)',
        ink: PALETTE.ink,
      },
      danger: {
        fill: withAlpha(PALETTE.danger, 0.14),
        edge: withAlpha(PALETTE.danger, 0.5),
        ink: PALETTE.danger,
      },
      gold: {
        fill: withAlpha(PALETTE.gold, 0.14),
        edge: withAlpha(PALETTE.gold, 0.55),
        ink: PALETTE.gold,
      },
    };
    const c = colors[tone]!;

    ctx.save();
    ctx.globalAlpha = (disabled ? 0.34 : 1) * this.transition;
    ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
    ctx.scale(squash, squash);
    ctx.translate(-(r.x + r.w / 2), -(r.y + r.h / 2));

    roundRectPath(ctx, r.x, r.y, r.w, r.h, style.small ? 10 : 14);
    ctx.fillStyle = c.fill;
    ctx.fill();
    ctx.strokeStyle = c.edge;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = c.ink;
    const size = style.small ? 13 : 16;
    ctx.font = `700 ${size}px ${FONT}`;
    ctx.textBaseline = 'middle';
    trackedText(ctx, text, r.x + r.w / 2, r.y + r.h / 2 + 0.5, 2, 'center');

    if (style.badge) {
      ctx.font = `700 11px ${FONT}`;
      ctx.fillStyle = PALETTE.gold;
      ctx.textAlign = 'right';
      ctx.fillText(style.badge, r.x + r.w - 12, r.y + 14);
    }
    ctx.restore();
    return pressed;
  }

  /** Horizontal progress bar. `value` is 0..1. */
  bar(
    r: Rect,
    value: number,
    color: string,
    opts: { bg?: string; radius?: number; glow?: boolean } = {},
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = this.transition;
    roundRectPath(ctx, r.x, r.y, r.w, r.h, opts.radius ?? r.h / 2);
    ctx.fillStyle = opts.bg ?? 'rgba(232, 240, 255, 0.09)';
    ctx.fill();
    const w = Math.max(0, Math.min(1, value)) * r.w;
    if (w > 0.5) {
      ctx.save();
      roundRectPath(ctx, r.x, r.y, r.w, r.h, opts.radius ?? r.h / 2);
      ctx.clip();
      if (opts.glow) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
      }
      roundRectPath(ctx, r.x, r.y, w, r.h, opts.radius ?? r.h / 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  /** A row of pips, used for integrity. */
  pips(x: number, y: number, count: number, filled: number, size: number, color: string): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = this.transition;
    const gap = size * 0.9;
    for (let i = 0; i < count; i++) {
      const cx = x + i * (size + gap);
      ctx.beginPath();
      ctx.arc(cx, y, size / 2, 0, TAU);
      if (i < filled) {
        ctx.fillStyle = color;
        ctx.fill();
      } else {
        ctx.strokeStyle = withAlpha(color, 0.32);
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

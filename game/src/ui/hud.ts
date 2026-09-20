/**
 * In-game HUD.
 *
 * Kept to the top strip and deliberately sparse. The bottom two-thirds of the
 * screen is where the thumb lives, and anything drawn there is either hidden by
 * a hand or accidentally pressed. Health is shown twice - as pips here and as
 * fractures on the core itself - because the one piece of information a player
 * must never have to hunt for is how close they are to dying.
 */
import { clamp01, ease } from '../engine/math';
import { COMBO, PALETTE } from '../game/config';
import type { Run } from '../game/run';
import type { Viewport } from '../engine/viewport';
import { FONT, rect, roundRectPath, withAlpha, type Rect, type Ui } from './theme';

export interface HudResult {
  pausePressed: boolean;
}

export class Hud {
  /** Score is eased toward its real value so it rolls up instead of jumping. */
  private shownScore = 0;
  private comboPop = 0;
  private lastCombo = 0;
  private hurtFlash = 0;

  reset(): void {
    this.shownScore = 0;
    this.comboPop = 0;
    this.lastCombo = 0;
    this.hurtFlash = 0;
  }

  flashHurt(): void {
    this.hurtFlash = 1;
  }

  update(dt: number, run: Run): void {
    const target = Math.floor(run.score);
    // Roll fast when far behind so the number never lags visibly. The result
    // is floored on every step: the eased value is fractional, and rendering
    // it straight through toLocaleString() shows the player "2,625.482".
    const step = Math.max(1, (target - this.shownScore) * Math.min(1, dt * 9));
    this.shownScore =
      target - this.shownScore > 0.5 ? Math.min(target, Math.floor(this.shownScore + step)) : target;

    if (run.combo > this.lastCombo) this.comboPop = 1;
    this.lastCombo = run.combo;
    this.comboPop = Math.max(0, this.comboPop - dt * 3.6);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2.2);
  }

  /** Full-screen red vignette on damage. */
  drawDamageVignette(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (this.hurtFlash <= 0) return;
    const k = ease.outQuad(this.hurtFlash);
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.7);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, withAlpha(PALETTE.danger, 0.42 * k));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  draw(ui: Ui, vp: Viewport, run: Run, time: number, leftHanded = false): HudResult {
    const ctx = ui.ctx;
    // Left-handed players hold the phone in the other hand, so the pause
    // button and wave counter move to the side their thumb can actually reach.
    const left = leftHanded ? vp.safeRight - 18 : vp.safeLeft + 18;
    const right = leftHanded ? vp.safeLeft + 18 : vp.safeRight - 18;
    const top = vp.safeTop + 14;

    // --- Score -------------------------------------------------------------
    const scoreAlign: CanvasTextAlign = leftHanded ? 'right' : 'left';
    const waveAlign: CanvasTextAlign = leftHanded ? 'left' : 'right';
    const dir = leftHanded ? -1 : 1;

    ui.label('SCORE', left, top + 8, {
      size: 10,
      color: PALETTE.inkFaint,
      align: scoreAlign,
      tracking: 2.5,
    });
    ctx.save();
    ctx.fillStyle = PALETTE.ink;
    ctx.font = `700 30px ${FONT}`;
    ctx.textAlign = scoreAlign;
    ctx.textBaseline = 'middle';
    ctx.fillText(this.shownScore.toLocaleString(), left, top + 32);
    ctx.restore();

    // --- Pause button ------------------------------------------------------
    const pauseR: Rect = rect(leftHanded ? right : right - 38, top, 38, 38);
    const pausePressed = ui.hit(pauseR);
    ctx.save();
    roundRectPath(ctx, pauseR.x, pauseR.y, pauseR.w, pauseR.h, 11);
    ctx.fillStyle = 'rgba(232, 240, 255, 0.06)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(232, 240, 255, 0.18)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = PALETTE.ink;
    ctx.fillRect(pauseR.x + 13, pauseR.y + 12, 4, 14);
    ctx.fillRect(pauseR.x + 21, pauseR.y + 12, 4, 14);
    ctx.restore();

    // --- Wave --------------------------------------------------------------
    ui.label('WAVE', right - dir * 50, top + 8, {
      size: 10,
      color: PALETTE.inkFaint,
      align: waveAlign,
      tracking: 2.5,
    });
    ctx.save();
    ctx.fillStyle = PALETTE.accent;
    ctx.font = `700 22px ${FONT}`;
    ctx.textAlign = waveAlign;
    ctx.textBaseline = 'middle';
    ctx.fillText(String(Math.max(1, run.wave)), right - dir * 50, top + 30);
    ctx.restore();

    // --- Integrity pips ----------------------------------------------------
    const pipY = top + 58;
    const pipW = run.maxHp * 11 + (run.maxHp - 1) * 9.9;
    ui.pips(leftHanded ? left - pipW : left + 4, pipY, run.maxHp, run.hp, 11, run.hp <= 1 ? PALETTE.danger : PALETTE.accent);

    // --- Combo chip --------------------------------------------------------
    if (run.combo > 0) {
      const pop = 1 + ease.pop(this.comboPop) * 0.22;
      const fade = clamp01(run.comboT / COMBO.window);
      const label = `${run.combo}  x${run.multiplier.toFixed(1)}`;
      ctx.save();
      ctx.font = `700 15px ${FONT}`;
      const w = ctx.measureText(label).width + 26;
      const chip: Rect = rect(leftHanded ? right : right - w, pipY - 15, w, 30);
      ctx.translate(chip.x + chip.w / 2, chip.y + chip.h / 2);
      ctx.scale(pop, pop);
      ctx.translate(-(chip.x + chip.w / 2), -(chip.y + chip.h / 2));

      const hot = run.combo >= 25;
      roundRectPath(ctx, chip.x, chip.y, chip.w, chip.h, 15);
      ctx.fillStyle = withAlpha(hot ? PALETTE.gold : PALETTE.accent, 0.14);
      ctx.fill();
      ctx.strokeStyle = withAlpha(hot ? PALETTE.gold : PALETTE.accent, 0.5);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = hot ? PALETTE.gold : PALETTE.accent;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, chip.x + chip.w / 2, chip.y + chip.h / 2 + 0.5);
      ctx.restore();

      // Chain timer drains under the chip: a visible clock on your own streak.
      ui.bar(rect(chip.x + 8, chip.y + chip.h + 4, chip.w - 16, 3), fade, hot ? PALETTE.gold : PALETTE.accent);
    }

    // --- Overdrive prompt --------------------------------------------------
    if (run.overdriveReady) {
      const pulse = 0.65 + Math.sin(time * 8) * 0.35;
      ui.label('OVERDRIVE - NEXT PARRY', vp.safeLeft + vp.safeWidth / 2, vp.safeBottom - 30, {
        size: 12,
        color: PALETTE.energy,
        tracking: 3,
        alpha: pulse,
      });
    }

    return { pausePressed };
  }
}

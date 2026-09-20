/**
 * Turns simulation events into feel.
 *
 * The simulation says "a parry happened at this angle"; this file decides that
 * means 14 sparks, a ring, 40ms of hit-stop, a pitch-shifted chime and a medium
 * haptic tap. Keeping the two apart means balance changes never break the
 * effects and effects never accidentally change balance.
 *
 * The techniques here are the standard game-feel toolkit - hit-stop, screen
 * shake, particles, squash, pitch tracking - because they are the cheapest
 * available upgrade to how a game feels. None of them changes a single rule.
 */
import type { AudioEngine } from '../engine/audio';
import type { Camera } from '../engine/camera';
import type { Fx } from '../engine/fx';
import { PALETTE, PROJ_COLORS } from '../game/config';
import type { RunEvent } from '../game/run';
import { haptics } from '../platform/native';
import { toScreen, type ArenaLayout } from './arena';

export interface JuiceHooks {
  /** Called when a projectile kind is met for the first time. */
  onFirstSight?: (kind: string) => void;
  onWaveStart?: (wave: number) => void;
  onGameOver?: (score: number) => void;
  onUpgradeOffer?: () => void;
}

export class Juice {
  constructor(
    private fx: Fx,
    private camera: Camera,
    private audio: AudioEngine,
  ) {}

  /** Drains one frame of events. */
  apply(events: readonly RunEvent[], layout: ArenaLayout, hooks: JuiceHooks = {}): void {
    for (const e of events) {
      switch (e.t) {
        case 'parry':
          this.parry(e, layout);
          break;

        case 'block': {
          const p = toScreen(layout, e.r, e.a);
          const color = PROJ_COLORS[e.kind];
          // A block is deliberately duller than a parry: less shake, less
          // light, a flatter sound. The player should be able to hear the
          // difference without looking.
          this.fx.spark(p.x, p.y, e.a + Math.PI, {
            count: 6,
            speed: 150,
            spread: 0.9,
            color,
            size: 2.4,
            life: 0.3,
          });
          this.camera.shake(0.06);
          this.audio.play('block');
          haptics.impact('light');
          break;
        }

        case 'absorb': {
          const p = toScreen(layout, e.r, e.a);
          this.fx.ring(p.x, p.y, 4, 46, 0.45, PALETTE.energy);
          this.fx.glow(layout.cx, layout.cy, 40, 0.35, 'rgba(124, 255, 178, 0.5)');
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            this.fx.dust(
              p.x,
              p.y,
              Math.cos(a) * 60,
              Math.sin(a) * 60,
              0.5,
              3,
              PALETTE.energy,
            );
          }
          this.audio.play('absorb');
          haptics.impact('light');
          break;
        }

        case 'stun': {
          const p = toScreen(layout, e.r, e.a);
          this.fx.shards(p.x, p.y, 10, PROJ_COLORS.void, 170);
          this.fx.ring(p.x, p.y, 6, 60, 0.4, PROJ_COLORS.void);
          this.fx.text(p.x, p.y - 22, 'SHIELD DOWN', PROJ_COLORS.void, 15);
          this.camera.shake(0.34);
          this.camera.stop(0.05);
          this.audio.play('stun');
          haptics.notify('warning');
          break;
        }

        case 'shockwave': {
          const p = toScreen(layout, e.r, e.a);
          this.fx.ring(p.x, p.y, 4, 52, 0.32, PALETTE.accent);
          this.fx.spark(p.x, p.y, e.a, {
            count: 8,
            speed: 210,
            spread: 1.4,
            color: PALETTE.accent,
            size: 2.6,
            life: 0.3,
          });
          this.audio.play('block', 1.35);
          break;
        }

        case 'recoil':
          this.camera.shake(0.2);
          this.camera.stop(0.035);
          haptics.impact('medium');
          break;

        case 'hurt': {
          const p = toScreen(layout, e.r, e.a);
          this.fx.shards(p.x, p.y, 16, PALETTE.danger, 260);
          this.fx.ring(layout.cx, layout.cy, 10, layout.radius * 0.55, 0.5, PALETTE.danger);
          this.fx.glow(layout.cx, layout.cy, 90, 0.4, 'rgba(255, 77, 109, 0.55)');
          this.camera.shake(0.85);
          this.camera.stop(0.09);
          this.camera.punch(0.9);
          this.audio.play('hurt');
          haptics.notify('error');
          break;
        }

        case 'heal':
          this.fx.ring(layout.cx, layout.cy, 20, 110, 0.55, PALETTE.energy);
          this.fx.text(layout.cx, layout.cy - 46, '+1 INTEGRITY', PALETTE.energy, 16);
          this.audio.play('heal');
          haptics.notify('success');
          break;

        case 'secondWind':
          this.fx.ring(layout.cx, layout.cy, 10, layout.radius, 0.8, PALETTE.gold);
          this.fx.text(layout.cx, layout.cy - 60, 'SECOND WIND', PALETTE.gold, 22);
          this.camera.shake(0.7);
          this.camera.stop(0.14);
          this.audio.play('unlock');
          haptics.notify('success');
          break;

        case 'turretHit': {
          const p = toScreen(layout, e.r, e.a);
          this.fx.spark(p.x, p.y, e.a + Math.PI, {
            count: 10,
            speed: 220,
            color: '#ffffff',
            size: 3,
          });
          this.camera.shake(0.12);
          this.audio.play('block', 0.8);
          break;
        }

        case 'turretDead': {
          const p = toScreen(layout, e.r, e.a);
          this.fx.shards(p.x, p.y, 22, PALETTE.danger, 320);
          this.fx.ring(p.x, p.y, 8, 120, 0.6, PALETTE.danger);
          this.fx.glow(p.x, p.y, 70, 0.4, 'rgba(255, 77, 109, 0.6)');
          this.fx.text(p.x, p.y - 26, 'TURRET DOWN', PALETTE.gold, 16);
          this.camera.shake(0.5);
          this.camera.stop(0.07);
          this.camera.punch(0.6);
          this.audio.play('turret');
          haptics.impact('heavy');
          break;
        }

        case 'turretSpawn':
          this.audio.play('spawn', 0.7);
          break;

        case 'overdriveReady':
          this.fx.text(layout.cx, layout.cy + 44, 'OVERDRIVE READY', PALETTE.energy, 15);
          this.audio.play('ui', 1.4);
          haptics.notify('success');
          break;

        case 'overdrive':
          this.fx.ring(layout.cx, layout.cy, 20, layout.radius * 1.2, 0.6, PALETTE.energy);
          this.fx.glow(layout.cx, layout.cy, layout.radius * 0.7, 0.45, 'rgba(124,255,178,0.4)');
          this.camera.shake(0.9);
          this.camera.stop(0.11);
          this.camera.punch(1);
          this.audio.play('overdrive');
          haptics.impact('heavy');
          break;

        case 'spawn':
          this.audio.play('spawn', e.kind === 'swift' ? 1.5 : 1);
          break;

        case 'waveStart':
          this.audio.play('wave');
          this.audio.setIntensity(Math.min(1, (e.wave - 1) / 18));
          hooks.onWaveStart?.(e.wave);
          break;

        case 'comboBreak':
          if (e.combo >= 10) {
            this.fx.text(layout.cx, layout.cy + layout.radius * 0.3, 'CHAIN LOST', PALETTE.inkDim, 14);
            this.audio.play('uiBack');
          }
          break;

        case 'upgradeOffer':
          hooks.onUpgradeOffer?.();
          break;

        case 'gameOver':
          this.camera.shake(1);
          this.camera.stop(0.2);
          this.audio.play('gameover');
          haptics.gameOver();
          hooks.onGameOver?.(e.score);
          break;

        case 'firstSight':
          hooks.onFirstSight?.(e.kind);
          break;

        case 'waveEnd':
        case 'upgradeTaken':
          break;
      }
    }
  }

  private parry(
    e: Extract<RunEvent, { t: 'parry' }>,
    layout: ArenaLayout,
  ): void {
    const p = toScreen(layout, e.r, e.a);
    const color = PROJ_COLORS[e.kind];
    const heavy = e.kind === 'heavy' || e.kind === 'armored' || e.kind === 'splitter';

    // Chain depth drives every channel at once: more sparks, more shake,
    // higher pitch. A 40-chain should feel different from a 2-chain without
    // the player ever reading the counter.
    const depth = Math.min(1, e.combo / 30);

    this.fx.spark(p.x, p.y, e.a, {
      count: heavy ? 18 : 12,
      speed: 300 + depth * 220,
      spread: 0.55,
      color,
      size: heavy ? 4 : 3,
      life: 0.4,
    });
    this.fx.spark(p.x, p.y, e.a, {
      count: 5,
      speed: 420,
      spread: 0.25,
      color: '#ffffff',
      size: 2.4,
      life: 0.25,
    });
    this.fx.ring(p.x, p.y, 5, 34 + depth * 26, 0.3, '#ffffff');
    this.fx.glow(p.x, p.y, 26 + depth * 18, 0.22, withAlphaRaw(color, 0.55));

    // Hit-stop is the single most effective juice technique available, and the
    // most easily overdone: past about 120ms it stops reading as impact and
    // starts reading as a dropped frame.
    this.camera.stop(heavy ? 0.075 : 0.04 + depth * 0.02);
    this.camera.shake(heavy ? 0.4 : 0.18 + depth * 0.14);
    this.camera.punch(0.25 + depth * 0.25);

    // Pitch climbs with the chain, so a long run audibly ascends.
    this.audio.play(heavy ? 'perfect' : 'parry', 1 + depth * 0.7);
    haptics.impact(heavy ? 'heavy' : 'medium');

    if (e.combo > 0 && e.combo % 5 === 0) {
      this.fx.text(
        p.x,
        p.y - 26,
        `${e.combo} CHAIN`,
        e.combo >= 25 ? PALETTE.gold : PALETTE.accent,
        e.combo >= 25 ? 22 : 18,
      );
    }
  }
}

/** Local copy so juice does not depend on the UI theme module. */
function withAlphaRaw(hex: string, alpha: number): string {
  if (!hex.startsWith('#') || hex.length !== 7) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

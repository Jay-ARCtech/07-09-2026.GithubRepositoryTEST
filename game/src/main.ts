/**
 * PARRY CORE - application shell.
 *
 * Owns the frame loop, the screen state machine and the wiring between the
 * simulation, the renderer and the platform. Everything that touches the DOM
 * or a device API is reachable from here and nowhere else, which is what lets
 * the game logic be tested headlessly.
 */
import { AudioEngine } from './engine/audio';
import { Camera } from './engine/camera';
import { Fx } from './engine/fx';
import { GameLoop, SIM_DT } from './engine/loop';
import { Input } from './engine/input';
import { Rng } from './engine/rng';
import { Storage } from './engine/storage';
import { Viewport } from './engine/viewport';
import { clamp01 } from './engine/math';
import { PALETTE, type ProjKind } from './game/config';
import { CORES } from './game/cores';
import { dailyFor } from './game/daily';
import { Profile, type ActiveMission } from './game/meta';
import { Run, type RunSummary } from './game/run';
import type { UpgradeDef } from './game/upgrades';
import { ArenaRenderer, type ArenaLayout } from './ui/arena';
import { Hud } from './ui/hud';
import { Juice } from './ui/juice';
import {
  drawCores,
  drawHowTo,
  drawMenu,
  drawMissions,
  drawPause,
  drawResults,
  drawSettings,
  drawShop,
  drawToast,
  drawUpgradeChoice,
  type MenuHost,
  type ScreenName,
} from './ui/menus';
import { FONT } from './ui/theme';
import { Ui } from './ui/theme';
import { haptics, onAppStateChange, onBackButton, platform, shell } from './platform/native';
import { rewardedAvailable, showRewarded } from './platform/monetization';

/** One-time callouts the first time a projectile kind appears in a run. */
const FIRST_SIGHT: Record<ProjKind, string> = {
  basic: 'CATCH IT ON THE WHITE BAND',
  swift: 'SWIFT - FAST, AND IT CURVES',
  heavy: 'HEAVY - PARRY IT OR GET KNOCKED BACK',
  void: 'VOID ORB - DO NOT BLOCK. LET IT THROUGH',
  splitter: 'SPLITTER - A BLOCK SPLITS IT IN TWO',
  armored: 'ARMOURED - ONLY A CLEAN PARRY BREAKS IT',
};

class App implements MenuHost {
  readonly vp: Viewport;
  readonly ui: Ui;
  readonly input = new Input();
  readonly audio = new AudioEngine();
  readonly fx = new Fx();
  readonly camera = new Camera();
  readonly arena = new ArenaRenderer();
  readonly hud = new Hud();
  readonly juice: Juice;
  readonly profile: Profile;
  private loop: GameLoop;

  screen: ScreenName = 'menu';
  private navStack: ScreenName[] = [];
  time = 0;

  run: Run | null = null;
  private paused = false;
  private waveBannerT = 0;
  private bannerWave = 1;

  missions: ActiveMission[] = [];
  lastSummary: RunSummary | null = null;
  lastShards = 0;
  lastNewBest = false;
  pendingUpgrades: UpgradeDef[] = [];
  rewardOffered = false;
  rewardClaimed = false;

  private toastMessage = '';
  private toastLife = 0;
  private resetArmed = 0;
  private unsubBack: (() => void) | null = null;
  private unsubState: (() => void) | null = null;
  private booted = false;

  constructor(canvas: HTMLCanvasElement) {
    this.vp = new Viewport(canvas);
    this.ui = new Ui(this.vp.ctx);
    this.profile = new Profile(new Storage('parrycore.v1.'));
    this.juice = new Juice(this.fx, this.camera, this.audio);
    this.loop = new GameLoop({
      update: (dt) => this.update(dt),
      render: (_alpha, frameDt) => this.render(frameDt),
    });

    this.applySettings();
    this.refreshMissions();

    if (this.profile.recovered) {
      this.toast('Save file repaired');
    }
    if (!this.profile.data.tutorialDone) {
      this.screen = 'howto';
      this.navStack = ['menu'];
    }
  }

  start(): void {
    this.input.attach(this.vp.canvas);
    this.vp.start(() => {
      /* layout is recomputed every frame; nothing to do here */
    });

    // Audio must be created inside a user gesture on both mobile platforms.
    const unlock = (): void => {
      this.audio.unlock();
      this.audio.setSfx(this.profile.data.settings.sfx);
      this.audio.setMusic(this.profile.data.settings.music);
      this.audio.startMusic();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock, { once: false });
    window.addEventListener('keydown', unlock, { once: false });

    this.unsubBack = onBackButton(() => this.handleBack());
    this.unsubState = onAppStateChange((active) => this.onAppState(active));

    shell.configureStatusBar();
    this.loop.start();
  }

  dispose(): void {
    this.loop.stop();
    this.input.detach();
    this.vp.stop();
    this.audio.dispose();
    this.unsubBack?.();
    this.unsubState?.();
  }

  // --- Lifecycle ------------------------------------------------------------

  private onAppState(active: boolean): void {
    if (active) {
      this.loop.resetClock();
      this.audio.resume();
      if (this.profile.data.settings.music) this.audio.startMusic();
      this.profile.rollDailyIfNeeded();
      this.refreshMissions();
    } else {
      // Auto-pause. Coming back to a run that kept playing while the phone was
      // in a pocket is the fastest way to lose a player's trust.
      if (this.screen === 'game' && this.run && !this.run.isOver) this.paused = true;
      this.input.reset();
      this.audio.stopMusic();
      this.audio.suspend();
      this.profile.save();
    }
  }

  /** @returns true when the back press was consumed. */
  private handleBack(): boolean {
    switch (this.screen) {
      case 'menu':
        return false; // let the OS close the app
      case 'game':
        if (this.run && !this.run.isOver) {
          this.paused = !this.paused;
          return true;
        }
        this.navigate('menu');
        return true;
      case 'upgrade':
        // Declining is allowed, but it costs the pick - so confirm by pressing
        // back twice rather than silently discarding an upgrade.
        this.toast('Choose an upgrade to continue');
        return true;
      case 'results':
        this.navigate('menu');
        return true;
      default:
        this.back();
        return true;
    }
  }

  private applySettings(): void {
    const s = this.profile.data.settings;
    this.audio.setSfx(s.sfx);
    this.audio.setMusic(s.music);
    haptics.enabled = s.haptics;
    this.camera.reducedMotion = s.reducedMotion;
  }

  private refreshMissions(): void {
    this.missions = this.profile.activeMissions((seed) => new Rng(seed));
  }

  // --- MenuHost -------------------------------------------------------------

  navigate(screen: ScreenName): void {
    if (screen === this.screen) return;
    if (screen !== 'menu' && this.screen !== 'pause') this.navStack.push(this.screen);
    if (screen === 'menu') this.navStack = [];
    this.screen = screen;
    this.ui.transition = 0;
    this.input.clearTaps();
    this.audio.play('ui');
    this.resetArmed = 0;
  }

  back(): void {
    const prev = this.navStack.pop() ?? 'menu';
    this.screen = prev;
    this.ui.transition = 0;
    this.input.clearTaps();
    this.audio.play('uiBack');
    this.resetArmed = 0;
    if (prev === 'menu') this.refreshMissions();
  }

  startRun(opts: { daily: boolean }): void {
    this.profile.rollDailyIfNeeded();
    this.refreshMissions();

    if (!this.profile.data.tutorialDone) {
      this.profile.data.tutorialDone = true;
      this.profile.save();
    }

    const daily = opts.daily ? dailyFor() : null;
    const seed = daily ? daily.seed : (Math.random() * 0xffffffff) >>> 0;
    const coreId = daily ? daily.coreId : this.profile.data.selectedCore;

    this.run = new Run({
      seed,
      coreId,
      daily: opts.daily,
      modifiers: this.profile.modifiers(),
      // Callouts are shown once per run; players who have finished the tutorial
      // still get them, because the kinds appear waves apart.
      skipTutorial: false,
    });

    this.screen = 'game';
    this.navStack = [];
    this.paused = false;
    this.pendingUpgrades = [];
    this.rewardOffered = false;
    this.rewardClaimed = false;
    this.waveBannerT = 0;
    this.hud.reset();
    this.fx.clear();
    this.camera.reset();
    this.ui.transition = 0;
    this.input.clearTaps();
    this.input.aimAngle = null;
    this.audio.setIntensity(0);
    if (this.profile.data.settings.music) this.audio.startMusic();
  }

  resumeRun(): void {
    this.paused = false;
    this.screen = 'game';
    this.loop.resetClock();
    this.input.clearTaps();
  }

  abandonRun(): void {
    if (this.run && !this.run.isOver) this.run.forfeit();
    this.paused = false;
    this.screen = 'game';
  }

  chooseUpgrade(id: string): void {
    this.run?.chooseUpgrade(id);
    this.pendingUpgrades = [];
    this.screen = 'game';
    this.ui.transition = 0;
    this.input.clearTaps();
    this.audio.play('unlock');
    haptics.notify('success');
  }

  claimMission(id: string): void {
    const m = this.missions.find((x) => x.def.id === id);
    if (!m || m.claimed || !m.complete) return;
    if (this.profile.claimMission(id, m.def.reward)) {
      this.refreshMissions();
      this.toast(`+${m.def.reward} shards`);
      this.audio.play('unlock');
      haptics.notify('success');
    }
  }

  buyCore(id: string): void {
    if (this.profile.ownsCore(id)) return;
    const def = CORES.find((c) => c.id === id);
    if (!def) return;
    if (this.profile.buyCore(id, def.cost)) {
      this.toast('Core unlocked');
      this.audio.play('unlock');
      haptics.notify('success');
    }
  }

  selectCore(id: string): void {
    if (!this.profile.ownsCore(id)) return;
    this.profile.data.selectedCore = id;
    this.profile.save();
    this.audio.play('ui');
    haptics.impact('light');
  }

  buyUpgrade(id: string): void {
    if (this.profile.buyUpgrade(id)) {
      this.audio.play('unlock');
      haptics.notify('success');
    }
  }

  setSetting(key: string, value: boolean): void {
    this.profile.updateSettings({ [key]: value });
    this.applySettings();
    if (key === 'music') {
      if (value) this.audio.startMusic();
      else this.audio.stopMusic();
    }
    this.audio.play('ui');
    haptics.impact('light');
  }

  confirmReset(): void {
    // Two taps within four seconds. Destructive and irreversible, so it must
    // not be a single mis-tap away.
    if (this.resetArmed > 0) {
      this.profile.resetAll();
      this.applySettings();
      this.refreshMissions();
      this.resetArmed = 0;
      this.toast('Progress erased');
      haptics.notify('warning');
      return;
    }
    this.resetArmed = 4;
    this.toast('Tap again to erase everything');
  }

  watchRewarded(): void {
    if (!this.rewardOffered || this.rewardClaimed || !this.lastSummary) return;
    void showRewarded().then((earned) => {
      if (!earned) {
        this.toast('No reward - ad not completed');
        return;
      }
      const extra = this.lastShards;
      this.profile.addShards(extra);
      this.profile.save();
      this.lastShards += extra;
      this.rewardClaimed = true;
      this.toast(`+${extra.toLocaleString()} shards`);
      this.audio.play('unlock');
    });
  }

  toast(message: string): void {
    this.toastMessage = message;
    this.toastLife = 2.2;
  }

  // --- Update ---------------------------------------------------------------

  private update(dt: number): void {
    this.time += dt;
    this.toastLife = Math.max(0, this.toastLife - dt);
    this.resetArmed = Math.max(0, this.resetArmed - dt);
    this.ui.transition = Math.min(1, this.ui.transition + dt * 5);
    this.waveBannerT = Math.max(0, this.waveBannerT - dt);

    const layout = this.layout();
    this.camera.update(dt, this.profile.data.settings.reducedMotion ? 10 : 18);
    this.fx.update(dt);
    this.arena.update(dt, this.screen === 'game' ? this.run : null);

    const run = this.run;
    if (!run) return;

    if (run.waitingForUpgrade && this.screen === 'game') {
      this.pendingUpgrades = run.pendingChoices;
      this.screen = 'upgrade';
      this.ui.transition = 0;
      this.input.clearTaps();
    }

    if (this.screen !== 'game' || this.paused || run.isOver) {
      if (run.isOver && this.screen === 'game') this.finishRun();
      return;
    }

    this.input.setEnabled(true);
    if (this.input.aimAngle !== null) run.setAim(this.input.aimAngle);

    // Hit-stop freezes the simulation but not the effects, so particles from
    // the impact keep expanding during the freeze. That is what sells it.
    if (this.camera.consumeHitStop(dt)) {
      run.update(dt);
    }
    this.hud.update(dt, run);
    this.juice.apply(run.drainEvents(), layout, {
      onWaveStart: (wave) => {
        this.waveBannerT = 1.6;
        this.bannerWave = wave;
      },
      onFirstSight: (kind) => {
        const msg = FIRST_SIGHT[kind as ProjKind];
        if (msg) {
          this.toastMessage = msg;
          this.toastLife = kind === 'void' ? 4 : 3;
          if (kind === 'void') this.camera.punch(0.5);
        }
      },
      onGameOver: () => {
        this.hud.flashHurt();
      },
    });
    if (run.invulnT > 0 && run.invulnT > 1.05) this.hud.flashHurt();
  }

  private finishRun(): void {
    const run = this.run;
    if (!run) return;
    const summary = run.summary();
    const result = this.profile.recordRun(summary, this.missions);
    this.lastSummary = summary;
    this.lastShards = result.shards;
    this.lastNewBest = result.newBest;
    this.rewardOffered = rewardedAvailable(this.profile.data.supporter);
    this.rewardClaimed = false;
    this.refreshMissions();
    this.screen = 'results';
    this.ui.transition = 0;
    this.input.clearTaps();
    this.audio.setIntensity(0);
  }

  // --- Layout ---------------------------------------------------------------

  /**
   * Arena placement. The circle is centred slightly above the middle of the
   * safe area: the lower third of a phone screen is under the player's hand,
   * and anything important drawn there is invisible while they are playing.
   */
  private layout(): ArenaLayout {
    const vp = this.vp;
    const top = vp.safeTop + 86;
    const bottom = vp.safeBottom - 18;
    const availH = Math.max(80, bottom - top);
    const availW = Math.max(80, vp.safeWidth);

    // The arena boundary (r = 1.0) is sized to nearly fill the narrow axis.
    // The spawn ring at r = 1.12 is allowed to sit just off-screen: shots fly
    // in from outside the frame, which is why the boundary telegraph flare
    // exists. Sizing for the spawn ring instead would shrink the whole
    // playfield by 12% for the sake of a fifth of a second of flight time.
    const outer = Math.min(availW * 0.5, availH * 0.5);
    return {
      cx: vp.safeLeft + availW / 2,
      // Biased above centre: the bottom of a phone screen is under the hand.
      cy: top + availH * 0.44,
      radius: outer / 1.06,
    };
  }

  // --- Render ---------------------------------------------------------------

  private render(frameDt: number): void {
    const vp = this.vp;
    const ctx = vp.ctx;
    vp.beginFrame();

    const layout = this.layout();
    const run = this.run;
    const inGame = this.screen === 'game' || this.screen === 'pause' || this.screen === 'upgrade';
    const intensity = run ? clamp01(run.wave / 20) : 0;

    this.ui.begin(this.input.consumeTap(), frameDt);

    ctx.save();
    if (inGame) this.camera.apply(ctx, layout.cx, layout.cy);
    this.arena.drawBackdrop(ctx, layout, vp.width, vp.height, intensity);

    if (inGame && run) {
      const danger = run.maxHp > 0 ? 1 - run.hp / run.maxHp : 0;
      this.arena.drawBoundary(ctx, layout, danger);
      this.arena.drawWaveBanner(ctx, layout, this.bannerWave, this.waveBannerT);
      this.arena.drawTurrets(ctx, layout, run, this.time);
      this.arena.drawCore(ctx, layout, run, this.time);
      this.arena.drawShield(ctx, layout, run, this.time);
      this.arena.drawProjectiles(ctx, layout, run, this.time);
      this.arena.drawBlast(ctx, layout, run);
      this.fx.draw(ctx);
      this.fx.drawTexts(ctx, FONT);
    } else {
      // Menus get the backdrop glow but not the arena ring: a hard circle
      // behind a column of buttons reads as a stray artefact, not as depth.
      this.fx.draw(ctx);
      this.fx.drawTexts(ctx, FONT);
    }
    ctx.restore();

    if (inGame) this.hud.drawDamageVignette(ctx, vp.width, vp.height);

    switch (this.screen) {
      case 'game':
        if (run) {
          const res = this.hud.draw(this.ui, vp, run, this.time, this.profile.data.settings.leftHanded);
          if (res.pausePressed && !run.isOver) {
            this.paused = true;
            this.screen = 'pause';
            this.ui.transition = 0;
            this.audio.play('ui');
          }
          if (this.input.isDown) {
            this.arena.drawStick(
              ctx,
              this.input.originX,
              this.input.originY,
              this.input.x,
              this.input.y,
              this.input.stickMagnitude,
            );
          } else if (run.wave <= 1 && run.time < 6) {
            // First-run affordance: it disappears the moment they touch.
            const pulse = 0.4 + Math.sin(this.time * 3) * 0.3;
            this.ui.label('PRESS AND DRAG ANYWHERE', vp.safeLeft + vp.safeWidth / 2, vp.safeBottom - 44, {
              size: 12,
              tracking: 3,
              color: PALETTE.accent,
              alpha: pulse,
            });
          }
        }
        break;
      case 'pause':
        if (run) this.hud.draw(this.ui, vp, run, this.time, this.profile.data.settings.leftHanded);
        drawPause(this);
        break;
      case 'upgrade':
        drawUpgradeChoice(this);
        break;
      case 'results':
        drawResults(this);
        break;
      case 'menu':
        drawMenu(this);
        break;
      case 'cores':
        drawCores(this);
        break;
      case 'shop':
        drawShop(this);
        break;
      case 'missions':
        drawMissions(this);
        break;
      case 'settings':
        drawSettings(this);
        break;
      case 'howto':
        drawHowTo(this);
        break;
    }

    drawToast(this.ui, vp, this.toastMessage, this.toastLife);

    if (!this.booted) {
      this.booted = true;
      // Hide the boot veil only once a real frame has been painted, so there
      // is never a flash of empty canvas.
      requestAnimationFrame(() => {
        document.getElementById('boot')?.classList.add('hidden');
        shell.hideSplash();
        window.setTimeout(() => document.getElementById('boot')?.remove(), 400);
      });
    }
  }
}

function boot(): void {
  const canvas = document.getElementById('stage');
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('PARRY CORE: canvas #stage not found');
  }
  const app = new App(canvas);
  app.start();

  if (platform.isNative()) shell.requestImmersive();

  window.addEventListener('pagehide', () => app.profile.save());

  // Development only. `import.meta.env.DEV` is a compile-time constant, so this
  // whole block is dead-code-eliminated from the production bundle - nothing is
  // exposed on `window` in a shipped build. It exists so the browser smoke test
  // can drive a competent bot instead of flailing at the screen.
  if (import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).__parry = app;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}

export { App, SIM_DT };

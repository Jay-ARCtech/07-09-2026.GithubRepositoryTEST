/**
 * All non-gameplay screens.
 *
 * Every screen is a pure function of (host, frame time) that draws itself and
 * returns nothing - navigation happens through host callbacks. There is no
 * retained state here beyond a couple of animation clocks, which is why the
 * whole menu system fits in one file and cannot get out of sync with the game.
 */
import { TAU, clamp01, ease } from '../engine/math';
import type { Viewport } from '../engine/viewport';
import { PALETTE, PROJ_COLORS } from '../game/config';
import { CORES } from '../game/cores';
import { META_UPGRADES, type ActiveMission, type Profile } from '../game/meta';
import { dailyFor, formatCountdown, secondsUntilReset } from '../game/daily';
import type { RunSummary } from '../game/run';
import type { UpgradeDef } from '../game/upgrades';
import {
  FONT,
  measureTracked,
  rect,
  roundRectPath,
  wrapText,
  withAlpha,
  type Ui,
} from './theme';

export type ScreenName =
  | 'menu'
  | 'game'
  | 'pause'
  | 'upgrade'
  | 'results'
  | 'cores'
  | 'shop'
  | 'missions'
  | 'settings'
  | 'howto';

export interface MenuHost {
  ui: Ui;
  vp: Viewport;
  profile: Profile;
  time: number;
  missions: ActiveMission[];
  lastSummary: RunSummary | null;
  lastShards: number;
  lastNewBest: boolean;
  pendingUpgrades: UpgradeDef[];
  rewardOffered: boolean;
  rewardClaimed: boolean;

  navigate(screen: ScreenName): void;
  back(): void;
  startRun(opts: { daily: boolean }): void;
  resumeRun(): void;
  abandonRun(): void;
  chooseUpgrade(id: string): void;
  claimMission(id: string): void;
  buyCore(id: string): void;
  selectCore(id: string): void;
  buyUpgrade(id: string): void;
  setSetting(key: string, value: boolean): void;
  confirmReset(): void;
  watchRewarded(): void;
  toast(message: string): void;
}

// --- Shared chrome ----------------------------------------------------------

interface Frame {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
}

function screenFrame(host: MenuHost, title: string, showBack = true): Frame {
  const { ui, vp } = host;
  const left = vp.safeLeft + 20;
  const right = vp.safeRight - 20;
  const top = vp.safeTop + 18;

  if (showBack) {
    const backRect = rect(left, top, 64, 34);
    if (ui.button(backRect, 'BACK', { tone: 'ghost', small: true })) host.back();
  }

  // The shard counter is anchored right and the title is centred, so a long
  // title on a narrow phone would run straight into it. Tracking is the first
  // thing to give, then size.
  const shardW = 90;
  const titleRoom = vp.safeWidth - 2 * Math.max(72, shardW) - 16;
  const ctx = ui.ctx;
  let size = 15;
  let tracking = 5;
  ctx.save();
  ctx.font = `600 ${size}px ${FONT}`;
  while (measureTracked(ctx, title, tracking) > titleRoom && tracking > 1) tracking -= 0.5;
  while (measureTracked(ctx, title, tracking) > titleRoom && size > 11) {
    size -= 0.5;
    ctx.font = `600 ${size}px ${FONT}`;
  }
  ctx.restore();

  ui.label(title, vp.safeLeft + vp.safeWidth / 2, top + 17, {
    size,
    tracking,
    color: PALETTE.ink,
  });

  drawShardCount(host, right, top + 17);

  return { top: top + 52, bottom: vp.safeBottom - 16, left, right, width: right - left };
}

function drawShardCount(host: MenuHost, x: number, y: number): void {
  const { ui } = host;
  const ctx = ui.ctx;
  const text = host.profile.shards.toLocaleString();
  ctx.save();
  ctx.font = `700 14px ${FONT}`;
  const w = ctx.measureText(text).width;
  ctx.restore();
  ui.label(text, x, y, { size: 14, color: PALETTE.gold, align: 'right' });
  drawShardIcon(ctx, x - w - 14, y, 6);
}

function drawShardIcon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = PALETTE.gold;
  ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.restore();
}

/** Evenly distributes `count` rows inside a vertical span. */
/**
 * Lays out `count` evenly-sized rows inside a vertical span and centres them.
 * `max` is generous on purpose: a three-item list in a tall frame looks broken
 * if the items stay small and the space goes to the margins.
 */
function rows(frame: Frame, count: number, gap: number, min: number, max: number): number[] {
  const avail = frame.bottom - frame.top;
  const h = Math.max(min, Math.min(max, (avail - gap * (count - 1)) / Math.max(1, count)));
  const total = h * count + gap * (count - 1);
  const startY = frame.top + Math.max(0, (avail - total) / 2);
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push(startY + i * (h + gap));
  out.push(h); // last entry is the row height
  return out;
}

// --- Title ------------------------------------------------------------------

/** The rotating shield mark drawn behind the title. */
function drawTitleMark(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, time: number): void {
  ctx.save();
  ctx.translate(cx, cy);

  ctx.strokeStyle = withAlpha(PALETTE.accent, 0.16);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.stroke();

  const a = time * 0.55;
  ctx.strokeStyle = PALETTE.accent;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.66, a - 0.42, a + 0.42);
  ctx.stroke();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.66, a - 0.17, a + 0.17);
  ctx.stroke();

  ctx.fillStyle = withAlpha(PALETTE.accent, 0.8);
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const t = (i / 6) * TAU - Math.PI / 2;
    const x = Math.cos(t) * r * 0.26;
    const y = Math.sin(t) * r * 0.26;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawMenu(host: MenuHost): void {
  const { ui, vp, profile } = host;
  const cx = vp.safeLeft + vp.safeWidth / 2;
  const top = vp.safeTop;
  const bottom = vp.safeBottom;
  const availH = bottom - top;

  const markR = Math.min(vp.safeWidth * 0.26, availH * 0.15);
  const markY = top + availH * 0.2;
  drawTitleMark(ui.ctx, cx, markY, markR, host.time);

  ui.label('PARRY CORE', cx, markY + markR + 34, { size: 26, tracking: 7 });
  ui.label('one thumb. no mercy.', cx, markY + markR + 58, {
    size: 11,
    tracking: 3,
    color: PALETTE.inkDim,
  });

  drawShardCount(host, vp.safeRight - 20, top + 24);

  if (profile.data.bestScore > 0) {
    ui.label(
      `BEST  ${profile.data.bestScore.toLocaleString()}   WAVE ${profile.data.bestWave}`,
      cx,
      markY + markR + 82,
      { size: 12, color: PALETTE.inkDim, tracking: 1.5 },
    );
  }

  const btnW = Math.min(vp.safeWidth - 48, 300);
  const bx = cx - btnW / 2;
  let by = markY + markR + 108;
  const gap = 12;
  const h = Math.min(54, Math.max(44, (bottom - by - 70) / 5 - gap));

  if (ui.button(rect(bx, by, btnW, h), 'PLAY', { tone: 'primary' }) || ui.keyboardConfirm()) {
    host.startRun({ daily: false });
  }
  by += h + gap;

  const daily = dailyFor();
  const done = profile.data.daily.completed && profile.data.daily.date === daily.date;
  if (
    ui.button(rect(bx, by, btnW, h), done ? 'DAILY - REPLAY' : 'DAILY CHALLENGE', {
      tone: 'gold',
      badge: done ? profile.data.daily.score.toLocaleString() : undefined,
    })
  ) {
    host.startRun({ daily: true });
  }
  by += h + gap;

  const halfW = (btnW - gap) / 2;
  if (ui.button(rect(bx, by, halfW, h), 'CORES', { tone: 'ghost' })) host.navigate('cores');
  if (ui.button(rect(bx + halfW + gap, by, halfW, h), 'UPGRADES', { tone: 'ghost' }))
    host.navigate('shop');
  by += h + gap;

  const claimable = host.missions.filter((m) => m.complete && !m.claimed).length;
  if (
    ui.button(rect(bx, by, halfW, h), 'MISSIONS', {
      tone: 'ghost',
      badge: claimable > 0 ? `${claimable}` : undefined,
    })
  )
    host.navigate('missions');
  if (ui.button(rect(bx + halfW + gap, by, halfW, h), 'SETTINGS', { tone: 'ghost' }))
    host.navigate('settings');
  by += h + gap;

  if (ui.button(rect(bx, by, btnW, h * 0.8), 'HOW TO PLAY', { tone: 'ghost', small: true }))
    host.navigate('howto');

  ui.label(
    `DAILY RESETS IN ${formatCountdown(secondsUntilReset())}`,
    cx,
    bottom - 16,
    { size: 10, color: PALETTE.inkFaint, tracking: 2 },
  );
}

// --- Cores ------------------------------------------------------------------

export function drawCores(host: MenuHost): void {
  const { ui, profile } = host;
  const f = screenFrame(host, 'CORES');
  const layout = rows(f, CORES.length, 11, 78, 124);
  const h = layout[layout.length - 1]!;

  for (let i = 0; i < CORES.length; i++) {
    const core = CORES[i]!;
    const y = layout[i]!;
    const r = rect(f.left, y, f.width, h);
    const owned = profile.ownsCore(core.id);
    const selected = profile.data.selectedCore === core.id;
    const affordable = profile.shards >= core.cost;

    const pressed = ui.hit(r);
    if (pressed) {
      if (owned) host.selectCore(core.id);
      else if (affordable) host.buyCore(core.id);
      else host.toast(`Need ${(core.cost - profile.shards).toLocaleString()} more shards`);
    }

    ui.panel(r, {
      radius: 14,
      edge: selected ? withAlpha(PALETTE.accent, 0.75) : PALETTE.panelEdge,
      alpha: owned ? 1 : 0.82,
    });

    const ctx = ui.ctx;
    drawCoreGlyph(ctx, f.left + 40, y + h / 2, 26, core.halfArc, core.sweetFraction, owned);

    ui.label(core.name, f.left + 78, y + 26, {
      size: 15,
      align: 'left',
      tracking: 2.5,
      color: owned ? PALETTE.ink : PALETTE.inkDim,
    });
    ui.label(core.tagline, f.left + 78, y + 46, {
      size: 11,
      align: 'left',
      color: PALETTE.inkFaint,
    });

    // Stat strip: the trade-off, stated numerically.
    const stats = `HP ${core.maxHp}   ARC ${Math.round(core.halfArc * 2 * (180 / Math.PI))}°   SWEET ${Math.round(core.sweetFraction * 100)}%   TURN ${core.turnRate.toFixed(1)}`;
    ui.label(stats, f.left + 20, y + h - 20, {
      size: 10,
      align: 'left',
      color: PALETTE.inkFaint,
      tracking: 0.5,
    });

    if (selected) {
      ui.label('EQUIPPED', f.right - 16, y + 26, {
        size: 11,
        align: 'right',
        color: PALETTE.accent,
        tracking: 2,
      });
    } else if (owned) {
      ui.label('TAP TO EQUIP', f.right - 16, y + 26, {
        size: 10,
        align: 'right',
        color: PALETTE.inkFaint,
        tracking: 1.5,
      });
    } else {
      // Price only - no "TAP TO UNLOCK" caption. The caption sat on the same
      // line as the tagline and collided with the longer ones; the colour of
      // the price already says whether it is affordable.
      const priceText = core.cost.toLocaleString();
      ctx.save();
      ctx.font = `600 14px ${FONT}`;
      const priceW = ctx.measureText(priceText).width;
      ctx.restore();
      ui.label(priceText, f.right - 16, y + 26, {
        size: 14,
        align: 'right',
        color: affordable ? PALETTE.gold : PALETTE.inkFaint,
      });
      drawShardIcon(ctx, f.right - 24 - priceW, y + 26, 5);
      if (!affordable) drawLock(ctx, f.right - 22, y + 50, 9);
    }
  }
}

function drawLock(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = PALETTE.inkFaint;
  ctx.fillStyle = PALETTE.inkFaint;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, -size * 0.35, size * 0.38, Math.PI, TAU);
  ctx.stroke();
  ctx.fillRect(-size * 0.5, -size * 0.35, size, size * 0.72);
  ctx.restore();
}

/** Miniature of a core's shield geometry - the trade-off you can see. */
function drawCoreGlyph(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  halfArc: number,
  sweet: number,
  owned: boolean,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalAlpha = owned ? 1 : 0.45;

  // Faint full orbit for scale, so the shield arc reads as a fraction of a
  // circle rather than as a floating dash.
  ctx.strokeStyle = withAlpha(PALETTE.accent, 0.14);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.78, 0, TAU);
  ctx.stroke();

  ctx.fillStyle = withAlpha(PALETTE.accent, 0.35);
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU - Math.PI / 2;
    const x = Math.cos(a) * r * 0.3;
    const y = Math.sin(a) * r * 0.3;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();

  // The shield is drawn pointing up, which is how it sits in the HUD at rest.
  ctx.rotate(-Math.PI / 2);
  ctx.strokeStyle = withAlpha(PALETTE.accent, 0.8);
  ctx.lineWidth = 5;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.78, -halfArc, halfArc);
  ctx.stroke();

  ctx.strokeStyle = PALETTE.sweet;
  ctx.lineWidth = 5.5;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.78, -halfArc * sweet, halfArc * sweet);
  ctx.stroke();
  ctx.restore();
}

// --- Permanent upgrades -----------------------------------------------------

export function drawShop(host: MenuHost): void {
  const { ui, profile } = host;
  const f = screenFrame(host, 'UPGRADES');

  ui.label(
    'Small, permanent, and earned by playing.',
    (f.left + f.right) / 2,
    f.top + 4,
    { size: 10, color: PALETTE.inkFaint, tracking: 1 },
  );
  const body: Frame = { ...f, top: f.top + 22 };

  const layout = rows(body, META_UPGRADES.length, 10, 72, 108);
  const h = layout[layout.length - 1]!;

  for (let i = 0; i < META_UPGRADES.length; i++) {
    const def = META_UPGRADES[i]!;
    const y = layout[i]!;
    const r = rect(body.left, y, body.width, h);
    const level = profile.upgradeLevel(def.id);
    const cost = profile.upgradeCost(def.id);
    const maxed = cost === null;
    const affordable = cost !== null && profile.shards >= cost;

    if (ui.hit(r)) {
      if (maxed) host.toast('Already at maximum');
      else if (affordable) host.buyUpgrade(def.id);
      else host.toast(`Need ${(cost - profile.shards).toLocaleString()} more shards`);
    }

    ui.panel(r, { radius: 14, alpha: maxed ? 0.75 : 1 });

    ui.label(def.name, body.left + 16, y + 24, {
      size: 13,
      align: 'left',
      tracking: 2,
      color: maxed ? PALETTE.energy : PALETTE.ink,
    });
    ui.label(def.desc, body.left + 16, y + 44, {
      size: 10.5,
      align: 'left',
      color: PALETTE.inkFaint,
    });

    // Level pips on the left of the bottom row, price on the right of it.
    // Putting the price on its own line is what keeps a long description from
    // running into it on a narrow phone.
    const pipY = y + h - 18;
    ui.pips(body.left + 16, pipY, def.maxLevel, level, 8, maxed ? PALETTE.energy : PALETTE.accent);

    if (maxed) {
      ui.label('MAX', body.right - 16, pipY, {
        size: 12,
        align: 'right',
        color: PALETTE.energy,
        tracking: 2,
      });
    } else {
      const priceText = cost.toLocaleString();
      ui.label(priceText, body.right - 16, pipY, {
        size: 14,
        align: 'right',
        color: affordable ? PALETTE.gold : PALETTE.inkFaint,
      });
      const ctx = ui.ctx;
      ctx.save();
      ctx.font = `600 14px ${FONT}`;
      const priceW = ctx.measureText(priceText).width;
      ctx.restore();
      drawShardIcon(ctx, body.right - 24 - priceW, pipY, 5);
    }
  }
}

// --- Missions ---------------------------------------------------------------

export function drawMissions(host: MenuHost): void {
  const { ui } = host;
  const f = screenFrame(host, 'MISSIONS');

  ui.label(
    `RESETS IN ${formatCountdown(secondsUntilReset())}`,
    (f.left + f.right) / 2,
    f.top + 4,
    { size: 10, color: PALETTE.inkFaint, tracking: 2 },
  );

  const body: Frame = { ...f, top: f.top + 26, bottom: f.bottom - 60 };
  const layout = rows(body, host.missions.length, 14, 84, 132);
  const h = layout[layout.length - 1]!;

  for (let i = 0; i < host.missions.length; i++) {
    const m = host.missions[i]!;
    const y = layout[i]!;
    const r = rect(body.left, y, body.width, h);
    const ready = m.complete && !m.claimed;

    if (ready && ui.hit(r)) host.claimMission(m.def.id);

    ui.panel(r, {
      radius: 14,
      edge: ready ? withAlpha(PALETTE.gold, 0.7) : PALETTE.panelEdge,
      alpha: m.claimed ? 0.6 : 1,
    });

    ui.label(m.def.label(m.target), body.left + 16, y + 26, {
      size: 12.5,
      align: 'left',
      color: m.claimed ? PALETTE.inkDim : PALETTE.ink,
    });

    const frac = clamp01(m.progress / Math.max(1, m.target));
    ui.bar(
      rect(body.left + 16, y + h - 40, body.width - 32, 7),
      frac,
      m.claimed ? PALETTE.inkFaint : ready ? PALETTE.gold : PALETTE.accent,
    );
    ui.label(
      `${Math.min(m.progress, m.target).toLocaleString()} / ${m.target.toLocaleString()}`,
      body.left + 16,
      y + h - 18,
      { size: 10.5, align: 'left', color: PALETTE.inkFaint },
    );

    if (m.claimed) {
      ui.label('CLAIMED', body.right - 16, y + h - 18, {
        size: 11,
        align: 'right',
        color: PALETTE.inkFaint,
        tracking: 1.5,
      });
    } else if (ready) {
      const pulse = 0.7 + Math.sin(host.time * 6) * 0.3;
      ui.label(`TAP TO CLAIM  +${m.def.reward}`, body.right - 16, y + h - 18, {
        size: 11,
        align: 'right',
        color: PALETTE.gold,
        tracking: 1.5,
        alpha: pulse,
      });
    } else {
      ui.label(`+${m.def.reward}`, body.right - 16, y + h - 18, {
        size: 11,
        align: 'right',
        color: PALETTE.inkFaint,
      });
    }
  }

  ui.label(
    'Missions count every run, including the daily.',
    (f.left + f.right) / 2,
    f.bottom - 24,
    { size: 10, color: PALETTE.inkFaint },
  );
}

// --- Settings ---------------------------------------------------------------

interface ToggleRow {
  key: string;
  label: string;
  note: string;
  value: boolean;
}

export function drawSettings(host: MenuHost): void {
  const { ui, profile } = host;
  const f = screenFrame(host, 'SETTINGS');
  const s = profile.data.settings;

  const toggles: ToggleRow[] = [
    { key: 'sfx', label: 'SOUND', note: 'Impacts, parries, overdrive', value: s.sfx },
    { key: 'music', label: 'MUSIC', note: 'Adaptive background layer', value: s.music },
    { key: 'haptics', label: 'HAPTICS', note: 'Vibration on impact', value: s.haptics },
    {
      key: 'reducedMotion',
      label: 'REDUCED MOTION',
      note: 'Softer screen shake, no rotation',
      value: s.reducedMotion,
    },
    {
      key: 'leftHanded',
      label: 'LEFT-HANDED HUD',
      note: 'Mirror the on-screen layout',
      value: s.leftHanded,
    },
  ];

  const body: Frame = { ...f, bottom: f.bottom - 120 };
  const layout = rows(body, toggles.length, 9, 56, 80);
  const h = layout[layout.length - 1]!;

  for (let i = 0; i < toggles.length; i++) {
    const t = toggles[i]!;
    const y = layout[i]!;
    const r = rect(body.left, y, body.width, h);
    if (ui.hit(r)) host.setSetting(t.key, !t.value);

    ui.panel(r, { radius: 12, alpha: 0.9 });
    ui.label(t.label, body.left + 16, y + h / 2 - 9, {
      size: 12.5,
      align: 'left',
      tracking: 2,
    });
    ui.label(t.note, body.left + 16, y + h / 2 + 10, {
      size: 10,
      align: 'left',
      color: PALETTE.inkFaint,
    });
    drawSwitch(ui, body.right - 62, y + h / 2, t.value);
  }

  const btnW = Math.min(body.width, 280);
  const bx = (f.left + f.right) / 2 - btnW / 2;
  const cxMid = (f.left + f.right) / 2;

  // Two short lines rather than one long one: the single-line version runs off
  // the edge of a 360dp phone.
  ui.label('Everything is stored on this device.', cxMid, f.bottom - 104, {
    size: 10,
    color: PALETTE.inkFaint,
  });
  ui.label('No account, no network, no tracking.', cxMid, f.bottom - 90, {
    size: 10,
    color: PALETTE.inkFaint,
  });

  if (ui.button(rect(bx, f.bottom - 76, btnW, 40), 'HOW TO PLAY', { tone: 'ghost', small: true }))
    host.navigate('howto');
  if (ui.button(rect(bx, f.bottom - 30, btnW, 34), 'RESET ALL PROGRESS', { tone: 'danger', small: true }))
    host.confirmReset();
}

function drawSwitch(ui: Ui, x: number, y: number, on: boolean): void {
  const ctx = ui.ctx;
  const w = 46;
  const h = 26;
  ctx.save();
  roundRectPath(ctx, x, y - h / 2, w, h, h / 2);
  ctx.fillStyle = on ? withAlpha(PALETTE.accent, 0.28) : 'rgba(232,240,255,0.08)';
  ctx.fill();
  ctx.strokeStyle = on ? withAlpha(PALETTE.accent, 0.7) : 'rgba(232,240,255,0.2)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + (on ? w - h / 2 : h / 2), y, h / 2 - 5, 0, TAU);
  ctx.fillStyle = on ? PALETTE.accent : 'rgba(232,240,255,0.45)';
  ctx.fill();
  ctx.restore();
}

// --- How to play ------------------------------------------------------------

interface HowToRow {
  color: string;
  title: string;
  body: string;
  glyph: 'basic' | 'swift' | 'heavy' | 'splitter' | 'void' | 'armored' | 'shield';
}

const HOW_TO: HowToRow[] = [
  {
    color: PALETTE.accent,
    glyph: 'shield',
    title: 'DRAG ANYWHERE',
    body: 'Press and flick in any direction. The shield follows your thumb, not your finger position.',
  },
  {
    color: PALETTE.sweet,
    glyph: 'shield',
    title: 'THE WHITE BAND',
    body: 'Catching a shot on the bright centre is a PARRY: it chains, scores and reflects. The edges only block.',
  },
  {
    color: PROJ_COLORS.void,
    glyph: 'void',
    title: 'NEVER BLOCK A VOID ORB',
    body: 'Hollow, purple, arrows pointing in. Let it reach the core - it feeds overdrive. Blocking one stuns you.',
  },
  {
    color: PROJ_COLORS.heavy,
    glyph: 'heavy',
    title: 'HEAVY SHOTS RECOIL',
    body: 'Block one off-centre and your shield gets knocked sideways. Parry it clean instead.',
  },
  {
    color: PROJ_COLORS.armored,
    glyph: 'armored',
    title: 'ARMOURED COMES BACK',
    body: 'A plain block bounces it out and it returns. Only a clean parry destroys it.',
  },
  {
    color: PALETTE.gold,
    glyph: 'basic',
    title: 'CHAINS REPAIR YOU',
    body: 'Every 30 unbroken parries repairs one integrity, once per wave. Precision is your health bar.',
  },
];

export function drawHowTo(host: MenuHost): void {
  const { ui } = host;
  const f = screenFrame(host, 'HOW TO PLAY');
  const layout = rows(f, HOW_TO.length, 8, 62, 84);
  const h = layout[layout.length - 1]!;
  const ctx = ui.ctx;

  for (let i = 0; i < HOW_TO.length; i++) {
    const row = HOW_TO[i]!;
    const y = layout[i]!;
    ui.panel(rect(f.left, y, f.width, h), { radius: 12, alpha: 0.85 });
    drawHowToGlyph(ctx, f.left + 30, y + h / 2, 13, row.glyph, row.color, host.time);

    ui.label(row.title, f.left + 58, y + 20, {
      size: 12,
      align: 'left',
      tracking: 2,
      color: row.color,
    });

    ctx.save();
    ctx.font = `500 10.5px ${FONT}`;
    const lines = wrapText(ctx, row.body, f.width - 74);
    ctx.restore();
    for (let l = 0; l < Math.min(lines.length, 3); l++) {
      ui.label(lines[l]!, f.left + 58, y + 38 + l * 14, {
        size: 10.5,
        align: 'left',
        weight: 500,
        color: PALETTE.inkDim,
      });
    }
  }
}

function drawHowToGlyph(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  glyph: HowToRow['glyph'],
  color: string,
  time: number,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.4;

  switch (glyph) {
    case 'shield': {
      const a = Math.sin(time * 1.4) * 0.9;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.72, a - 0.5, a + 0.5);
      ctx.stroke();
      ctx.strokeStyle = '#fff';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.72, a - 0.2, a + 0.2);
      ctx.stroke();
      break;
    }
    case 'void':
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.8, 0, TAU);
      ctx.stroke();
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-r * 0.15, -r * 0.4);
      ctx.lineTo(r * 0.25, 0);
      ctx.lineTo(-r * 0.15, r * 0.4);
      ctx.stroke();
      break;
    case 'heavy':
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.85, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, 0);
      ctx.lineTo(r * 0.5, 0);
      ctx.moveTo(0, -r * 0.5);
      ctx.lineTo(0, r * 0.5);
      ctx.stroke();
      break;
    case 'armored':
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        const x = Math.cos(a) * r * 0.85;
        const y = Math.sin(a) * r * 0.85;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      break;
    case 'splitter':
      ctx.beginPath();
      ctx.arc(0, -r * 0.2, r * 0.6, Math.PI, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, r * 0.2, r * 0.6, 0, Math.PI);
      ctx.fill();
      break;
    default:
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.7, 0, TAU);
      ctx.fill();
      break;
  }
  ctx.restore();
}

// --- Pause ------------------------------------------------------------------

export function drawPause(host: MenuHost): void {
  const { ui, vp } = host;
  const cx = vp.safeLeft + vp.safeWidth / 2;
  const cy = vp.safeTop + vp.safeHeight / 2;

  ui.ctx.save();
  ui.ctx.fillStyle = 'rgba(5, 6, 13, 0.82)';
  ui.ctx.fillRect(0, 0, vp.width, vp.height);
  ui.ctx.restore();

  ui.label('PAUSED', cx, cy - 92, { size: 20, tracking: 6 });

  const w = Math.min(vp.safeWidth - 64, 260);
  const x = cx - w / 2;
  if (ui.button(rect(x, cy - 52, w, 48), 'RESUME', { tone: 'primary' }) || ui.keyboardConfirm())
    host.resumeRun();
  if (ui.button(rect(x, cy + 6, w, 44), 'SETTINGS', { tone: 'ghost' })) host.navigate('settings');
  if (ui.button(rect(x, cy + 58, w, 44), 'END RUN', { tone: 'danger' })) host.abandonRun();

  ui.label('Your progress this run is kept.', cx, cy + 122, {
    size: 10,
    color: PALETTE.inkFaint,
  });
}

// --- In-run upgrade choice --------------------------------------------------

export function drawUpgradeChoice(host: MenuHost): void {
  const { ui, vp } = host;
  const cx = vp.safeLeft + vp.safeWidth / 2;

  ui.ctx.save();
  ui.ctx.fillStyle = 'rgba(5, 6, 13, 0.86)';
  ui.ctx.fillRect(0, 0, vp.width, vp.height);
  ui.ctx.restore();

  const choices = host.pendingUpgrades;
  const w0 = Math.min(vp.safeWidth - 48, 330);
  const availH = vp.safeHeight - 150;
  const cardH = Math.min(112, Math.max(80, (availH - 12 * Math.max(0, choices.length - 1)) / Math.max(1, choices.length)));
  const blockH = 60 + choices.length * cardH + (choices.length - 1) * 12;
  // Centre the whole block: a column of cards pinned to the top of a tall
  // phone leaves a third of the screen empty under the last option.
  const top = vp.safeTop + Math.max(16, (vp.safeHeight - blockH - 40) / 2);

  ui.label('WAVE CLEARED', cx, top, { size: 12, tracking: 4, color: PALETTE.accent });
  ui.label('CHOOSE ONE', cx, top + 26, { size: 22, tracking: 5 });

  const w = w0;
  const x = cx - w / 2;
  const h = cardH;

  for (let i = 0; i < choices.length; i++) {
    const c = choices[i]!;
    const y = top + 60 + i * (h + 12);
    const r = rect(x, y, w, h);
    if (ui.hit(r)) host.chooseUpgrade(c.id);

    const rare = c.rarity === 'rare';
    ui.panel(r, {
      radius: 16,
      edge: rare ? withAlpha(PALETTE.gold, 0.6) : withAlpha(PALETTE.accent, 0.35),
    });

    const ctx = ui.ctx;
    ctx.save();
    ctx.font = `500 11.5px ${FONT}`;
    const lines = wrapText(ctx, c.desc, w - 40);
    ctx.restore();

    // Centre title + description as a single block inside the card.
    const contentH = 22 + lines.length * 16;
    const contentTop = y + (h - contentH) / 2;

    ui.label(c.name, cx, contentTop + 10, {
      size: 15,
      tracking: 3,
      color: rare ? PALETTE.gold : PALETTE.accent,
    });
    for (let l = 0; l < lines.length; l++) {
      ui.label(lines[l]!, cx, contentTop + 34 + l * 16, {
        size: 11.5,
        weight: 500,
        color: PALETTE.inkDim,
      });
    }
    if (rare) {
      ui.label('RARE', r.x + r.w - 16, y + 16, {
        size: 9,
        align: 'right',
        tracking: 2,
        color: PALETTE.gold,
      });
    }
  }

  ui.label('Upgrades last for this run only.', cx, vp.safeBottom - 22, {
    size: 10,
    color: PALETTE.inkFaint,
  });
}

// --- Results ----------------------------------------------------------------

export function drawResults(host: MenuHost): void {
  const { ui, vp, profile } = host;
  const s = host.lastSummary;
  if (!s) return;

  const cx = vp.safeLeft + vp.safeWidth / 2;
  // The card is a fixed height, so centring it in the safe area keeps the
  // layout identical on a short phone and a tall one.
  const cardH = 470 + (host.rewardOffered && !host.rewardClaimed ? 52 : 0);
  const top = Math.max(vp.safeTop + 12, vp.safeTop + (vp.safeHeight - cardH) / 2);

  ui.label(s.daily ? 'DAILY COMPLETE' : 'RUN OVER', cx, top + 10, {
    size: 12,
    tracking: 5,
    color: s.daily ? PALETTE.gold : PALETTE.inkDim,
  });

  if (host.lastNewBest) {
    const pulse = 0.6 + Math.sin(host.time * 7) * 0.4;
    ui.label('NEW BEST', cx, top + 32, {
      size: 13,
      tracking: 4,
      color: PALETTE.gold,
      alpha: pulse,
    });
  }

  ui.ctx.save();
  ui.ctx.fillStyle = PALETTE.ink;
  ui.ctx.font = `700 46px ${FONT}`;
  ui.ctx.textAlign = 'center';
  ui.ctx.textBaseline = 'middle';
  ui.ctx.fillText(s.score.toLocaleString(), cx, top + 74);
  ui.ctx.restore();

  ui.label(`BEST ${profile.data.bestScore.toLocaleString()}`, cx, top + 106, {
    size: 11,
    color: PALETTE.inkFaint,
    tracking: 1.5,
  });

  // Stat grid
  const stats: Array<[string, string]> = [
    ['WAVE', String(s.wave)],
    ['BEST CHAIN', String(s.bestCombo)],
    ['PARRIES', String(s.parries)],
    ['TURRETS', String(s.turretsKilled)],
    ['ABSORBED', String(s.absorbs)],
    ['TIME', `${Math.floor(s.duration)}s`],
  ];
  const gw = Math.min(vp.safeWidth - 48, 330);
  const gx = cx - gw / 2;
  const gy = top + 128;
  const colW = gw / 3;
  for (let i = 0; i < stats.length; i++) {
    const [label, value] = stats[i]!;
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = gx + col * colW + colW / 2;
    const y = gy + row * 46;
    ui.label(value, x, y, { size: 17, color: PALETTE.ink });
    ui.label(label, x, y + 17, { size: 9, color: PALETTE.inkFaint, tracking: 1.5 });
  }

  // Shards
  const shardY = gy + 108;
  ui.panel(rect(gx, shardY - 22, gw, 46), { radius: 12, alpha: 0.9 });
  ui.label('SHARDS EARNED', gx + 16, shardY, {
    size: 10.5,
    align: 'left',
    color: PALETTE.inkFaint,
    tracking: 1.5,
  });
  ui.label(`+${host.lastShards.toLocaleString()}`, gx + gw - 16, shardY, {
    size: 17,
    align: 'right',
    color: PALETTE.gold,
  });

  let by = shardY + 44;
  const bw = gw;

  // The rewarded offer only exists when a provider is attached AND the player
  // is not a supporter. In this build no provider is attached, so it never
  // renders - see docs/MONETIZATION.md.
  if (host.rewardOffered && !host.rewardClaimed) {
    if (ui.button(rect(gx, by, bw, 44), 'DOUBLE SHARDS - WATCH', { tone: 'gold' }))
      host.watchRewarded();
    by += 52;
  }

  const gap = 10;
  const halfW = (bw - gap) / 2;
  if (ui.button(rect(gx, by, halfW, 48), 'RETRY', { tone: 'primary' }) || ui.keyboardConfirm())
    host.startRun({ daily: s.daily });
  if (ui.button(rect(gx + halfW + gap, by, halfW, 48), 'MENU', { tone: 'ghost' }))
    host.navigate('menu');
  by += 56;

  // Mission progress nudge: the single best reason to start another run.
  const nearly = host.missions.find((m) => !m.claimed && m.progress < m.target);
  if (nearly && by < vp.safeBottom - 40) {
    const frac = clamp01(nearly.progress / Math.max(1, nearly.target));
    ui.label(nearly.def.label(nearly.target), cx, by + 8, {
      size: 10.5,
      color: PALETTE.inkDim,
    });
    ui.bar(rect(gx + 40, by + 24, bw - 80, 5), frac, PALETTE.accent);
  }
}

// --- Toast ------------------------------------------------------------------

export function drawToast(ui: Ui, vp: Viewport, message: string, life: number): void {
  if (life <= 0 || !message) return;
  const k = clamp01(life / 2.2);
  const appear = ease.outBack(clamp01((1 - k) * 6));
  const ctx = ui.ctx;
  ctx.save();
  ctx.globalAlpha = Math.min(1, k * 3);
  ctx.font = `600 12px ${FONT}`;
  const w = ctx.measureText(message).width + 32;
  const x = vp.safeLeft + vp.safeWidth / 2 - w / 2;
  const y = vp.safeBottom - 76 - (1 - appear) * 16;
  roundRectPath(ctx, x, y, w, 34, 17);
  ctx.fillStyle = 'rgba(10, 14, 28, 0.95)';
  ctx.fill();
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = PALETTE.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(message, x + w / 2, y + 18);
  ctx.restore();
}

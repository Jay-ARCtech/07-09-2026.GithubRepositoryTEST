// Procedural "Night City" art layer: a holographic-billboard/pylon-ringed
// rooftop arena for gameplay, a building-skyline backdrop for the menu, and
// per-archetype mech/operator silhouettes so units read as armored cyber
// units instead of plain colored dots. Everything here is drawn with Canvas
// 2D paths/gradients -- no external images/fonts, so the CSP and the
// "fully offline, zero assets" constraint both stay intact.
//
// Scenery placement (billboards/pylons) is seeded from world.seed but goes
// through its own RNG instance, never world.rng -- reusing world.rng here
// would consume rolls from the *gameplay* random stream and silently change
// enemy spawns/loot for a given seed, breaking Daily Challenge reproducibility.
import { RNG, TAU, clamp } from "./utils.js";

export function buildArenaScenery(world) {
  const rng = new RNG((world.seed ^ 0x5ea9014) >>> 0);
  const billboards = [];
  const billboardCount = 7;
  for (let i = 0; i < billboardCount; i++) {
    const ang = (TAU / billboardCount) * i + rng.range(-0.25, 0.25);
    const r = rng.range(world.arenaRadius * 0.45, world.arenaRadius * 0.8);
    const barCount = rng.int(3, 6);
    const bars = Array.from({ length: barCount }, () => rng.range(0.25, 1));
    billboards.push({
      x: Math.cos(ang) * r,
      y: Math.sin(ang) * r,
      w: rng.range(46, 78),
      h: rng.range(120, 210),
      rot: rng.range(0, TAU),
      color: rng.pick(["#00f0ff", "#ff2bd6", "#7c3aed", "#fbbf24", "#34d399"]),
      bars,
      flickerSeed: rng.range(0, TAU),
    });
  }

  const pylonCount = 10;
  const pylons = Array.from({ length: pylonCount }, (_, i) => {
    const ang = (TAU / pylonCount) * i;
    return { x: Math.cos(ang) * world.arenaRadius, y: Math.sin(ang) * world.arenaRadius, ang };
  });

  const farLightCount = 10;
  const farLights = Array.from({ length: farLightCount }, () => ({
    ang: rng.range(0, TAU),
    r: world.arenaRadius * rng.range(1.15, 1.6),
    speed: rng.range(0.02, 0.06) * (rng.chance(0.5) ? 1 : -1),
    color: rng.pick(["#00f0ff", "#ff2bd6", "#fbbf24"]),
  }));

  return { billboards, pylons, farLights };
}

function drawHologramBillboard(ctx, b, t) {
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.rot);
  const flicker = 0.72 + 0.28 * Math.sin(t * 2.2 + b.flickerSeed);
  ctx.globalAlpha = 0.5 * flicker;
  ctx.fillStyle = b.color;
  ctx.shadowColor = b.color;
  ctx.shadowBlur = 22;
  ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
  ctx.globalAlpha = 0.9 * flicker;
  ctx.strokeStyle = b.color;
  ctx.lineWidth = 2;
  ctx.strokeRect(-b.w / 2, -b.h / 2, b.w, b.h);
  // animated ad-data bars -- abstract, not literal text, so nothing reads
  // as a specific real-world language/brand while still selling "jumbotron"
  ctx.fillStyle = "rgba(6,3,14,0.85)";
  const rowH = b.h / b.bars.length;
  for (let i = 0; i < b.bars.length; i++) {
    const wFrac = 0.25 + 0.55 * Math.abs(Math.sin(t * 1.4 + i * 1.7 + b.flickerSeed));
    ctx.fillRect(-b.w / 2 + 4, -b.h / 2 + i * rowH + 3, b.w - 8, rowH - 6);
    ctx.fillStyle = b.color;
    ctx.globalAlpha = flicker;
    ctx.fillRect(-b.w / 2 + 6, -b.h / 2 + i * rowH + 5, (b.w - 12) * wFrac, rowH - 10);
    ctx.fillStyle = "rgba(6,3,14,0.85)";
  }
  ctx.restore();
}

function drawPylon(ctx, p, t) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.ang + Math.PI / 2);
  const pulse = 0.6 + 0.4 * Math.sin(t * 3 + p.ang * 4);
  ctx.fillStyle = "rgba(10,6,22,0.9)";
  ctx.fillRect(-6, -22, 12, 44);
  ctx.fillStyle = "#00f0ff";
  ctx.shadowColor = "#00f0ff";
  ctx.shadowBlur = 14 * pulse;
  ctx.globalAlpha = 0.6 + 0.4 * pulse;
  ctx.beginPath();
  ctx.arc(0, -24, 5, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export function drawArenaGround(ctx, world, scenery, t) {
  for (const b of scenery.billboards) drawHologramBillboard(ctx, b, t);
  for (const p of scenery.pylons) drawPylon(ctx, p, t);
  // distant aircar-style light glints drifting just outside the containment
  // ring -- reads as "the rest of the city is out there" without the cost
  // of an actual second skyline layer inside the sim.
  ctx.save();
  for (const f of scenery.farLights) {
    const ang = f.ang + t * f.speed;
    const x = Math.cos(ang) * f.r,
      y = Math.sin(ang) * f.r;
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = f.color;
    ctx.shadowColor = f.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(x, y, 2.4, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- units
// Every shape function draws centered at the origin; the caller is
// responsible for ctx.save()/translate()/rotate()/restore() around it.

function bodyPath(ctx, sides, r, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rot + (TAU / sides) * i;
    const x = Math.cos(a) * r,
      y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawSwarmUnit(ctx, r, color) {
  ctx.fillStyle = color;
  bodyPath(ctx, 4, r, Math.PI / 4);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.16, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawHeavyUnit(ctx, r, color) {
  ctx.fillStyle = color;
  bodyPath(ctx, 6, r);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.beginPath();
  ctx.moveTo(-r * 0.5, -r * 0.5);
  ctx.lineTo(r * 0.5, r * 0.5);
  ctx.moveTo(-r * 0.5, r * 0.5);
  ctx.lineTo(r * 0.5, -r * 0.5);
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.14, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawGunnerUnit(ctx, r, color, facing, barrelLen, barrelW) {
  ctx.save();
  ctx.rotate(facing);
  ctx.fillStyle = "rgba(6,3,14,0.9)";
  ctx.fillRect(0, -barrelW / 2, r * barrelLen, barrelW);
  ctx.restore();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.85, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

function drawSupportUnit(ctx, r, color, glyph) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.85, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.globalAlpha = 0.95;
  if (glyph === "cross") {
    ctx.fillRect(-r * 0.32, -r * 0.09, r * 0.64, r * 0.18);
    ctx.fillRect(-r * 0.09, -r * 0.32, r * 0.18, r * 0.64);
  } else if (glyph === "antenna") {
    for (let i = 0; i < 3; i++) {
      const a = (TAU / 3) * i - Math.PI / 2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.14, 0, TAU);
      ctx.fill();
    }
  } else if (glyph === "gear") {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(1.5, r * 0.14);
    bodyPath(ctx, 6, r * 0.42);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawShipHull(ctx, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(r * 0.95, 0);
  ctx.lineTo(-r * 0.45, r * 0.62);
  ctx.lineTo(-r * 0.15, 0);
  ctx.lineTo(-r * 0.45, -r * 0.62);
  ctx.closePath();
  ctx.fill();
}

// `kind` selects the silhouette family; ENEMY_TYPES/BOSS_TYPES/ALLY_TYPES
// carry a `shape` field naming one of these, so enemies.js/bosses.js/
// allies.js stay the single source of truth for "which archetype looks
// like what" instead of main.js hardcoding a big type-name switch.
export function drawUnitShape(ctx, kind, r, color, opts = {}) {
  const facing = opts.facing ?? 0;
  switch (kind) {
    case "heavy":
      drawHeavyUnit(ctx, r, color);
      break;
    case "gunner":
      drawGunnerUnit(ctx, r, color, facing, 1.3, r * 0.26);
      break;
    case "sniper":
      drawGunnerUnit(ctx, r, color, facing, 2.0, r * 0.18);
      break;
    case "launcher":
      drawGunnerUnit(ctx, r, color, facing, 1.1, r * 0.4);
      ctx.fillStyle = "rgba(6,3,14,0.85)";
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.32, 0, TAU);
      ctx.fill();
      break;
    case "healer":
      drawSupportUnit(ctx, r, color, "cross");
      break;
    case "summoner":
      drawSupportUnit(ctx, r, color, "antenna");
      break;
    case "engineer":
      drawSupportUnit(ctx, r, color, "gear");
      break;
    case "mimic":
    case "operator":
      ctx.save();
      ctx.rotate(facing);
      drawShipHull(ctx, r, color);
      ctx.restore();
      break;
    default:
      drawSwarmUnit(ctx, r, color);
  }
}

export function drawBossShape(ctx, bossShape, r, color, opts = {}) {
  const t = opts.time ?? 0;
  if (bossShape === "fortress") {
    ctx.fillStyle = color;
    bodyPath(ctx, 6, r);
    ctx.fill();
    ctx.fillStyle = "rgba(6,3,14,0.6)";
    bodyPath(ctx, 6, r * 0.62);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const a = (TAU / 4) * i + Math.PI / 4;
      ctx.save();
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(r * 0.95, -r * 0.12);
      ctx.lineTo(r * 1.25, 0);
      ctx.lineTo(r * 0.95, r * 0.12);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();
    }
  } else if (bossShape === "queen") {
    for (let i = 0; i < 6; i++) {
      const a = t * 1.4 + (TAU / 6) * i;
      ctx.save();
      ctx.translate(Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.22, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.55, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.16, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (bossShape === "lancer") {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(r * 1.15, 0);
    ctx.lineTo(0, -r * 0.5);
    ctx.lineTo(-r * 0.9, -r * 0.22);
    ctx.lineTo(-r * 0.9, r * 0.22);
    ctx.lineTo(0, r * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r * 0.9, 0);
    ctx.lineTo(r * 1.05, 0);
    ctx.stroke();
  } else {
    drawShipHull(ctx, r, color);
  }
}

export function drawAllyShape(ctx, allyKind, r, color, facing = 0) {
  if (allyKind === "drone") {
    ctx.save();
    ctx.rotate(facing);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.5, r * 0.16);
    ctx.beginPath();
    ctx.moveTo(-r, -r);
    ctx.lineTo(r, r);
    ctx.moveTo(-r, r);
    ctx.lineTo(r, -r);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = color;
    bodyPath(ctx, 6, r * 0.5);
    ctx.fill();
  } else if (allyKind === "medic") {
    drawSupportUnit(ctx, r, color, "cross");
  } else if (allyKind === "vanguard") {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.85, -r * 0.3);
    ctx.lineTo(r * 0.7, r * 0.7);
    ctx.lineTo(0, r);
    ctx.lineTo(-r * 0.7, r * 0.7);
    ctx.lineTo(-r * 0.85, -r * 0.3);
    ctx.closePath();
    ctx.fill();
  } else {
    drawSwarmUnit(ctx, r, color);
  }
}

// ---------------------------------------------------------------- bullets
// A short glowing tracer stretched along the travel direction instead of a
// plain dot -- cheap (one fill call) and reads as a laser/round in motion.
export function drawBulletTracer(ctx, b) {
  const speed = Math.hypot(b.vx, b.vy);
  const ang = speed > 1 ? Math.atan2(b.vy, b.vx) : 0;
  const len = clamp(speed / 90, b.radius * 1.2, b.radius * 4.5);
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(ang);
  ctx.fillStyle = b.color;
  ctx.shadowColor = b.color;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.ellipse(-len * 0.3, 0, len, b.radius, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- skyline
let skylineCache = null;
function buildSkyline() {
  const rng = new RNG(0xc17c0de);
  const buildings = [];
  for (let i = 0; i < 22; i++) {
    const w = rng.range(0.05, 0.09);
    const h = rng.range(0.22, 0.62);
    const windows = [];
    const cols = rng.int(2, 4);
    const rows = Math.round(h * 26);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (rng.chance(0.4)) windows.push({ r, c, seed: rng.range(0, TAU), color: rng.pick(["#00f0ff", "#ff2bd6", "#fbbf24"]) });
      }
    }
    buildings.push({ w, h, cols, rows, windows, x: 0 });
  }
  let cursor = -0.03;
  for (const b of buildings) {
    b.x = cursor;
    cursor += b.w * rng.range(0.55, 0.85);
  }
  const span = cursor;
  for (const b of buildings) b.x = b.x / span;
  const towerBeamSeed = rng.range(0, TAU);
  return { buildings, towerBeamSeed };
}

export function drawCitySkyline(ctx, w, h, t) {
  if (!skylineCache) skylineCache = buildSkyline();
  const { buildings, towerBeamSeed } = skylineCache;
  const horizon = h * 0.78;

  // ground haze
  const haze = ctx.createLinearGradient(0, horizon - 40, 0, h);
  haze.addColorStop(0, "rgba(124,58,237,0.0)");
  haze.addColorStop(1, "rgba(255,43,214,0.08)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, horizon - 40, w, h - horizon + 40);

  for (const b of buildings) {
    const bw = b.w * w * 1.15;
    const bh = b.h * h * 0.9;
    const bx = b.x * w;
    const by = horizon - bh;
    ctx.fillStyle = "#0a0518";
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = "rgba(0,240,255,0.08)";
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, bw, bh);
    const cellW = bw / b.cols;
    const cellH = bh / b.rows;
    for (const win of b.windows) {
      const lit = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.8 + win.seed));
      if (lit < 0.55) continue;
      ctx.globalAlpha = lit * 0.85;
      ctx.fillStyle = win.color;
      ctx.fillRect(bx + win.c * cellW + cellW * 0.2, by + win.r * cellH + cellH * 0.2, cellW * 0.6, cellH * 0.6);
    }
    ctx.globalAlpha = 1;
  }

  // a single tall "megacorp" tower with a sweeping holographic beam
  const towerX = w * 0.5;
  const towerW = w * 0.045;
  const towerH = h * 0.62;
  ctx.fillStyle = "#0a0518";
  ctx.fillRect(towerX - towerW / 2, horizon - towerH, towerW, towerH);
  ctx.strokeStyle = "rgba(255,43,214,0.25)";
  ctx.strokeRect(towerX - towerW / 2, horizon - towerH, towerW, towerH);
  const beamAlpha = 0.12 + 0.08 * Math.sin(t * 0.6 + towerBeamSeed);
  const beam = ctx.createLinearGradient(towerX, horizon - towerH, towerX, 0);
  beam.addColorStop(0, `rgba(255,43,214,${beamAlpha + 0.15})`);
  beam.addColorStop(1, "rgba(255,43,214,0)");
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(towerX - towerW * 0.35, horizon - towerH);
  ctx.lineTo(towerX + towerW * 0.35, horizon - towerH);
  ctx.lineTo(towerX + towerW * 2.2, 0);
  ctx.lineTo(towerX - towerW * 2.2, 0);
  ctx.closePath();
  ctx.fill();

  // street-level neon reflection line (wet-street read)
  ctx.fillStyle = "rgba(0,240,255,0.06)";
  ctx.fillRect(0, horizon, w, h - horizon);
  ctx.strokeStyle = "rgba(0,240,255,0.35)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  ctx.lineTo(w, horizon);
  ctx.stroke();
}

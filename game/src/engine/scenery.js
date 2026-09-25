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
import { RNG, TAU, clamp, hexToRgba } from "./utils.js";
import { DEFAULT_ARENA_PALETTE } from "../game/celestialBodies.js";

// `palette` recolors the whole arena (billboards/pylons/far lights, plus the
// ring/grid/background main.js's renderWorld() paints) to match whichever
// celestial body the player picked on the Planet Select screen -- defaults
// to today's cyan/magenta look for War Mode/the Daily Challenge, which never
// set world.difficultyId and so never resolve to a real body.
export function buildArenaScenery(world, obstacleMult = 1, palette = DEFAULT_ARENA_PALETTE) {
  const rng = new RNG((world.seed ^ 0x5ea9014) >>> 0);
  const billboards = [];
  // Gauntlet difficulty raises obstacleMult to pack the rooftop with far
  // more billboards/pylons to route around; every other difficulty passes
  // the default 1 and gets today's layout unchanged.
  // Billboards used to spawn at 0.45-0.8x arenaRadius (720-1280 world units
  // on the default 1600-radius arena), which sits entirely outside the
  // camera's actual visible radius (~400-650 at zoom 1) -- so in real play
  // nobody ever saw one, and the "recolored" billboards/pylons doing the
  // heavy lifting for the per-planet look were invisible from spawn. Pulled
  // in to 0.16-0.42x so several sit inside view within the first few steps.
  const billboardCount = Math.round(7 * obstacleMult);
  for (let i = 0; i < billboardCount; i++) {
    const ang = (TAU / billboardCount) * i + rng.range(-0.25, 0.25);
    const r = rng.range(world.arenaRadius * 0.16, world.arenaRadius * 0.42);
    const barCount = rng.int(3, 6);
    const bars = Array.from({ length: barCount }, () => rng.range(0.25, 1));
    billboards.push({
      x: Math.cos(ang) * r,
      y: Math.sin(ang) * r,
      w: rng.range(46, 78),
      h: rng.range(120, 210),
      rot: rng.range(0, TAU),
      color: rng.pick(palette.billboardColors),
      bars,
      flickerSeed: rng.range(0, TAU),
    });
  }

  const pylonCount = 10;
  const pylons = Array.from({ length: pylonCount }, (_, i) => {
    const ang = (TAU / pylonCount) * i;
    return { x: Math.cos(ang) * world.arenaRadius, y: Math.sin(ang) * world.arenaRadius, ang, color: palette.pylonColor };
  });

  const farLightCount = 10;
  const farLights = Array.from({ length: farLightCount }, () => ({
    ang: rng.range(0, TAU),
    r: world.arenaRadius * rng.range(1.15, 1.6),
    speed: rng.range(0.02, 0.06) * (rng.chance(0.5) ? 1 : -1),
    color: rng.pick(palette.farLightColors),
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
  ctx.fillStyle = p.color;
  ctx.shadowColor = p.color;
  ctx.shadowBlur = 14 * pulse;
  ctx.globalAlpha = 0.6 + 0.4 * pulse;
  ctx.beginPath();
  ctx.arc(0, -24, 5, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// Billboards are physical obstacles, not just backdrop -- the player has to
// route around them instead of walking straight through a "solid" neon
// structure. This is a circle-vs-rotated-rectangle push-out, done in the
// billboard's own local (unrotated) space: transform the player's offset
// into that space, clamp to the half-extents to find the nearest point on
// the rectangle, and if that point is within the player's radius, push the
// player back out along the separating axis and rotate the correction back
// to world space. Deliberately player-only (enemies/allies still pass
// through) -- full steering/pathfinding for hundreds of simultaneous units
// is a much bigger system than "the player has to go around a billboard".
export function resolveArenaObstacles(scenery, x, y, r) {
  for (const b of scenery.billboards) {
    const dx = x - b.x,
      dy = y - b.y;
    const cos = Math.cos(b.rot),
      sin = Math.sin(b.rot);
    const lx = dx * cos + dy * sin;
    const ly = -dx * sin + dy * cos;
    const hw = b.w / 2,
      hh = b.h / 2;
    if (lx < -hw - r || lx > hw + r || ly < -hh - r || ly > hh + r) continue;
    const cx = clamp(lx, -hw, hw);
    const cy = clamp(ly, -hh, hh);
    const ddx = lx - cx,
      ddy = ly - cy;
    const dist = Math.hypot(ddx, ddy);
    let nlx, nly;
    if (dist < 1e-4) {
      // Player center is inside the rectangle -- the clamp above is a no-op
      // for an in-range point, so cx/cy just echo lx/ly instead of giving a
      // boundary point, and ddx/ddy come out ~0. Push straight out along
      // whichever axis has the shallower penetration, landing exactly `r`
      // beyond that edge (not `r` from wherever inside the box we started).
      const penX = hw - Math.abs(lx);
      const penY = hh - Math.abs(ly);
      if (penX < penY) {
        nlx = (lx >= 0 ? 1 : -1) * (hw + r);
        nly = ly;
      } else {
        nlx = lx;
        nly = (ly >= 0 ? 1 : -1) * (hh + r);
      }
    } else {
      if (dist >= r) continue;
      nlx = cx + (ddx / dist) * r;
      nly = cy + (ddy / dist) * r;
    }
    x = b.x + nlx * cos - nly * sin;
    y = b.y + nlx * sin + nly * cos;
  }
  return { x, y };
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

// ------------------------------------------------------- planet ambience
// Billboards/pylons alone only carry the "planet" look, and only once the
// player wanders near one. These layers give the other four celestial
// `kind`s (moon/asteroidField/nebula/blackHole) their own unmistakable
// identity that's visible in every frame from the moment a run starts,
// regardless of where the player is standing.

// Ground craters for the Moon (Clone difficulty): tied to world space via a
// deterministic per-cell hash (not world.rng, so daily-challenge/gameplay
// RNG streams stay untouched) so they read as fixed terrain the camera
// pans over, rather than a screen-space overlay that would slide with it.
function cellHash(cx, cy, seed) {
  let h = (cx * 374761393 + cy * 668265263 + seed) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

// px/py are the player's live world-space position (world.player is never
// populated -- the real player object lives outside world.js -- so the
// caller passes it explicitly rather than this reading a stale null).
export function drawGroundCraters(ctx, px, py, seed) {
  const cell = 220;
  const viewR = 700;
  const minCx = Math.floor((px - viewR) / cell);
  const maxCx = Math.floor((px + viewR) / cell);
  const minCy = Math.floor((py - viewR) / cell);
  const maxCy = Math.floor((py + viewR) / cell);
  ctx.save();
  for (let cx = minCx; cx <= maxCx; cx++) {
    for (let cy = minCy; cy <= maxCy; cy++) {
      const roll = cellHash(cx, cy, seed | 0);
      if (roll > 0.4) continue; // ~40% of cells get a crater
      const jx = cellHash(cx, cy, (seed | 0) ^ 0x9e3779b9);
      const jy = cellHash(cx, cy, (seed | 0) ^ 0x85ebca6b);
      const jr = cellHash(cx, cy, (seed | 0) ^ 0xc2b2ae35);
      const x = cx * cell + jx * cell,
        y = cy * cell + jy * cell;
      const r = 18 + jr * 34;
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }
  ctx.restore();
}

const ambientRockCache = new Map();
function getAmbientRocks(seed) {
  let rocks = ambientRockCache.get(seed);
  if (!rocks) {
    const rng = new RNG(seed >>> 0);
    rocks = Array.from({ length: 26 }, () => {
      const sides = rng.int(5, 8);
      const baseR = rng.range(8, 26);
      const poly = Array.from({ length: sides }, (_, i) => {
        const a = (TAU / sides) * i;
        const jitter = rng.range(0.7, 1.15);
        return { x: Math.cos(a) * baseR * jitter, y: Math.sin(a) * baseR * jitter };
      });
      return {
        x0: rng.next(),
        y: rng.range(0.05, 0.98),
        depth: rng.range(0.3, 1),
        speed: rng.range(10, 34),
        rotSpeed: rng.range(-0.5, 0.5),
        rotSeed: rng.range(0, TAU),
        poly,
      };
    });
    ambientRockCache.set(seed, rocks);
  }
  return rocks;
}

const ambientNebulaCache = new Map();
function getAmbientNebulaBlobs(seed) {
  let blobs = ambientNebulaCache.get(seed);
  if (!blobs) {
    const rng = new RNG(seed >>> 0);
    blobs = Array.from({ length: 6 }, () => ({
      x: rng.range(0.1, 0.9),
      y: rng.range(0.1, 0.9),
      r: rng.range(0.22, 0.4),
      seed: rng.range(0, TAU),
    }));
    ambientNebulaCache.set(seed, blobs);
  }
  return blobs;
}

// Screen-space ambience for the four non-"planet" kinds -- drawn every
// frame at full viewport size, independent of camera position, so it's
// always visible instead of depending on the player wandering toward
// world-space scenery. Called after the background fill/glow, before the
// camera transform. `kind` is CELESTIAL_BODIES[id].kind (null for War
// Mode/Daily, which fall through to the default cyan/magenta look untouched).
export function drawArenaAmbience(ctx, w, h, t, kind, palette) {
  if (kind === "asteroidField") {
    ctx.save();
    for (const rock of getAmbientRocks(0x41535431)) {
      const span = w + 200;
      const x = ((((rock.x0 * span + t * rock.speed * rock.depth) % span) + span) % span) - 100;
      const y = rock.y * h;
      const scale = 0.6 + rock.depth * 1.4;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rock.rotSeed + t * rock.rotSpeed);
      ctx.scale(scale, scale);
      ctx.globalAlpha = 0.18 + rock.depth * 0.22;
      ctx.fillStyle = palette.accent;
      ctx.beginPath();
      rock.poly.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  } else if (kind === "nebula") {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const colors = palette.billboardColors;
    for (const [i, b] of getAmbientNebulaBlobs(0x4e454255).entries()) {
      const dx = Math.sin(t * 0.04 + b.seed) * w * 0.05;
      const dy = Math.cos(t * 0.035 + b.seed * 1.3) * h * 0.04;
      const x = b.x * w + dx,
        y = b.y * h + dy,
        r = b.r * Math.min(w, h);
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, hexToRgba(colors[i % colors.length], 0.22));
      grad.addColorStop(1, hexToRgba(colors[i % colors.length], 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  } else if (kind === "blackHole") {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const cx = w / 2,
      cy = h * 0.4;
    const R = Math.min(w, h) * 0.14;
    const colors = palette.billboardColors;
    for (let i = 0; i < 3; i++) {
      const rr = R * (1.6 + i * 0.7);
      const rot = t * (0.2 + i * 0.06) + i;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.globalAlpha = 0.3 - i * 0.06;
      ctx.strokeStyle = colors[i % colors.length];
      ctx.lineWidth = R * 0.14;
      ctx.beginPath();
      ctx.ellipse(0, 0, rr, rr * 0.3, 0, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    // heavier vignette pulling the whole viewport toward black -- the
    // event horizon is always "just offscreen"
    const vign = ctx.createRadialGradient(cx, cy, R * 2, cx, cy, Math.max(w, h) * 0.75);
    vign.addColorStop(0, "rgba(0,0,0,0)");
    vign.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = vign;
    ctx.fillRect(0, 0, w, h);
  }
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

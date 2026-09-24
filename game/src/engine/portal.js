// The Planet Select screen's "portal": a rounded-rectangle window that tilts
// toward the pointer with a fake-3D projection, clipping into a procedural
// celestial scene that stays screen-locked (drawn once per frame at full
// viewport size, independent of the window's own position) so the window
// reads as looking *through* a stationary destination rather than a card
// with a texture stuck to it. Every scene here is Canvas 2D primitives --
// no images/video -- keeping the "fully offline, zero external assets" CSP
// posture intact even for this screen.
import { TAU, RNG, clamp, hexToRgba } from "./utils.js";

export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Drives `setter(easedValue)` from 0 to 1 over `duration` ms via rAF.
// Resolves once the final frame (value === 1) has been applied.
export function animateValue(setter, duration) {
  return new Promise((resolve) => {
    if (duration <= 0) {
      setter(1);
      resolve();
      return;
    }
    const start = performance.now();
    function tick(now) {
      const raw = Math.min(1, (now - start) / duration);
      setter(easeInOutCubic(raw));
      if (raw >= 1) resolve();
      else requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}

// Pointer position (in CSS px) -> target tilt angles in degrees. Mirrors a
// classic parallax-card formula: horizontal offset drives the Y-axis spin,
// vertical offset drives the (inverted) X-axis tilt.
export function computeTiltTarget(clientX, clientY, innerW, innerH) {
  return {
    targetX: (clientY / innerH - 0.5) * -33,
    targetY: (clientX / innerW - 0.5) * 37.4,
  };
}

// Damped approach toward the target angle, dt in ms (caller clamps to
// avoid a huge jump after a backgrounded tab).
export function approachTilt(current, target, dtMs) {
  return current + (target - current) * Math.min(1, dtMs * 0.009);
}

// Fake-perspective projection of a local-space point (rotations in degrees).
export function projectPoint(x, y, rotXDeg, rotYDeg, focal = 850) {
  const ax = (rotXDeg * Math.PI) / 180;
  const ay = (rotYDeg * Math.PI) / 180;
  const xx = x * Math.cos(ay);
  const yy = y * Math.cos(ax);
  const z = x * Math.sin(ay) - y * Math.sin(ax);
  const p = focal / (focal + z);
  return { x: xx * p, y: yy * p };
}

// Local-space (origin-centered) points walking a rounded rectangle's four
// corner arcs, 11 samples each (~44 points total).
export function roundedRectPoints(w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  const corners = [
    [w / 2 - rr, -h / 2 + rr, -Math.PI / 2, 0],
    [w / 2 - rr, h / 2 - rr, 0, Math.PI / 2],
    [-w / 2 + rr, h / 2 - rr, Math.PI / 2, Math.PI],
    [-w / 2 + rr, -h / 2 + rr, Math.PI, Math.PI * 1.5],
  ];
  const points = [];
  for (const [ccx, ccy, a0, a1] of corners) {
    for (let i = 0; i <= 10; i++) {
      const a = a0 + ((a1 - a0) * i) / 10;
      points.push({ x: ccx + Math.cos(a) * rr, y: ccy + Math.sin(a) * rr });
    }
  }
  return points;
}

// The full mask path in screen space: rounded-rect corners -> tilt
// projection -> translate to the window's screen center.
export function buildMaskPoints(w, h, r, rotX, rotY, cx, cy) {
  return roundedRectPoints(w, h, r).map((pt) => {
    const proj = projectPoint(pt.x, pt.y, rotX, rotY);
    return { x: cx + proj.x, y: cy + proj.y };
  });
}

export function pathFromPoints(points) {
  const path = new Path2D();
  points.forEach((p, i) => (i === 0 ? path.moveTo(p.x, p.y) : path.lineTo(p.x, p.y)));
  path.closePath();
  return path;
}

// Bottom-of-viewport darken so the sidebar/heading/content text over the
// portal stays legible regardless of what the scene behind it is doing.
export function drawShade(ctx, w, h) {
  const grad = ctx.createLinearGradient(0, h * 0.52, 0, h);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.88)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, h * 0.52, w, h * 0.48);
}

// ---------------------------------------------------------------- scenes
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const starfieldCache = new Map();
function getStarfield(key, count) {
  let stars = starfieldCache.get(key);
  if (!stars) {
    const rng = new RNG(hashStr(key));
    stars = Array.from({ length: count }, () => ({
      x: rng.next(),
      y: rng.next(),
      r: rng.range(0.5, 1.8),
      phase: rng.range(0, TAU),
      speed: rng.range(0.4, 1.4),
    }));
    starfieldCache.set(key, stars);
  }
  return stars;
}

function drawStarfield(ctx, w, h, key, t, count = 150) {
  const stars = getStarfield(key, count);
  ctx.save();
  for (const s of stars) {
    const alpha = 0.3 + 0.6 * Math.abs(Math.sin(t * s.speed + s.phase));
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(s.x * w, s.y * h, s.r, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawRingArc(ctx, cx, cy, rx, ry, rot, a0, a1, color, width, alpha) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, a0, a1);
  ctx.stroke();
  ctx.restore();
}

function drawPlanetScene(ctx, body, w, h, t) {
  ctx.fillStyle = "#03040a";
  ctx.fillRect(0, 0, w, h);
  drawStarfield(ctx, w, h, body.name, t);

  const cx = w / 2,
    cy = h * 0.47;
  const R = Math.min(w, h) * 0.3;

  const glow = ctx.createRadialGradient(cx, cy, R * 0.85, cx, cy, R * 1.6);
  glow.addColorStop(0, hexToRgba(body.glow, 0.32));
  glow.addColorStop(1, hexToRgba(body.glow, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 1.6, 0, TAU);
  ctx.fill();

  if (body.ringed) drawRingArc(ctx, cx, cy, R * 1.9, R * 0.5, -0.32, 0, Math.PI, body.bands[1], R * 0.2, 0.3);

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.clip();
  ctx.fillStyle = body.bands[body.bands.length - 1];
  ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
  const bandCount = body.bands.length;
  for (let i = 0; i < bandCount; i++) {
    const bandY = cy - R + ((i + 0.5) * (2 * R)) / bandCount;
    const wobble = Math.sin(t * 0.15 + i * 1.7) * R * 0.08;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = body.bands[i];
    ctx.beginPath();
    ctx.ellipse(cx + wobble, bandY, R * 1.05, (R / bandCount) * 0.68, 0, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  const shade = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.35, R * 0.1, cx, cy, R * 1.1);
  shade.addColorStop(0, "rgba(255,255,255,0.2)");
  shade.addColorStop(0.5, "rgba(255,255,255,0)");
  shade.addColorStop(1, "rgba(0,0,0,0.6)");
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = hexToRgba(body.glow, 0.5);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.stroke();

  if (body.ringed) drawRingArc(ctx, cx, cy, R * 1.9, R * 0.5, -0.32, Math.PI, TAU, body.bands[1], R * 0.2, 0.75);
}

const craterCache = new Map();
function getCraters(key) {
  let craters = craterCache.get(key);
  if (!craters) {
    const rng = new RNG(hashStr(key));
    craters = Array.from({ length: 9 }, () => ({
      x: rng.range(-0.7, 0.7),
      y: rng.range(-0.7, 0.7),
      r: rng.range(0.06, 0.16),
    }));
    craterCache.set(key, craters);
  }
  return craters;
}

function drawMoonScene(ctx, body, w, h, t) {
  ctx.fillStyle = "#040406";
  ctx.fillRect(0, 0, w, h);
  drawStarfield(ctx, w, h, body.name, t);

  const cx = w / 2,
    cy = h * 0.47;
  const R = Math.min(w, h) * 0.22;

  const glow = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.3);
  glow.addColorStop(0, hexToRgba(body.glow, 0.16));
  glow.addColorStop(1, hexToRgba(body.glow, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 1.3, 0, TAU);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.clip();
  ctx.fillStyle = body.bands[0];
  ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
  for (const c of getCraters(body.name)) {
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.arc(cx + c.x * R, cy + c.y * R, c.r * R, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = Math.max(1, c.r * R * 0.25);
    ctx.stroke();
  }
  const shade = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.35, R * 0.1, cx, cy, R * 1.1);
  shade.addColorStop(0, "rgba(255,255,255,0.15)");
  shade.addColorStop(0.5, "rgba(255,255,255,0)");
  shade.addColorStop(1, "rgba(0,0,0,0.65)");
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = hexToRgba(body.glow, 0.35);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.stroke();
}

const rockCache = new Map();
function getRocks(key) {
  let rocks = rockCache.get(key);
  if (!rocks) {
    const rng = new RNG(hashStr(key));
    rocks = Array.from({ length: 22 }, () => {
      const sides = rng.int(5, 8);
      const baseR = rng.range(10, 34);
      const poly = Array.from({ length: sides }, (_, i) => {
        const a = (TAU / sides) * i;
        const jitter = rng.range(0.7, 1.15);
        return { x: Math.cos(a) * baseR * jitter, y: Math.sin(a) * baseR * jitter };
      });
      return {
        x0: rng.next(),
        y: rng.range(0.1, 0.95),
        depth: rng.range(0.35, 1),
        speed: rng.range(6, 22),
        rotSpeed: rng.range(-0.6, 0.6),
        rotSeed: rng.range(0, TAU),
        poly,
      };
    });
    rockCache.set(key, rocks);
  }
  return rocks;
}

function drawAsteroidFieldScene(ctx, body, w, h, t) {
  ctx.fillStyle = "#050403";
  ctx.fillRect(0, 0, w, h);
  drawStarfield(ctx, w, h, body.name, t, 110);

  for (const rock of getRocks(body.name)) {
    const span = w + 300;
    const x = (((rock.x0 * span + t * rock.speed * rock.depth) % span) + span) % span - 150;
    const y = rock.y * h;
    const scale = 0.5 + rock.depth * 1.1;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rock.rotSeed + t * rock.rotSpeed);
    ctx.scale(scale, scale);
    ctx.globalAlpha = 0.4 + rock.depth * 0.5;
    ctx.fillStyle = body.bands[1];
    ctx.beginPath();
    rock.poly.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

const nebulaCache = new Map();
function getNebulaBlobs(key) {
  let blobs = nebulaCache.get(key);
  if (!blobs) {
    const rng = new RNG(hashStr(key));
    blobs = Array.from({ length: 7 }, () => ({
      x: rng.range(0.15, 0.85),
      y: rng.range(0.15, 0.85),
      r: rng.range(0.18, 0.36),
      seed: rng.range(0, TAU),
      color: rng.int(0, 2),
    }));
    nebulaCache.set(key, blobs);
  }
  return blobs;
}

function drawNebulaScene(ctx, body, w, h, t) {
  ctx.fillStyle = "#060310";
  ctx.fillRect(0, 0, w, h);
  drawStarfield(ctx, w, h, body.name, t, 90);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const b of getNebulaBlobs(body.name)) {
    const dx = Math.sin(t * 0.05 + b.seed) * w * 0.04;
    const dy = Math.cos(t * 0.04 + b.seed * 1.3) * h * 0.03;
    const x = b.x * w + dx,
      y = b.y * h + dy,
      r = b.r * Math.min(w, h);
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, hexToRgba(body.bands[b.color % body.bands.length], 0.28));
    grad.addColorStop(1, hexToRgba(body.bands[b.color % body.bands.length], 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawBlackHoleScene(ctx, body, w, h, t) {
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, w, h);
  drawStarfield(ctx, w, h, body.name, t, 130);

  const cx = w / 2,
    cy = h * 0.47;
  const R = Math.min(w, h) * 0.16;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const ringColors = body.bands;
  for (let i = 0; i < 3; i++) {
    const rr = R * (1.4 + i * 0.55);
    const rot = t * (0.25 + i * 0.08) + i;
    drawRingArc(ctx, cx, cy, rr, rr * 0.32, rot, 0, TAU, ringColors[i % ringColors.length], R * 0.16, 0.4 - i * 0.08);
  }
  ctx.restore();

  const vign = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.15);
  vign.addColorStop(0, "rgba(0,0,0,1)");
  vign.addColorStop(0.85, "rgba(0,0,0,1)");
  vign.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = vign;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 1.15, 0, TAU);
  ctx.fill();
}

const SCENE_RENDERERS = {
  planet: drawPlanetScene,
  moon: drawMoonScene,
  asteroidField: drawAsteroidFieldScene,
  nebula: drawNebulaScene,
  blackHole: drawBlackHoleScene,
};

export function drawCelestialScene(ctx, body, w, h, t) {
  (SCENE_RENDERERS[body.kind] || drawPlanetScene)(ctx, body, w, h, t);
}

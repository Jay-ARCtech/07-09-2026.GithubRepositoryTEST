import { CHARACTER_LIST, isCharacterUnlocked } from "../game/characters.js";
import { PASSIVES, PASSIVE_LIST } from "../game/passives.js";
import { WEAPONS, WEAPON_LIST } from "../game/weapons.js";
import { META_UPGRADES, ALLY_META_UPGRADES, upgradeCost } from "../game/upgrades.js";
import { ACHIEVEMENTS } from "../game/achievements.js";
import { OVERFLOW_OPTIONS, REVIVE_OPTIONS } from "../game/levelup-options.js";
import { ALLY_LIST } from "../game/allies.js";
import { ENEMY_LIST } from "../game/enemies.js";
import { BOSS_LIST } from "../game/bosses.js";
import { MIN_EMPIRES, MAX_EMPIRES } from "../game/warmode.js";
import { formatTime } from "../engine/utils.js";
import { drawUnitShape, drawBossShape, drawAllyShape } from "../engine/scenery.js";
import { DIFFICULTY_LIST } from "../game/difficulty.js";
import { CELESTIAL_BODIES, celestialFacts } from "../game/celestialBodies.js";
import { animateValue, computeTiltTarget, approachTilt, buildMaskPoints, pathFromPoints, drawShade, drawCelestialScene } from "../engine/portal.js";

function resolveOptionDef(opt) {
  if (opt.kind === "weapon") return WEAPONS[opt.id];
  if (opt.kind === "overflow") return OVERFLOW_OPTIONS[opt.id];
  if (opt.kind === "revive") return REVIVE_OPTIONS[opt.id];
  return PASSIVES[opt.id];
}

function isZeroArgDesc(kind) {
  return kind === "overflow" || kind === "revive";
}

const el = (id) => document.getElementById(id);
const SCREEN_IDS = [
  "screen-menu",
  "screen-charselect",
  "screen-pause",
  "screen-levelup",
  "screen-chest",
  "screen-gameover",
  "screen-settings",
  "screen-armory",
  "screen-achievements",
  "screen-ascension",
  "screen-warsetup",
  "screen-codex",
  "screen-difficulty",
  "screen-tutorial",
];

export function hideAllScreens() {
  for (const id of SCREEN_IDS) el(id).classList.add("hidden");
}

export function showScreen(id) {
  hideAllScreens();
  el(id).classList.remove("hidden");
}

let actionHandlers = {};
export function initScreens(actions) {
  actionHandlers = actions;
  document.body.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    actionHandlers.onAnyClick?.();
    actionHandlers[action]?.(btn);
  });
}

function clearChildren(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

// Draws the exact same silhouette used on the battlefield (scenery.js's
// drawUnitShape/drawBossShape/drawAllyShape) into a small preview canvas,
// instead of a unicode glyph that has to be hand-kept in sync with
// whatever the live render actually looks like. `shape.kind` picks which
// draw function; `hullColor` mirrors main.js's ship-hull special case
// (Mimic/operator silhouettes are a dark hull over their own glow, not a
// solid fill in the entity's color).
function drawCardShapePreview(canvas, shape) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width,
    h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w / 2, h / 2);
  const r = Math.min(w, h) * 0.34;
  const facing = -Math.PI / 2;
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = shape.color;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  const isShipHull = shape.shapeName === "mimic" || shape.shapeName === "operator";
  const hullColor = isShipHull ? "#0b1220" : shape.color;
  if (shape.kind === "boss") drawBossShape(ctx, shape.shapeName, r, hullColor, { time: 0, facing });
  else if (shape.kind === "ally") drawAllyShape(ctx, shape.shapeName, r, shape.color, facing);
  else drawUnitShape(ctx, shape.shapeName, r, hullColor, { facing });
  ctx.restore();
}

function makeCard({ icon, name, desc, meta, locked, onClick, accent, shape }) {
  const card = document.createElement("div");
  card.className = "card" + (locked ? " locked" : "");
  if (accent) card.style.borderColor = accent;
  let iconEl;
  if (shape) {
    iconEl = document.createElement("canvas");
    iconEl.className = "card-icon card-shape-icon";
    iconEl.width = 56;
    iconEl.height = 56;
    drawCardShapePreview(iconEl, shape);
  } else {
    iconEl = document.createElement("div");
    iconEl.className = "card-icon";
    iconEl.textContent = icon || "";
    if (accent) iconEl.style.color = accent;
  }
  const nameEl = document.createElement("div");
  nameEl.className = "card-name";
  nameEl.textContent = name;
  const descEl = document.createElement("div");
  descEl.className = "card-desc";
  descEl.textContent = desc;
  card.append(iconEl, nameEl, descEl);
  if (meta) {
    const metaEl = document.createElement("div");
    metaEl.className = "card-meta";
    metaEl.textContent = meta;
    card.appendChild(metaEl);
  }
  if (!locked && onClick) card.addEventListener("click", onClick);
  return card;
}

// ---------------- Character select ----------------
export function renderCharSelect(meta, onSelect) {
  const list = el("char-list");
  clearChildren(list);
  const startBtn = el("btn-start-run");
  startBtn.disabled = true;
  let selectedId = null;
  for (const charDef of CHARACTER_LIST) {
    const unlocked = isCharacterUnlocked(charDef, meta);
    const lockMsg = !unlocked
      ? charDef.unlock.type === "cores"
        ? `Unlock: ${charDef.unlock.amount} Cores`
        : "Unlock: hidden achievement"
      : `Weapon: ${WEAPONS[charDef.startWeapon].name}`;
    const card = makeCard({
      icon: "◆",
      name: charDef.name,
      desc: charDef.tagline,
      meta: lockMsg,
      locked: !unlocked,
      accent: charDef.color,
      onClick: () => {
        selectedId = charDef.id;
        for (const c of list.children) c.style.outline = "none";
        card.style.outline = `2px solid ${charDef.color}`;
        startBtn.disabled = false;
        startBtn.onclick = () => onSelect(charDef.id);
      },
    });
    list.appendChild(card);
  }
}

// ---------------- Level up ----------------
export function renderLevelUp(options, ctx) {
  el("levelup-title").textContent = `Level ${ctx.level} — Choose an Upgrade`;
  const list = el("choice-list");
  clearChildren(list);
  for (const opt of options) {
    const def = resolveOptionDef(opt);
    const nextLevel = opt.currentLevel + 1;
    const desc = opt.isEvolution ? def.evolution.desc : isZeroArgDesc(opt.kind) ? def.desc() : def.desc(nextLevel);
    const kindLabel = opt.isEvolution ? "EVOLUTION" : opt.kind === "weapon" ? "Weapon" : opt.kind === "overflow" ? "Overflow" : opt.kind === "revive" ? "Revive" : "Passive";
    const card = makeCard({
      icon: def.icon,
      name: opt.isEvolution ? `${def.name} → ${def.evolution.name}` : opt.kind === "revive" ? def.name : `${def.name}${opt.isNew ? " (New)" : ` Lv.${nextLevel}`}`,
      desc,
      meta: kindLabel,
      accent: def.color,
      onClick: () => ctx.onPick(opt),
    });
    list.appendChild(card);
  }
  const actions = el("levelup-actions");
  clearChildren(actions);
  if (ctx.rerollsLeft > 0) {
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = `Reroll (${ctx.rerollsLeft} left)`;
    btn.onclick = () => ctx.onReroll();
    actions.appendChild(btn);
  }
}

// ---------------- Chest ----------------
export function renderChest(options, onPick) {
  const list = el("chest-choice-list");
  clearChildren(list);
  for (const opt of options) {
    const def = resolveOptionDef(opt);
    const desc = opt.isEvolution ? def.evolution.desc : isZeroArgDesc(opt.kind) ? def.desc() : def.desc(opt.currentLevel + 1);
    const kindLabel = opt.isEvolution ? "EVOLUTION" : opt.kind === "weapon" ? "Weapon" : opt.kind === "overflow" ? "Overflow" : opt.kind === "revive" ? "Revive" : "Passive";
    const card = makeCard({
      icon: def.icon,
      name: opt.isEvolution ? `${def.name} → ${def.evolution.name}` : opt.kind === "revive" ? def.name : `${def.name}${opt.isNew ? " (New)" : ""}`,
      desc,
      meta: kindLabel,
      accent: def.color,
      onClick: () => onPick(opt),
    });
    list.appendChild(card);
  }
}

// ---------------- Game over ----------------
export function renderGameOver({ victory, world, coresEarned, newBestTime, newBestKills, player, selfDestruct, ascendedTier }) {
  el("gameover-title").textContent = victory ? "Cycle Complete" : selfDestruct ? "Core Overloaded" : "Run Ended";
  const grid = el("gameover-stats");
  clearChildren(grid);
  const rows = [
    ["Time Survived", formatTime(world.time)],
    ["Level Reached", player.level],
    ["Kills", world.kills],
    ["Bosses Defeated", world.bossesKilled],
    ["Cores Earned", `+${coresEarned}`],
  ];
  if (ascendedTier) rows.push([`Ascended: Tier ${ascendedTier.tier}`, ascendedTier.name]);
  else if (selfDestruct) rows.push(["Ascension", "Requirement not met"]);
  if (newBestTime) rows.push(["New Best Time!", "★"]);
  if (newBestKills) rows.push(["New Best Kills!", "★"]);
  for (const [label, val] of rows) {
    const row = document.createElement("div");
    row.className = "stat-row";
    const l = document.createElement("span");
    l.textContent = label;
    const v = document.createElement("span");
    v.className = "stat-val";
    v.textContent = String(val);
    row.append(l, v);
    grid.appendChild(row);
  }
}

// ---------------- Settings ----------------
export function renderSettings(settings, callbacks) {
  const body = el("settings-body");
  clearChildren(body);

  const slider = (label, key, value) => {
    const row = document.createElement("div");
    row.className = "setting-row";
    const l = document.createElement("span");
    l.textContent = label;
    const input = document.createElement("input");
    input.type = "range";
    input.min = "0";
    input.max = "1";
    input.step = "0.05";
    input.value = String(value);
    input.addEventListener("input", () => callbacks.onVolume(key, parseFloat(input.value)));
    row.append(l, input);
    return row;
  };
  body.appendChild(slider("Master Volume", "masterVolume", settings.masterVolume));
  body.appendChild(slider("Music Volume", "musicVolume", settings.musicVolume));
  body.appendChild(slider("SFX Volume", "sfxVolume", settings.sfxVolume));

  const toggle = (label, key, value) => {
    const row = document.createElement("div");
    row.className = "setting-row";
    const l = document.createElement("span");
    l.textContent = label;
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = value;
    input.addEventListener("change", () => callbacks.onToggle(key, input.checked));
    row.append(l, input);
    return row;
  };
  body.appendChild(toggle("Screen Shake", "screenShake", settings.screenShake));
  body.appendChild(toggle("Damage Numbers", "damageNumbers", settings.damageNumbers));
  body.appendChild(toggle("Colorblind-Friendly Palette", "colorblindMode", settings.colorblindMode));

  const densityRow = document.createElement("div");
  densityRow.className = "setting-row";
  const dl = document.createElement("span");
  dl.textContent = "Particle Density";
  const select = document.createElement("select");
  for (const opt of ["low", "medium", "high"]) {
    const o = document.createElement("option");
    o.value = opt;
    o.textContent = opt[0].toUpperCase() + opt.slice(1);
    if (opt === settings.particleDensity) o.selected = true;
    select.appendChild(o);
  }
  select.addEventListener("change", () => callbacks.onDensity(select.value));
  densityRow.append(dl, select);
  body.appendChild(densityRow);

  const ioRow = document.createElement("div");
  ioRow.className = "setting-row";
  ioRow.style.flexDirection = "column";
  ioRow.style.alignItems = "stretch";
  const ioLabel = document.createElement("span");
  ioLabel.textContent = "Save Backup (copy this string somewhere safe, or paste one to restore)";
  const textarea = document.createElement("textarea");
  textarea.id = "save-string";
  textarea.value = callbacks.exportString();
  const ioButtons = document.createElement("div");
  ioButtons.className = "save-io";
  const exportBtn = document.createElement("button");
  exportBtn.className = "btn";
  exportBtn.textContent = "Copy Current Save";
  exportBtn.onclick = () => {
    textarea.value = callbacks.exportString();
    textarea.select();
  };
  const importBtn = document.createElement("button");
  importBtn.className = "btn";
  importBtn.textContent = "Import From Text Above";
  importBtn.onclick = () => callbacks.importString(textarea.value);
  ioButtons.append(exportBtn, importBtn);
  ioRow.append(ioLabel, textarea, ioButtons);
  body.appendChild(ioRow);
}

// ---------------- Armory ----------------
export function renderArmory(meta, onBuy) {
  el("armory-cores").textContent = `◈ ${meta.cores}`;
  const grid = el("armory-body");
  clearChildren(grid);
  for (const [key, def] of Object.entries(META_UPGRADES)) {
    const level = meta.upgrades[key] || 0;
    const maxed = level >= def.max;
    const cost = maxed ? null : upgradeCost(def, level);
    const card = makeCard({
      icon: def.icon,
      name: `${def.label} (Lv ${level}/${def.max})`,
      desc: def.desc,
      meta: maxed ? "MAXED" : `Cost: ${cost} Cores`,
      locked: maxed || meta.cores < cost,
      onClick: () => onBuy(key),
    });
    grid.appendChild(card);
  }
  for (const charDef of CHARACTER_LIST) {
    if (isCharacterUnlocked(charDef, meta)) continue;
    const card = makeCard({
      icon: "◆",
      name: charDef.name,
      desc: charDef.tagline,
      meta:
        charDef.unlock.type === "cores"
          ? `Unlock: ${charDef.unlock.amount} Cores`
          : "Unlock via achievement",
      accent: charDef.color,
      locked: charDef.unlock.type !== "cores" || meta.cores < charDef.unlock.amount,
      onClick: () => onBuy("character:" + charDef.id),
    });
    grid.appendChild(card);
  }
}

// ---------------- Achievements ----------------
export function renderAchievements(meta) {
  const grid = el("achievements-body");
  clearChildren(grid);
  for (const [id, def] of Object.entries(ACHIEVEMENTS)) {
    const unlocked = !!meta.achievements[id];
    const row = document.createElement("div");
    row.className = "stat-row" + (unlocked ? "" : " achievement-locked");
    const l = document.createElement("span");
    l.textContent = `${unlocked ? "★" : "☆"} ${def.name} — ${def.desc}`;
    row.appendChild(l);
    grid.appendChild(row);
  }
}

// ---------------- Ascension ----------------
export function renderAscension(meta, ascensionTiers) {
  el("ascension-level-label").textContent = `(${meta.ascensionLevel || 0}/${ascensionTiers.length})`;
  const grid = el("ascension-body");
  clearChildren(grid);
  ascensionTiers.forEach((t, i) => {
    const unlocked = (meta.ascensionLevel || 0) > i;
    const row = document.createElement("div");
    row.className = "stat-row" + (unlocked ? "" : " achievement-locked");
    const l = document.createElement("span");
    l.textContent = `${unlocked ? "★" : "☆"} Tier ${t.tier}: ${t.name} — ${t.desc}`;
    const v = document.createElement("span");
    v.className = "stat-val";
    v.textContent = unlocked ? "Owned" : `Needs Lv.${t.levelRequirement}`;
    row.append(l, v);
    grid.appendChild(row);
  });
}

// ---------------- War Mode setup ----------------
const WAR_THREAT_LABEL = {
  2: "Easier -- two empires, still zero mercy.",
  3: "Balanced.",
  4: "Hard.",
  5: "Very hard -- five fronts at once.",
  6: "NIGHTMARE -- six empires, no infighting, full onslaught.",
};

export function renderWarSetup(onPick) {
  const body = el("warsetup-body");
  clearChildren(body);

  const row = document.createElement("div");
  row.className = "warsetup-slider-row";
  const slider = document.createElement("input");
  slider.type = "range";
  slider.id = "warsetup-slider";
  slider.min = String(MIN_EMPIRES);
  slider.max = String(MAX_EMPIRES);
  slider.step = "1";
  slider.value = "4";
  row.appendChild(slider);
  body.appendChild(row);

  const readout = document.createElement("div");
  readout.className = "warsetup-readout";
  body.appendChild(readout);

  const note = document.createElement("p");
  note.className = "codex-subhint";
  note.textContent =
    "Empires never fight each other -- every boss and every troop from every empire hunts only you and your allies, so this is additive, not diluted.";
  body.appendChild(note);

  const updateReadout = () => {
    const n = parseInt(slider.value, 10);
    readout.innerHTML = "";
    const big = document.createElement("span");
    big.className = "warsetup-count";
    big.textContent = `${n} Empire${n === 1 ? "" : "s"}`;
    const label = document.createElement("span");
    label.className = "warsetup-label";
    label.textContent = WAR_THREAT_LABEL[n] || "";
    readout.append(big, label);
  };
  slider.addEventListener("input", updateReadout);
  updateReadout();

  const startBtn = document.createElement("button");
  startBtn.className = "btn btn-danger";
  startBtn.textContent = "Deploy";
  startBtn.addEventListener("click", () => onPick(parseInt(slider.value, 10)));
  body.appendChild(startBtn);
}

// ---------------- Codex (ally + enemy + boss bestiary) ----------------
export function renderCodex(meta, onAllyUpgrade) {
  el("codex-cores").textContent = `◈ ${meta.cores}`;

  const allyGrid = el("codex-allies");
  clearChildren(allyGrid);
  for (const ally of ALLY_LIST) {
    const key = ally.id;
    const upDef = ALLY_META_UPGRADES[key];
    const level = meta.allyUpgrades?.[key] || 0;
    const maxed = level >= upDef.max;
    const cost = maxed ? null : upgradeCost(upDef, level);
    const card = makeCard({
      icon: ally.icon,
      name: `${ally.name} (Upgrade Lv ${level}/${upDef.max})`,
      desc: `${ally.desc} Unlock via: ${ally.unlockHint}.`,
      meta: maxed ? "MAXED" : `Upgrade: ${upDef.desc} -- Cost: ${cost} Cores`,
      accent: ally.color,
      locked: maxed || meta.cores < cost,
      onClick: () => onAllyUpgrade(key),
      shape: { kind: "ally", shapeName: ally.id, color: ally.color },
    });
    allyGrid.appendChild(card);
  }

  const enemyGrid = el("codex-enemies");
  clearChildren(enemyGrid);
  for (const enemy of ENEMY_LIST) {
    const card = makeCard({
      icon: enemy.icon,
      name: enemy.name,
      desc: enemy.desc,
      meta:
        enemy.behavior === "seek"
          ? "Melee"
          : enemy.behavior === "mimic"
            ? "Mirror"
            : enemy.behavior.startsWith("heal") || enemy.behavior.startsWith("summon") || enemy.behavior.startsWith("hazard")
              ? "Support"
              : "Ranged",
      accent: enemy.color,
      shape: { kind: "unit", shapeName: enemy.shape, color: enemy.color },
    });
    enemyGrid.appendChild(card);
  }

  const bossGrid = el("codex-bosses");
  clearChildren(bossGrid);
  for (const boss of BOSS_LIST) {
    const card = makeCard({
      icon: boss.icon,
      name: boss.name,
      desc: boss.desc,
      meta: "Boss",
      accent: boss.color,
      shape: { kind: "boss", shapeName: boss.shape, color: boss.color },
    });
    bossGrid.appendChild(card);
  }
}

// ---------------- Tutorial ("How to Play") ----------------
const TUTORIAL_CONTROLS = [
  { label: "Move", keys: "WASD / Arrow Keys / Left Stick / On-screen Joystick" },
  { label: "Dash (brief i-frames)", keys: "Space or Shift / Gamepad A / Cross" },
  { label: "Pause", keys: "Esc or P / Gamepad Start" },
  { label: "Aim & Fire", keys: "Automatic -- every weapon targets the nearest enemy on its own. Just move." },
];

const TUTORIAL_LOOP = [
  "Survive. Enemies spawn continuously and get more numerous and varied the longer you last -- your only jobs are to stay alive and keep your build growing.",
  "Kill things for XP gems, then pick them up (or let Pickup Radius passives do it for you). Filling the XP bar levels you up and pauses the action so you can pick a new weapon, a passive, or level up one you already have.",
  "Level a weapon high enough (with its paired passive maxed) and it evolves into a stronger form -- shown as a card border glow and a name change on the weapon tray.",
  "A boss spawns roughly every 4.5 minutes. Beating all 4 in a row is a full \"Cycle Complete\" run.",
  "Supply Caches (chests) and Overdrive pickups appear on a timer -- chests offer a small choice of bonus cards, Overdrive is a temporary power spike.",
  "Cores bank at Game Over (or when you voluntarily Overload Core mid-run) and buy permanent upgrades and new characters in the Armory -- progress persists between runs even if the run itself doesn't.",
];

const TUTORIAL_RARITY = [
  { id: "common", label: "Common", color: "#a3a3a3", pct: 50, blurb: "One clean stat bump. The backbone of most builds -- expect to see a lot of these." },
  { id: "uncommon", label: "Uncommon", color: "#4ade80", pct: 20, blurb: "Two stats combined, a tradeoff (more of one thing for less of another), or a trigger-based effect." },
  { id: "rare", label: "Rare", color: "#7dd3fc", pct: 20, blurb: "A stronger, more specific effect. Planned for a future update -- not in the pool yet." },
  { id: "elite", label: "Elite", color: "#facc15", pct: 10, blurb: "A build-defining mechanic with a real cost. Planned for a future update -- not in the pool yet." },
];

export function renderTutorial() {
  const controlsBody = el("tutorial-controls");
  clearChildren(controlsBody);
  for (const c of TUTORIAL_CONTROLS) {
    const row = document.createElement("div");
    row.className = "tutorial-row";
    const label = document.createElement("div");
    label.className = "tutorial-row-label";
    label.textContent = c.label;
    const keys = document.createElement("div");
    keys.className = "tutorial-row-keys";
    keys.textContent = c.keys;
    row.append(label, keys);
    controlsBody.appendChild(row);
  }

  const loopBody = el("tutorial-loop");
  clearChildren(loopBody);
  for (const line of TUTORIAL_LOOP) {
    const p = document.createElement("p");
    p.className = "tutorial-p";
    p.textContent = line;
    loopBody.appendChild(p);
  }

  const weaponGrid = el("tutorial-weapons");
  clearChildren(weaponGrid);
  for (const w of WEAPON_LIST) {
    weaponGrid.appendChild(
      makeCard({
        icon: w.icon,
        name: w.name,
        desc: w.desc(1),
        meta: w.evolution ? `Evolves into: ${w.evolution.name}` : "Max level, no evolution",
        accent: w.color,
      })
    );
  }

  const rarityBody = el("tutorial-rarity");
  clearChildren(rarityBody);
  for (const r of TUTORIAL_RARITY) {
    const row = document.createElement("div");
    row.className = "tutorial-rarity-row";
    row.style.borderColor = r.color;
    const head = document.createElement("div");
    head.className = "tutorial-rarity-head";
    head.style.color = r.color;
    head.textContent = `${r.label} -- target ${r.pct}% of draws`;
    const blurb = document.createElement("div");
    blurb.className = "tutorial-p";
    blurb.textContent = r.blurb;
    row.append(head, blurb);
    rarityBody.appendChild(row);
  }

  const enemyGrid = el("tutorial-enemies");
  clearChildren(enemyGrid);
  for (const enemy of ENEMY_LIST) {
    enemyGrid.appendChild(
      makeCard({
        icon: enemy.icon,
        name: enemy.name,
        desc: enemy.desc,
        accent: enemy.color,
        shape: { kind: "unit", shapeName: enemy.shape, color: enemy.color },
      })
    );
  }

  const allyGrid = el("tutorial-allies");
  clearChildren(allyGrid);
  for (const ally of ALLY_LIST) {
    allyGrid.appendChild(
      makeCard({
        icon: ally.icon,
        name: ally.name,
        desc: `${ally.desc} Unlock via: ${ally.unlockHint}.`,
        accent: ally.color,
        shape: { kind: "ally", shapeName: ally.id, color: ally.color },
      })
    );
  }
}

// ---------------- Planet Select (cinematic destination portal) ----------------
// Each of the 12 Survival difficulties is a celestial body (celestialBodies.js).
// A single fixed canvas paints a rounded-rectangle "portal" window that tilts
// toward the pointer via a fake-3D projection (engine/portal.js) and clips
// into that body's procedural scene, drawn screen-locked so the window reads
// as looking *through* a stationary destination rather than a textured card.
// Clicking a sidebar entry swaps which body is loaded (a quick close/reopen
// of the window); clicking the portal itself commits -- expands the window
// to fill the screen, then hands off to onDeploy(id).
let planetState = null; // lazily constructed on first renderPlanetSelect()

function buildPlanetState() {
  const canvas = el("planet-scene-canvas");
  const ctx = canvas.getContext("2d");
  const screenEl = el("screen-difficulty");
  const portalBtn = el("planet-portal");
  const cursorEl = el("planet-cursor");

  const state = {
    canvas,
    ctx,
    screenEl,
    portalBtn,
    cursorEl,
    currentId: null,
    rotX: 0,
    rotY: 0,
    targetX: 0,
    targetY: 0,
    maskScale: 1,
    expansion: 0,
    transitionActive: false,
    canvasOpacity: 1,
    busy: false,
    sceneStart: performance.now(),
    outgoingId: null,
    cursorX: -100,
    cursorY: -100,
    cursorTargetX: -100,
    cursorTargetY: -100,
    cursorSeen: false,
    rafId: null,
    onDeploy: null,
    lastFrame: performance.now(),
  };

  function resize() {
    const d = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * d);
    canvas.height = Math.floor(window.innerHeight * d);
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    ctx.setTransform(d, 0, 0, d, 0, 0);
  }
  window.addEventListener("resize", resize);
  resize();

  screenEl.addEventListener("pointermove", (e) => {
    const t = computeTiltTarget(e.clientX, e.clientY, window.innerWidth, window.innerHeight);
    state.targetX = t.targetX;
    state.targetY = t.targetY;
    state.cursorTargetX = e.clientX;
    state.cursorTargetY = e.clientY;
    if (!state.cursorSeen) {
      state.cursorSeen = true;
      cursorEl.classList.add("is-visible");
    }
  });
  screenEl.addEventListener("pointerleave", () => {
    state.targetX = 0;
    state.targetY = 0;
    state.cursorSeen = false;
    cursorEl.classList.remove("is-visible");
  });
  portalBtn.addEventListener("pointerenter", () => cursorEl.classList.add("is-enter"));
  portalBtn.addEventListener("pointerleave", () => cursorEl.classList.remove("is-enter"));
  portalBtn.addEventListener("click", () => travelToCurrent(state));

  function frame(now) {
    const dt = Math.min(40, now - state.lastFrame);
    state.lastFrame = now;
    state.rotX = approachTilt(state.rotX, state.targetX, dt);
    state.rotY = approachTilt(state.rotY, state.targetY, dt);
    state.cursorX += (state.cursorTargetX - state.cursorX) * 0.2;
    state.cursorY += (state.cursorTargetY - state.cursorY) * 0.2;
    cursorEl.style.transform = `translate3d(${state.cursorX}px, ${state.cursorY}px, 0)`;
    drawPlanetFrame(state, now);
    if (!screenEl.classList.contains("hidden")) state.rafId = requestAnimationFrame(frame);
    else state.rafId = null;
  }
  state.startLoop = () => {
    if (state.rafId == null) {
      state.lastFrame = performance.now();
      state.rafId = requestAnimationFrame(frame);
    }
  };

  return state;
}

function drawPlanetFrame(state, now) {
  const { ctx } = state;
  const w = window.innerWidth,
    h = window.innerHeight;
  ctx.clearRect(0, 0, w, h);

  const rect = state.portalBtn.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return;
  const rectCx = rect.left + rect.width / 2;
  const rectCy = rect.top + rect.height / 2;
  const e = state.expansion;
  const cx = rectCx + (w / 2 - rectCx) * e;
  const cy = rectCy + (h / 2 - rectCy) * e;
  const baseW = rect.width + (w - rect.width) * e;
  const baseH = rect.height + (h - rect.height) * e;
  const scale = e ? 1 : state.maskScale;
  const winW = baseW * scale,
    winH = baseH * scale;
  const r = 90 * (1 - e) * scale;
  const rX = state.rotX * (1 - e);
  const rY = state.rotY * (1 - e);
  if (winW <= 1 || winH <= 1) return;

  const path = pathFromPoints(buildMaskPoints(winW, winH, r, rX, rY, cx, cy));
  ctx.save();
  ctx.globalAlpha = state.canvasOpacity;
  ctx.clip(path);
  ctx.fillStyle = "#030303";
  ctx.fillRect(0, 0, w, h);
  const body = CELESTIAL_BODIES[state.transitionActive ? state.outgoingId : state.currentId] || CELESTIAL_BODIES[state.currentId];
  if (body) drawCelestialScene(ctx, body, w, h, (now - state.sceneStart) / 1000);
  if (state.transitionActive) drawShade(ctx, w, h);
  ctx.restore();
}

function retrigger(elm, className) {
  elm.classList.remove(className);
  void elm.offsetWidth;
  elm.classList.add(className);
}

function updatePlanetPanels(id) {
  const body = CELESTIAL_BODIES[id];
  if (!body) return;
  document.documentElement.style.setProperty("--planet-accent", body.glow);
  el("planet-number").textContent = `[${body.number}]`;
  el("planet-name").textContent = body.name;
  el("planet-portal").setAttribute("aria-label", `Deploy to ${body.name}`);
  el("planet-select-title").textContent = body.name.toUpperCase();

  const factsEl = el("planet-facts");
  clearChildren(factsEl);
  for (const [k, v] of celestialFacts(id)) {
    const row = document.createElement("div");
    row.className = "planet-fact";
    const dt = document.createElement("dt");
    dt.textContent = k;
    const dd = document.createElement("dd");
    dd.textContent = v;
    row.append(dt, dd);
    factsEl.appendChild(row);
  }

  const sidebar = el("planet-sidebar");
  clearChildren(sidebar);
  for (const diff of DIFFICULTY_LIST) {
    const planetBody = CELESTIAL_BODIES[diff.id];
    const item = document.createElement("button");
    item.type = "button";
    item.className = "planet-item" + (diff.id === id ? " active" : "");
    const num = document.createElement("span");
    num.className = "planet-item-number";
    num.textContent = planetBody.number;
    const name = document.createElement("span");
    name.textContent = planetBody.name;
    item.append(num, name);
    if (diff.id !== id) item.addEventListener("click", () => switchPlanet(id, diff.id));
    sidebar.appendChild(item);
  }
  retrigger(sidebar, "is-switching");
  retrigger(el("planet-portal-heading"), "is-visible");
  retrigger(el("planet-select-title"), "is-visible");
  retrigger(el("planet-facts"), "is-visible");
}

async function switchPlanet(fromId, toId) {
  if (!planetState || planetState.busy) return;
  planetState.busy = true;
  await animateValue((v) => (planetState.maskScale = 1 - v), 260);
  planetState.currentId = toId;
  updatePlanetPanels(toId);
  planetState.sceneStart = performance.now();
  await animateValue((v) => (planetState.maskScale = v), 520);
  planetState.busy = false;
}

async function travelToCurrent(state) {
  if (state.busy || !state.onDeploy) return;
  state.busy = true;
  state.targetX = 0;
  state.targetY = 0;
  state.screenEl.classList.add("is-transitioning");
  state.transitionActive = true;
  state.outgoingId = state.currentId;
  state.canvasOpacity = 1;
  const deployId = state.currentId;
  try {
    await animateValue((v) => (state.expansion = v), 1100);
  } finally {
    state.onDeploy(deployId);
  }
}

// Called every time the screen opens (Play -> Planet Select). `initialId`
// is which difficulty/body should be pre-loaded in the portal (whatever was
// picked last time, or "hard" on a fresh session); onDeploy(id) fires once
// the player commits by clicking the portal.
export function renderPlanetSelect(initialId, onDeploy) {
  if (!planetState) planetState = buildPlanetState();
  const s = planetState;
  s.onDeploy = onDeploy;
  s.busy = false;
  s.expansion = 0;
  s.maskScale = 1;
  s.transitionActive = false;
  s.canvasOpacity = 1;
  s.currentId = CELESTIAL_BODIES[initialId] ? initialId : "hard";
  s.rotX = s.rotY = s.targetX = s.targetY = 0;
  s.sceneStart = performance.now();
  s.screenEl.classList.remove("is-transitioning");
  updatePlanetPanels(s.currentId);
  s.startLoop();
}

export function setMenuBestLabel(meta) {
  const label = el("best-run-label");
  if (meta.totalRuns === 0) {
    label.textContent = "No runs yet";
  } else {
    label.textContent = `Best: ${formatTime(meta.bestSurvivalSeconds)} survived, ${meta.bestKills} kills`;
  }
}

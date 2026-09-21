import { CHARACTER_LIST, isCharacterUnlocked } from "../game/characters.js";
import { PASSIVES } from "../game/passives.js";
import { WEAPONS } from "../game/weapons.js";
import { META_UPGRADES, upgradeCost } from "../game/upgrades.js";
import { ACHIEVEMENTS } from "../game/achievements.js";
import { OVERFLOW_OPTIONS } from "../game/levelup-options.js";
import { formatTime } from "../engine/utils.js";

function resolveOptionDef(opt) {
  if (opt.kind === "weapon") return WEAPONS[opt.id];
  if (opt.kind === "overflow") return OVERFLOW_OPTIONS[opt.id];
  return PASSIVES[opt.id];
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

function makeCard({ icon, name, desc, meta, locked, onClick, accent }) {
  const card = document.createElement("div");
  card.className = "card" + (locked ? " locked" : "");
  if (accent) card.style.borderColor = accent;
  const iconEl = document.createElement("div");
  iconEl.className = "card-icon";
  iconEl.textContent = icon || "";
  if (accent) iconEl.style.color = accent;
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
    const desc = opt.isEvolution ? def.evolution.desc : opt.kind === "overflow" ? def.desc() : def.desc(nextLevel);
    const kindLabel = opt.isEvolution ? "EVOLUTION" : opt.kind === "weapon" ? "Weapon" : opt.kind === "overflow" ? "Overflow" : "Passive";
    const card = makeCard({
      icon: def.icon,
      name: opt.isEvolution ? `${def.name} → ${def.evolution.name}` : `${def.name}${opt.isNew ? " (New)" : ` Lv.${nextLevel}`}`,
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
    const desc = opt.isEvolution ? def.evolution.desc : opt.kind === "overflow" ? def.desc() : def.desc(opt.currentLevel + 1);
    const kindLabel = opt.isEvolution ? "EVOLUTION" : opt.kind === "weapon" ? "Weapon" : opt.kind === "overflow" ? "Overflow" : "Passive";
    const card = makeCard({
      icon: def.icon,
      name: opt.isEvolution ? `${def.name} → ${def.evolution.name}` : `${def.name}${opt.isNew ? " (New)" : ""}`,
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
export function renderWarSetup(onPick) {
  const grid = el("warsetup-body");
  clearChildren(grid);
  for (const count of [2, 3, 4]) {
    const card = makeCard({
      icon: "⚔",
      name: `${count} Empires`,
      desc: `Fight ${count} rival bosses and their troops at once. They'll fight each other too.`,
      meta: count === 4 ? "Maximum chaos" : count === 2 ? "Easier" : "Balanced",
      accent: "#f87171",
      onClick: () => onPick(count),
    });
    grid.appendChild(card);
  }
}

export function setMenuBestLabel(meta) {
  const label = el("best-run-label");
  if (meta.totalRuns === 0) {
    label.textContent = "No runs yet";
  } else {
    label.textContent = `Best: ${formatTime(meta.bestSurvivalSeconds)} survived, ${meta.bestKills} kills`;
  }
}

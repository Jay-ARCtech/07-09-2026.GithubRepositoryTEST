import { formatTime } from "../engine/utils.js";
import { WEAPONS } from "../game/weapons.js";
import { ALLY_TYPES } from "../game/allies.js";

const el = (id) => document.getElementById(id);

export function setHudVisible(visible) {
  el("hud").classList.toggle("hidden", !visible);
}

export function updateHud(world, player, meta) {
  el("hud-level").textContent = player.level;
  el("hud-hp-fill").style.transform = `scaleX(${Math.max(0, player.hp / player.maxHp)})`;
  el("hud-xp-fill").style.transform = `scaleX(${Math.min(1, player.xp / player.xpNext)})`;
  el("hud-timer").textContent = formatTime(world.time);
  el("hud-kills").textContent = `☠ ${world.kills}`;
  el("hud-cores").textContent = `◈ ${meta.cores + world.coresEarned}`;

  const vignette = el("vignette");
  vignette.classList.toggle("low-hp", player.hp / player.maxHp < 0.28);

  const bossWrap = el("boss-bar-wrap");
  const warList = el("war-boss-list");
  if (world.mode === "war") {
    bossWrap.classList.add("hidden");
    warList.classList.remove("hidden");
    renderWarBossList(world);
  } else {
    warList.classList.add("hidden");
    if (world.bossActive) {
      bossWrap.classList.remove("hidden");
      el("boss-name").textContent = world.bossActive.name;
      el("boss-bar-fill").style.transform = `scaleX(${Math.max(0, world.bossActive.hp / world.bossActive.maxHp)})`;
    } else {
      bossWrap.classList.add("hidden");
    }
  }

  renderWeaponTray(player);
  renderAllyTray(world, player);
}

const ALLY_KINDS = ["drone", "medic", "vanguard"];
function renderAllyTray(world, player) {
  const tray = el("ally-tray");
  const stats = player.stats || {};
  const slots = [];
  for (const kind of ALLY_KINDS) {
    const cap = Math.floor(stats[kind + "Max"] || 0);
    if (cap <= 0 && !(world.allyDeadCount?.[kind] > 0)) continue;
    for (const e of world.enemies) {
      if (e.active && e.isAlly && e.allyKind === kind) slots.push({ kind, entity: e });
    }
    const deadCount = world.allyDeadCount?.[kind] || 0;
    for (let i = 0; i < deadCount; i++) slots.push({ kind, entity: null });
  }
  if (tray.childElementCount !== slots.length) tray.innerHTML = "";
  slots.forEach((slot, i) => {
    let chip = tray.children[i];
    if (!chip) {
      chip = document.createElement("div");
      chip.className = "ally-chip";
      chip.innerHTML = `<div class="ally-icon"></div><div class="bar"><div class="bar-fill" style="background: linear-gradient(90deg, #4ade80, #22c55e);"></div></div><div class="ally-dead-mark">☠</div>`;
      tray.appendChild(chip);
    }
    const def = ALLY_TYPES[slot.kind];
    const alive = !!slot.entity;
    chip.classList.toggle("ally-dead", !alive);
    chip.title = alive ? def.name : `${def.name} (permanently lost -- revive to bring it back)`;
    chip.querySelector(".ally-icon").textContent = def.icon;
    if (alive) {
      chip.querySelector(".bar-fill").style.transform = `scaleX(${Math.max(0, slot.entity.hp / slot.entity.maxHp)})`;
    }
  });
}

function renderWarBossList(world) {
  const list = el("war-boss-list");
  const wanted = world.empires.length;
  if (list.childElementCount !== wanted) {
    list.innerHTML = "";
    for (let i = 0; i < wanted; i++) {
      const row = document.createElement("div");
      row.className = "war-boss-row";
      row.innerHTML = `<div class="war-boss-name"><span class="wb-label"></span><span class="wb-hp"></span></div><div class="bar"><div class="bar-fill wb-fill" style="background: linear-gradient(90deg, #f87171, #fb923c);"></div></div>`;
      list.appendChild(row);
    }
  }
  world.empires.forEach((emp, i) => {
    const row = list.children[i];
    if (!row) return;
    const boss = world.enemies.find((e) => e.id === emp.bossId);
    row.classList.toggle("eliminated", !emp.alive || !boss);
    row.querySelector(".wb-label").textContent = boss ? boss.name : `Empire ${i + 1}`;
    if (boss && emp.alive) {
      row.querySelector(".wb-hp").textContent = `${Math.max(0, Math.round(boss.hp))}/${Math.round(boss.maxHp)}`;
      row.querySelector(".wb-fill").style.transform = `scaleX(${Math.max(0, boss.hp / boss.maxHp)})`;
    } else {
      row.querySelector(".wb-hp").textContent = "";
      row.querySelector(".wb-fill").style.transform = "scaleX(0)";
    }
  });
}

function renderWeaponTray(player) {
  const tray = el("weapon-tray");
  const wanted = player.weapons.length;
  if (tray.childElementCount !== wanted) tray.innerHTML = "";
  player.weapons.forEach((w, i) => {
    const def = WEAPONS[w.id];
    let chip = tray.children[i];
    if (!chip) {
      chip = document.createElement("div");
      chip.className = "weapon-chip";
      tray.appendChild(chip);
    }
    chip.style.color = def.color;
    chip.classList.toggle("evolved", w.evolved);
    chip.title = w.evolved ? def.evolution.name : def.name;
    chip.textContent = def.icon;
    const lvlBadge = document.createElement("div");
    lvlBadge.className = "lvl";
    lvlBadge.textContent = w.evolved ? "E" : String(w.level);
    chip.appendChild(lvlBadge);
  });
}

let toastId = 0;
export function showToast(text, color = "#7dd3fc") {
  const container = el("toast-container");
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.style.borderColor = color;
  toast.textContent = text;
  toast.dataset.id = String(++toastId);
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
  while (container.childElementCount > 4) container.firstChild.remove();
}

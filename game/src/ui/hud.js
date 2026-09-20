import { formatTime } from "../engine/utils.js";
import { WEAPONS } from "../game/weapons.js";

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
  if (world.bossActive) {
    bossWrap.classList.remove("hidden");
    el("boss-name").textContent = world.bossActive.name;
    el("boss-bar-fill").style.transform = `scaleX(${Math.max(0, world.bossActive.hp / world.bossActive.maxHp)})`;
  } else {
    bossWrap.classList.add("hidden");
  }

  renderWeaponTray(player);
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

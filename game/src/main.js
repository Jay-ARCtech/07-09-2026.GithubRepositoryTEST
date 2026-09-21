import { clamp, angleTo, dist, TAU, SpatialGrid, easeOutCubic } from "./engine/utils.js";
import { Camera, setupCanvas, startLoop } from "./engine/core.js";
import { audio } from "./engine/audio.js";
import { ParticleSystem } from "./engine/particles.js";
import { input } from "./engine/input.js";
import { loadSave, writeSave, exportSaveString, importSaveString } from "./engine/save.js";
import { bus } from "./engine/bus.js";

import { createWorld, dailySeedToday, clampToArena } from "./game/world.js";
import {
  createPlayer,
  recomputeStats,
  gainXp,
  takeDamage,
  addOrLevelWeapon,
  addOrLevelPassive,
  checkEvolutions,
} from "./game/player.js";
import { WEAPONS } from "./game/weapons.js";
import { PASSIVES } from "./game/passives.js";
import { CHARACTERS, isCharacterUnlocked } from "./game/characters.js";
import { updateEnemy, spawnEnemy } from "./game/enemies.js";
import { updateBoss } from "./game/bosses.js";
import { updateDirector } from "./game/director.js";
import { updateAlly, updateAllySystem } from "./game/allies.js";
import { updateWarDirector, startWarMode } from "./game/warmode.js";
import { spawnXpGem, spawnGold, spawnHealth, spawnChest, spawnOverdrive, updatePickup } from "./game/pickups.js";
import { unlockAchievement } from "./game/achievements.js";
import { META_UPGRADES, upgradeCost, computeCoresEarned } from "./game/upgrades.js";
import { generateOptions } from "./game/levelup-options.js";
import { ASCENSION_TIERS, canAscend, ascend } from "./game/ascension.js";
import { PASSIVE_LIST } from "./game/passives.js";

import { setHudVisible, updateHud, showToast } from "./ui/hud.js";
import {
  initScreens,
  showScreen,
  hideAllScreens,
  renderCharSelect,
  renderLevelUp,
  renderChest,
  renderGameOver,
  renderSettings,
  renderArmory,
  renderAchievements,
  renderAscension,
  renderWarSetup,
  setMenuBestLabel,
} from "./ui/screens.js";

// ---------------------------------------------------------------- state
let meta = loadSave();
let world = null;
let player = null;
let charDef = null;
let gameState = "menu"; // menu | charselect | playing | paused | levelup | chest | gameover | settings | armory | achievements
let settingsReturnState = "menu";
let dailyMode = false;
let pendingChest = null;

const gameCanvas = document.getElementById("game-canvas");
const menuCanvas = document.getElementById("menu-canvas");
const ctx = setupCanvas(gameCanvas);
const menuCtx = setupCanvas(menuCanvas);
const camera = new Camera();
const particles = new ParticleSystem();
const enemyGrid = new SpatialGrid(90);
const contactGrid = new SpatialGrid(90);

audio.applySettings(meta.settings);
particles.setDensity(meta.settings.particleDensity);
camera.shakeEnabled = meta.settings.screenShake;

function todayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

let audioUnlocked = false;
function unlockAudioOnce() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  audio.unlock();
  audio.startMusic();
}
window.addEventListener("pointerdown", unlockAudioOnce, { once: true });
window.addEventListener("keydown", unlockAudioOnce, { once: true });

function onAchievementToast(def) {
  if (def) showToast(`\u{1F3C6} ${def.name}`, "#fbbf24");
}

// ---------------------------------------------------------------- flow
let pendingWarEmpireCount = null;

function goMenu() {
  gameState = "menu";
  pendingWarEmpireCount = null;
  setHudVisible(false);
  setMenuBestLabel(meta);
  showScreen("screen-menu");
}

function openCharSelect() {
  gameState = "charselect";
  renderCharSelect(meta, (id) => {
    if (pendingWarEmpireCount) {
      const empireCount = pendingWarEmpireCount;
      pendingWarEmpireCount = null;
      startRun(id, { war: true, empireCount });
    } else {
      startRun(id, { daily: false });
    }
  });
  showScreen("screen-charselect");
}

function openDaily() {
  const unlockedIds = Object.keys(CHARACTERS).filter((id) => isCharacterUnlocked(CHARACTERS[id], meta));
  const id = unlockedIds.includes("vanguard") ? "vanguard" : unlockedIds[0];
  startRun(id, { daily: true });
}

function openSettings(fromState) {
  settingsReturnState = fromState;
  renderSettings(meta.settings, {
    onVolume: (key, val) => {
      meta.settings[key] = val;
      audio.applySettings(meta.settings);
      writeSave(meta);
    },
    onToggle: (key, val) => {
      meta.settings[key] = val;
      if (key === "screenShake") camera.shakeEnabled = val;
      writeSave(meta);
    },
    onDensity: (val) => {
      meta.settings.particleDensity = val;
      particles.setDensity(val);
      writeSave(meta);
    },
    exportString: () => exportSaveString(meta),
    importString: (str) => {
      const imported = importSaveString(str);
      if (imported) {
        meta = imported;
        writeSave(meta);
        audio.applySettings(meta.settings);
        particles.setDensity(meta.settings.particleDensity);
        camera.shakeEnabled = meta.settings.screenShake;
        showToast("Save imported.", "#4ade80");
      } else {
        showToast("Invalid save string.", "#f87171");
      }
    },
  });
  gameState = "settings";
  showScreen("screen-settings");
}

function handleArmoryBuy(key) {
  if (key.startsWith("character:")) {
    const id = key.slice("character:".length);
    const def = CHARACTERS[id];
    if (def.unlock.type === "cores" && meta.cores >= def.unlock.amount) {
      meta.cores -= def.unlock.amount;
      meta.unlockedCharacters.push(id);
      writeSave(meta);
      showToast(`${def.name} unlocked!`, def.color);
      openArmory();
    }
    return;
  }
  const def = META_UPGRADES[key];
  const level = meta.upgrades[key] || 0;
  if (level >= def.max) return;
  const cost = upgradeCost(def, level);
  if (meta.cores < cost) return;
  meta.cores -= cost;
  meta.upgrades[key] = level + 1;
  writeSave(meta);
  openArmory();
}

function openArmory() {
  gameState = "armory";
  renderArmory(meta, handleArmoryBuy);
  showScreen("screen-armory");
}

function openAchievements() {
  gameState = "achievements";
  renderAchievements(meta);
  showScreen("screen-achievements");
}

function openAscension() {
  gameState = "ascension";
  renderAscension(meta, ASCENSION_TIERS);
  showScreen("screen-ascension");
}

function openWarSetup() {
  gameState = "warsetup";
  renderWarSetup((empireCount) => {
    pendingWarEmpireCount = empireCount;
    openCharSelect();
  });
  showScreen("screen-warsetup");
}

function startRun(charId, { daily = false, war = false, empireCount = 4 } = {}) {
  charDef = CHARACTERS[charId];
  dailyMode = daily;
  const seed = daily ? dailySeedToday() : null;
  world = createWorld(seed, war ? "war" : "survival");
  world._onEnemyDamaged = (e) => {
    particles.spawnBurst(e.x, e.y, "#ffffff", 3, { speed: 80, life: 0.2 });
  };
  world._spawnRing = (x, y, r) => particles.spawnRing(x, y, "#f87171", { size: r, life: 0.5 });
  world._onSupportPulse = (e, color) => particles.spawnRing(e.x, e.y, color, { size: 70, life: 0.4 });
  player = createPlayer(charDef, meta);
  if (meta.ascensionLevel >= 3) {
    const pick = PASSIVE_LIST[Math.floor(Math.random() * PASSIVE_LIST.length)];
    addOrLevelPassive(player, pick.id);
  }
  recomputeStats(player, meta, charDef);
  player.hp = player.maxHp;

  if (war) startWarMode(world, empireCount);

  gameState = "playing";
  setHudVisible(true);
  hideAllScreens();
  audio.startMusic();
  showToast(war ? `All-Out War: ${empireCount} empires` : daily ? "Daily Challenge started" : `Deployed as ${charDef.name}`, charDef.color);
}

function pauseGame() {
  if (gameState !== "playing") return;
  gameState = "paused";
  const overloadBtn = document.getElementById("btn-overload");
  if (overloadBtn) {
    overloadBtn.dataset.confirming = "";
    overloadBtn.textContent = "Overload Core (Ascend)";
  }
  showScreen("screen-pause");
}
function resumeGame() {
  if (gameState !== "paused") return;
  gameState = "playing";
  document.getElementById("screen-pause").classList.add("hidden");
}
function quitToMenu() {
  world = null;
  player = null;
  goMenu();
}

// ---------------------------------------------------------------- level up / chest
function offerLevelUp() {
  gameState = "levelup";
  const choiceCount = 4 + (meta.ascensionLevel >= 1 ? 1 : 0);
  const options = generateOptions(player, world.rng, choiceCount);
  world.rerollsLeft = world.rerollsLeft ?? 2 + (meta.ascensionLevel >= 2 ? 1 : 0);
  const show = () =>
    renderLevelUp(options, {
      level: player.level,
      rerollsLeft: world.rerollsLeft,
      onPick: (opt) => {
        applyOption(opt);
        gameState = "playing";
        document.getElementById("screen-levelup").classList.add("hidden");
      },
      onReroll: () => {
        if (world.rerollsLeft <= 0) return;
        world.rerollsLeft -= 1;
        const fresh = generateOptions(player, world.rng, choiceCount);
        options.length = 0;
        options.push(...fresh);
        show();
      },
    });
  show();
  audio.sfxLevelUp();
  camera.pulseZoom(0.12);
  showScreen("screen-levelup");
}

function applyOption(opt) {
  if (opt.kind === "overflow") {
    player.overflowLevels[opt.id] = (player.overflowLevels[opt.id] || 0) + 1;
    recomputeStats(player, meta, charDef);
    return;
  }
  if (opt.kind === "weapon") {
    const w = addOrLevelWeapon(player, opt.id);
    if (opt.isEvolution) {
      w.evolved = true;
      showToast(`Evolved: ${WEAPONS[opt.id].evolution.name}!`, WEAPONS[opt.id].color);
    }
  } else {
    addOrLevelPassive(player, opt.id);
  }
  recomputeStats(player, meta, charDef);
  const evolved = checkEvolutions(player);
  for (const w of evolved) {
    showToast(`Evolved: ${WEAPONS[w.id].evolution.name}!`, WEAPONS[w.id].color);
    unlockAchievement(meta, "evolved", onAchievementToast);
  }
  writeSave(meta);
}

function openChest(chestEntity) {
  pendingChest = chestEntity;
  gameState = "chest";
  const options = generateOptions(player, world.rng, 3);
  renderChest(options, (opt) => {
    applyOption(opt);
    meta.chestsOpened = (meta.chestsOpened || 0) + 1;
    if (meta.chestsOpened >= 10) unlockAchievement(meta, "chest_hoarder", onAchievementToast);
    writeSave(meta);
    gameState = "playing";
    document.getElementById("screen-chest").classList.add("hidden");
    pendingChest.active = false;
    pendingChest = null;
  });
  audio.sfxChest();
  showScreen("screen-chest");
}

// ---------------------------------------------------------------- combat helpers
function applyBulletDamage(e, b) {
  e.hp -= b.dmg;
  e.hitFlash = 0.1;
  audio.sfxHit();
  particles.spawnBurst(e.x, e.y, b.color, 4, { speed: 120, life: 0.25 });
  if (meta.settings.damageNumbers) {
    particles.spawnText(e.x, e.y - 12, Math.round(b.dmg) + (b.crit ? "!" : ""), b.crit ? "#fbbf24" : "#e5e7eb", {
      size: b.crit ? 18 : 13,
    });
  }
}

function handlePlayerHit(amount) {
  const dealt = takeDamage(player, amount);
  if (dealt <= 0) return;
  camera.kick(7, 0.16);
  particles.spawnBurst(player.x, player.y, "#f87171", 10, { speed: 160 });
  audio.sfxHurt();
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const gp of pads) if (gp) input.vibrate(gp, 0.3, 0.6, 140);
  if (player.hp <= 0) endRun(false);
}

const ALLY_LABELS = { drone: "Combat Drone", medic: "Field Medic", vanguard: "Vanguard" };
function killAlly(e) {
  e.active = false;
  particles.spawnBurst(e.x, e.y, e.color, 14, { speed: 160 });
  audio.sfxHit();
  showToast(`${ALLY_LABELS[e.allyKind] || "Ally"} lost!`, "#f87171");
}

function killEnemy(e) {
  if (e.isAlly) {
    killAlly(e);
    return;
  }
  e.active = false;
  world.kills += 1;
  audio.sfxEnemyDeath();
  particles.spawnBurst(e.x, e.y, e.color, e.isBoss ? 40 : e.elite ? 20 : 10, { speed: e.isBoss ? 260 : 200 });
  camera.kick(e.isBoss ? 12 : e.elite ? 4 : 1.5, e.isBoss ? 0.3 : 0.08);

  spawnXpGem(world, e.x, e.y, e.xpValue);
  if (world.rng.chance(0.06 + player.stats.luck * 0.1)) {
    spawnGold(world, e.x, e.y, 5 + Math.round(world.rng.range(0, 10)));
  }
  if (e.elite && world.rng.chance(0.5)) spawnHealth(world, e.x, e.y, 15);

  if (e.splits && !e.noSplit) {
    for (let i = 0; i < 2; i++) {
      const ang = world.rng.range(0, TAU);
      spawnEnemy(world, "runner", e.x + Math.cos(ang) * 20, e.y + Math.sin(ang) * 20, e.faction);
      const child = world.enemies[world.enemies.length - 1];
      child.hp = child.maxHp = Math.max(3, e.maxHp * 0.35);
      child.dmg = e.dmg * 0.6;
      child.noSplit = true;
      child.xpValue = Math.round(e.xpValue * 0.4);
    }
  }

  if (e.isBoss) {
    world.bossesKilled += 1;
    world.bossActive = null;
    showToast(`${e.name} defeated!`, "#4ade80");
    spawnChest(world, e.x, e.y);
    unlockAchievement(meta, "boss_slayer", onAchievementToast);
    if (world.bossesKilled >= 3) unlockAchievement(meta, "triple_boss", onAchievementToast);
    if (player.damageTakenThisBossFight === 0) unlockAchievement(meta, "no_hit_boss", onAchievementToast);
    if (world.bossesKilled >= world.totalBossesForVictory) world.victoryPending = true;
    camera.pulseZoom(0.22);
  }
  if (world.kills === 1) unlockAchievement(meta, "first_blood", onAchievementToast);
}

bus.on("bossSpawned", (boss) => {
  showToast(`⚠ ${boss.name} approaches!`, "#f87171");
  player.damageTakenThisBossFight = 0;
});
bus.on("bossSlam", ({ x, y, dmg }) => {
  // the boss module already confirmed the player was standing in the
  // telegraphed radius before emitting this event
  handlePlayerHit(dmg);
  camera.kick(16, 0.32);
  particles.spawnBurst(x, y, "#f87171", 30, { speed: 260 });
});
bus.on("bossSummon", ({ x, y, faction }) => {
  for (let i = 0; i < 3; i++) {
    const ang = world.rng.range(0, TAU);
    spawnEnemy(world, "grunt", x + Math.cos(ang) * 60, y + Math.sin(ang) * 60, faction || "horde");
  }
  showToast("Reinforcements summoned!", "#4ade80");
});

// ---------------------------------------------------------------- end of run
function endRun(victory, opts = {}) {
  if (world.ended) return;
  world.ended = true;
  world.victory = victory;
  audio.setIntensity(0);

  const coresEarned = computeCoresEarned(world);
  world.coresEarned = coresEarned;
  meta.cores += coresEarned;
  meta.totalCoresEverEarned = (meta.totalCoresEverEarned || 0) + coresEarned;
  meta.totalRuns += 1;

  const newBestTime = world.time > meta.bestSurvivalSeconds;
  if (newBestTime) meta.bestSurvivalSeconds = world.time;
  const newBestKills = world.kills > meta.bestKills;
  if (newBestKills) meta.bestKills = world.kills;

  if (world.time >= 300) unlockAchievement(meta, "survivor_5", onAchievementToast);
  if (world.time >= 900) unlockAchievement(meta, "survivor_15", onAchievementToast);
  if (meta.totalCoresEverEarned >= 1000) unlockAchievement(meta, "cores_1000", onAchievementToast);
  if (dailyMode && victory) unlockAchievement(meta, "daily_win", onAchievementToast);

  if (dailyMode) {
    const key = todayKey();
    const prev = meta.dailyBest[key];
    if (!prev || world.time > prev.seconds) {
      meta.dailyBest[key] = { seconds: world.time, kills: world.kills };
    }
  }

  writeSave(meta);
  renderGameOver({
    victory,
    world,
    coresEarned,
    newBestTime,
    newBestKills,
    player,
    selfDestruct: opts.selfDestruct,
    ascendedTier: opts.ascendedTier,
  });
  gameState = "gameover";
  setHudVisible(false);
  showScreen("screen-gameover");
}

function selfDestruct() {
  if (gameState !== "playing" && gameState !== "paused") return;
  const tier = canAscend(meta, player.level) ? ascend(meta, player.level) : null;
  if (tier) showToast(`Ascended! Tier ${tier.tier}: ${tier.name}`, "#c084fc");
  else showToast("Ascension requirement not met -- try a deeper run.", "#f87171");
  writeSave(meta);
  endRun(false, { selfDestruct: true, ascendedTier: tier });
}

// ---------------------------------------------------------------- main update
function updatePlayerMovement(dt) {
  const mv = input.getMoveVector();
  let speed = player.stats.moveSpeed * (player.hazardSlow ?? 1);
  if (world.time < world.overdriveUntil) speed *= 1.3;

  player.dashCd = Math.max(0, player.dashCd - dt);
  if (player.dashing > 0) {
    player.dashing -= dt;
    speed *= 2.6;
    if (world.rng.chance(0.6)) particles.spawnBurst(player.x, player.y, player.color, 1, { speed: 20, life: 0.3 });
  } else if (input.actions.dash && player.dashCd <= 0 && (mv.x || mv.y)) {
    player.dashing = 0.16;
    player.dashCd = 2.4;
    player.invuln = Math.max(player.invuln, 0.22);
    audio.sfxUiClick();
  }

  if (mv.x || mv.y) player.facingAngle = Math.atan2(mv.y, mv.x);
  player.x += mv.x * speed * dt;
  player.y += mv.y * speed * dt;
  const clamped = clampToArena(world, player.x, player.y, player.radius);
  player.x = clamped.x;
  player.y = clamped.y;

  player.invuln = Math.max(0, player.invuln - dt);
  player.hitFlash = Math.max(0, player.hitFlash - dt);
  let dmgMult = 1;
  if (world.time < world.overdriveUntil) dmgMult = meta.ascensionLevel >= 9 ? 1.6 : 1.5;
  player.stats.runtimeDamageMult = dmgMult;
  player.hp = Math.min(player.maxHp, player.hp + player.stats.regen * dt);
}

function updateWeapons(dt) {
  for (const w of player.weapons) {
    const def = WEAPONS[w.id];
    const effectiveStats = { ...player.stats, damageMult: player.stats.damageMult * (player.stats.runtimeDamageMult || 1) };
    def.update({ world, player, ws: w, dt, stats: effectiveStats, rng: world.rng });
  }
}

// Every combat unit's own AI/movement runs first; contact damage is then
// resolved in a second pass over fresh post-movement positions, faction by
// faction, so the same code handles horde-vs-player, horde-vs-ally, and (in
// War Mode) empire-vs-empire contact instead of a player-only special case.
function updateEnemiesAndContact(dt) {
  for (const e of world.enemies) {
    if (!e.active) continue;
    if (e.isBoss) updateBoss(e, world, dt, player);
    else if (e.isAlly) updateAlly(e, world, dt, player);
    else updateEnemy(e, world, dt, player);
  }

  contactGrid.clear();
  for (const e of world.enemies) if (e.active) contactGrid.insert(e);

  for (const e of world.enemies) {
    if (!e.active) continue;
    if (e.contactCooldown > 0) {
      e.contactCooldown -= dt;
      continue;
    }
    if (!(e.dmg > 0)) continue;

    if (e.faction !== player.faction) {
      const dp = dist(e.x, e.y, player.x, player.y);
      if (dp < e.radius + player.radius) {
        e.contactCooldown = 0.5;
        handlePlayerHit(e.dmg);
        continue;
      }
    }

    const nearby = contactGrid.queryCircle(e.x, e.y, e.radius + 40);
    for (const o of nearby) {
      if (o === e || !o.active || o.faction === e.faction) continue;
      const dd = dist(e.x, e.y, o.x, o.y);
      if (dd < e.radius + o.radius) {
        e.contactCooldown = 0.5;
        o.hp -= e.dmg;
        o.hitFlash = 0.12;
        particles.spawnBurst(o.x, o.y, e.color, 3, { speed: 100, life: 0.2 });
        break;
      }
    }
  }
}

// Collision resolves purely by faction comparison (b.sourceFaction vs the
// candidate's .faction) rather than a hardcoded "player bullets hit
// world.enemies, enemy bullets hit the player" split. That's what lets
// ally-fired shots, horde shots, and War Mode's empire-vs-empire shots all
// go through one path instead of three near-duplicate ones.
function updateBullets(dt) {
  enemyGrid.clear();
  for (const e of world.enemies) if (e.active) enemyGrid.insert(e);

  for (const b of world.bullets) {
    if (!b.active) continue;

    if (b.homing) {
      let nearest = null,
        bestD = Infinity;
      for (const e of world.enemies) {
        if (!e.active || e.faction === b.sourceFaction) continue;
        const d = (e.x - b.x) ** 2 + (e.y - b.y) ** 2;
        if (d < bestD) {
          bestD = d;
          nearest = e;
        }
      }
      if (nearest) {
        const desired = angleTo(b.x, b.y, nearest.x, nearest.y);
        const cur = Math.atan2(b.vy, b.vx);
        let diff = Math.atan2(Math.sin(desired - cur), Math.cos(desired - cur));
        const maxTurn = b.turnRate * dt;
        const newAng = cur + clamp(diff, -maxTurn, maxTurn);
        const speed = Math.hypot(b.vx, b.vy);
        b.vx = Math.cos(newAng) * speed;
        b.vy = Math.sin(newAng) * speed;
      }
    }

    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0 || Math.hypot(b.x, b.y) > world.arenaRadius + 400) {
      b.active = false;
      continue;
    }

    if (player.faction !== b.sourceFaction && player.invuln <= 0 && dist(b.x, b.y, player.x, player.y) < b.radius + player.radius) {
      handlePlayerHit(b.dmg);
      b.active = false;
      continue;
    }

    const candidates = enemyGrid.queryCircle(b.x, b.y, b.radius + 40);
    for (const e of candidates) {
      if (!e.active || e.faction === b.sourceFaction || b._hitSet.has(e.id)) continue;
      const rr = b.radius + e.radius;
      if ((b.x - e.x) ** 2 + (b.y - e.y) ** 2 > rr * rr) continue;

      applyBulletDamage(e, b);
      b._hitSet.add(e.id);

      if (b.aoeRadius > 0) {
        const aoeCandidates = enemyGrid.queryCircle(b.x, b.y, b.aoeRadius + 40);
        for (const e2 of aoeCandidates) {
          if (!e2.active || e2 === e || e2.faction === b.sourceFaction) continue;
          if ((b.x - e2.x) ** 2 + (b.y - e2.y) ** 2 <= b.aoeRadius * b.aoeRadius) {
            applyBulletDamage(e2, { ...b, dmg: b.dmg * 0.7, crit: false });
          }
        }
        if (player.faction !== b.sourceFaction && player.invuln <= 0 && dist(b.x, b.y, player.x, player.y) <= b.aoeRadius) {
          handlePlayerHit(b.dmg * 0.7);
        }
        particles.spawnRing(b.x, b.y, "#fb923c", { size: b.aoeRadius, life: 0.35 });
        camera.kick(5, 0.12);
        audio.sfxExplosion();
        b.active = false;
        break;
      }
      if (b.pierce > 0) {
        b.pierce -= 1;
      } else {
        b.active = false;
        break;
      }
    }
  }
}

function updatePickups(dt) {
  for (const p of world.pickups) {
    if (!p.active) continue;
    updatePickup(p, world, dt, player, player.stats.pickupRadius);
    const d = dist(p.x, p.y, player.x, player.y);
    if (d > player.radius + p.radius + 6) continue;

    if (p.kind === "xp") {
      gainXp(player, p.value, offerLevelUp);
      audio.sfxPickup();
    } else if (p.kind === "gold") {
      world.coresEarned += p.value;
      audio.sfxPickup();
      particles.spawnText(p.x, p.y - 10, `+${p.value}`, "#fbbf24", { size: 13 });
    } else if (p.kind === "health") {
      player.hp = Math.min(player.maxHp, player.hp + p.value);
      audio.sfxPickup();
      particles.spawnBurst(p.x, p.y, "#4ade80", 8, { speed: 100 });
    } else if (p.kind === "chest") {
      openChest(p);
      break; // game is now paused on the chest screen; nothing else to process this frame
    } else if (p.kind === "overdrive") {
      world.overdriveUntil = world.time + 8 + (meta.ascensionLevel >= 9 ? 5 : 0);
      showToast("OVERDRIVE!", "#f97316");
      camera.pulseZoom(0.15);
      audio.sfxLevelUp();
    }
    p.active = false;
  }
  world.pickups = world.pickups.filter((p) => p.active);
}

function updateHazards(dt) {
  let inHazard = false;
  for (const h of world.hazards) {
    if (!h.active) continue;
    if (world.time >= h.expiresAt) {
      h.active = false;
      continue;
    }
    if (dist(player.x, player.y, h.x, h.y) < h.radius + player.radius) {
      inHazard = true;
      player.hp = Math.max(0, player.hp - h.dps * dt);
      player.hazardSlow = h.slowMult;
      if (world.rng.chance(0.15)) particles.spawnBurst(player.x, player.y, h.color, 1, { speed: 40, life: 0.2 });
    }
  }
  if (!inHazard) player.hazardSlow = 1;
  world.hazards = world.hazards.filter((h) => h.active);
}

function updateGame(dt) {
  if (world.ended) return;
  if (world.mode === "war") updateWarDirector(world, dt, player);
  else updateDirector(world, dt, player);
  updatePlayerMovement(dt);
  updateHazards(dt);
  updateWeapons(dt);
  updateAllySystem(world, dt, player);
  updateEnemiesAndContact(dt);
  updateBullets(dt);

  for (const e of world.enemies) if (e.active && e.hp <= 0) killEnemy(e);
  world.enemies = world.enemies.filter((e) => e.active);

  updatePickups(dt);
  particles.update(dt);

  if (player.hp <= 0) {
    endRun(false);
  } else if (world.victoryPending) {
    world.victoryPending = false;
    endRun(true);
  }

  let intensity = world.bossActive ? 0.95 : Math.min(0.7, 0.15 + world.time / 700);
  if (player.hp / player.maxHp < 0.3) intensity = Math.max(intensity, 0.75);
  audio.setIntensity(intensity);
}

// ---------------------------------------------------------------- render
function drawEntityGlow(c, x, y, radius, color, alpha = 1) {
  c.globalAlpha = alpha;
  c.fillStyle = color;
  c.beginPath();
  c.arc(x, y, radius, 0, TAU);
  c.fill();
  c.globalAlpha = 1;
}

function renderWorld() {
  const w = window.innerWidth,
    h = window.innerHeight;
  ctx.fillStyle = "#060a12";
  ctx.fillRect(0, 0, w, h);
  if (!world || !player) return;

  const shake = camera.getShakeOffset();
  ctx.save();
  ctx.translate(w / 2 + shake.x, h / 2 + shake.y);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-player.x, -player.y);

  // arena boundary + soft grid for spatial readability
  ctx.strokeStyle = "rgba(125,211,252,0.25)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, world.arenaRadius, 0, TAU);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;
  const gridSize = 120;
  const viewR = 900 / camera.zoom;
  const startX = Math.floor((player.x - viewR) / gridSize) * gridSize;
  const startY = Math.floor((player.y - viewR) / gridSize) * gridSize;
  for (let x = startX; x < player.x + viewR; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, player.y - viewR);
    ctx.lineTo(x, player.y + viewR);
    ctx.stroke();
  }
  for (let y = startY; y < player.y + viewR; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(player.x - viewR, y);
    ctx.lineTo(player.x + viewR, y);
    ctx.stroke();
  }

  // hazards (drawn under everything else -- environmental danger zones)
  for (const h of world.hazards) {
    if (!h.active) continue;
    const remain = clamp((h.expiresAt - world.time) / (h.expiresAt - h.createdAt || 1), 0, 1);
    const pulse = 0.55 + 0.25 * Math.sin(world.time * 6);
    ctx.save();
    ctx.globalAlpha = 0.22 + 0.15 * pulse;
    ctx.fillStyle = h.color;
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.radius, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = h.color;
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 6]);
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.radius * (0.85 + 0.05 * remain), 0, TAU * remain);
    ctx.stroke();
    ctx.restore();
  }

  // pickups
  for (const p of world.pickups) {
    if (!p.active) continue;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.kind === "chest") {
      ctx.fillStyle = "#fbbf24";
      ctx.shadowColor = "#fbbf24";
      ctx.shadowBlur = 14;
      ctx.fillRect(-p.radius, -p.radius, p.radius * 2, p.radius * 2);
    } else if (p.kind === "health") {
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.radius, -3, p.radius * 2, 6);
      ctx.fillRect(-3, -p.radius, 6, p.radius * 2);
    } else if (p.kind === "overdrive") {
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 16;
      ctx.rotate(world.time * 3);
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (TAU / 5) * i - Math.PI / 2;
        const r = i % 2 === 0 ? p.radius * 1.6 : p.radius * 0.6;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = p.color;
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-p.radius, -p.radius, p.radius * 2, p.radius * 2);
    }
    ctx.restore();
  }
  ctx.shadowBlur = 0;

  // enemies + allies (share one array/loop; isAlly flag picks styling)
  for (const e of world.enemies) {
    if (!e.active) continue;
    const flashT = clamp(e.hitFlash / 0.1, 0, 1);
    const color = flashT > 0 ? mixWhite(e.color, flashT) : e.color;
    ctx.save();
    ctx.translate(e.x, e.y);
    if (e.elite || e.isBoss) {
      ctx.shadowColor = e.color;
      ctx.shadowBlur = e.isBoss ? 26 : 14;
    }
    if (e.isAlly) {
      ctx.strokeStyle = "rgba(125,211,252,0.85)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius + 4, 0, TAU);
      ctx.stroke();
    }
    drawEntityGlow(ctx, 0, 0, e.radius, color);
    ctx.shadowBlur = 0;
    if (e.isBoss) {
      ctx.fillStyle = "#0b1220";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(e.name, 0, -e.radius - 10);
    }
    ctx.restore();

    if (e.telegraph?.kind === "slam") {
      const t = clamp(e.telegraph.t / 0.9, 0, 1);
      ctx.save();
      ctx.strokeStyle = `rgba(248,113,113,${0.9 - t * 0.5})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(e.telegraph.x, e.telegraph.y, e.telegraph.radius * (1 - t * 0.15), 0, TAU);
      ctx.stroke();
      ctx.restore();
    } else if (e.telegraph?.kind === "snipe") {
      ctx.save();
      ctx.strokeStyle = `rgba(250,204,21,${0.35 + 0.4 * (1 - e.telegraph.t / 1.1)})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.telegraph.x, e.telegraph.y);
      ctx.stroke();
      ctx.restore();
    }
  }

  // weapon visuals
  for (const w of player.weapons) {
    if (w.id === "orbiter" && w._blades) {
      const { count, radius, angle, evolved } = w._blades;
      for (let i = 0; i < count; i++) {
        const a = angle + (TAU / count) * i;
        ctx.save();
        ctx.translate(player.x + Math.cos(a) * radius, player.y + Math.sin(a) * radius);
        ctx.rotate(a);
        ctx.fillStyle = evolved ? "#fb923c" : "#facc15";
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 10;
        const size = evolved ? 18 : 12;
        ctx.beginPath();
        ctx.moveTo(size, 0);
        ctx.lineTo(-size * 0.4, size * 0.5);
        ctx.lineTo(-size * 0.4, -size * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
    if (w.id === "nova" && w._pulse) {
      const age = world.time - w._pulse.born;
      if (age < 0.4) {
        const t = age / 0.4;
        ctx.save();
        ctx.strokeStyle = `rgba(52,211,153,${1 - t})`;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(player.x, player.y, w._pulse.radius * easeOutCubic(t), 0, TAU);
        ctx.stroke();
        ctx.restore();
      }
    }
    if (w.id === "lightning" && w._bolt) {
      const age = world.time - w._bolt.born;
      if (age < 0.15) {
        ctx.save();
        ctx.globalAlpha = 1 - age / 0.15;
        ctx.strokeStyle = "#e879f9";
        ctx.lineWidth = 3;
        ctx.shadowColor = "#e879f9";
        ctx.shadowBlur = 12;
        ctx.beginPath();
        const path = w._bolt.path;
        ctx.moveTo(path[0].x, path[0].y);
        for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
        ctx.stroke();
        ctx.restore();
      }
    }
    if (w.id === "drone" && w._drones) {
      const { count, radius, angle } = w._drones;
      for (let i = 0; i < count; i++) {
        const a = angle + (TAU / count) * i;
        const dx = player.x + Math.cos(a) * radius;
        const dy = player.y + Math.sin(a) * radius;
        ctx.save();
        ctx.translate(dx, dy);
        ctx.fillStyle = "#a78bfa";
        ctx.shadowColor = "#a78bfa";
        ctx.shadowBlur = 8;
        ctx.rotate(a);
        ctx.fillRect(-6, -6, 12, 12);
        ctx.restore();
      }
    }
  }

  // player
  ctx.save();
  ctx.translate(player.x, player.y);
  const invulnFlicker = player.invuln > 0 && Math.floor(world.time * 20) % 2 === 0 ? 0.4 : 1;
  ctx.globalAlpha = invulnFlicker;
  ctx.shadowColor = charDef.color;
  ctx.shadowBlur = 18;
  drawEntityGlow(ctx, 0, 0, player.radius, player.hitFlash > 0 ? "#ffffff" : charDef.color);
  ctx.shadowBlur = 0;
  ctx.rotate(player.facingAngle || 0);
  ctx.fillStyle = "#0b1220";
  ctx.beginPath();
  ctx.moveTo(player.radius * 0.95, 0);
  ctx.lineTo(-player.radius * 0.45, player.radius * 0.62);
  ctx.lineTo(-player.radius * 0.15, 0);
  ctx.lineTo(-player.radius * 0.45, -player.radius * 0.62);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();

  // bullets
  for (const b of world.bullets) {
    if (!b.active) continue;
    ctx.save();
    ctx.fillStyle = b.color;
    ctx.shadowColor = b.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  ctx.shadowBlur = 0;

  particles.render(ctx);

  ctx.restore();
}

function mixWhite(hex, t) {
  const c = parseInt(hex.slice(1), 16);
  const r = (c >> 16) & 255,
    g = (c >> 8) & 255,
    b = c & 255;
  const mr = Math.round(r + (255 - r) * t);
  const mg = Math.round(g + (255 - g) * t);
  const mb = Math.round(b + (255 - b) * t);
  return `rgb(${mr},${mg},${mb})`;
}

// ---------------------------------------------------------------- menu bg
const stars = Array.from({ length: 140 }, () => ({
  x: Math.random(),
  y: Math.random(),
  z: 0.3 + Math.random() * 0.7,
  tw: Math.random() * TAU,
}));
function renderMenuBg(t) {
  const w = window.innerWidth,
    h = window.innerHeight;
  menuCtx.fillStyle = "#070c16";
  menuCtx.fillRect(0, 0, w, h);
  const grad = menuCtx.createRadialGradient(w * 0.5, h * 0.35, 0, w * 0.5, h * 0.35, Math.max(w, h) * 0.7);
  grad.addColorStop(0, "rgba(125,211,252,0.10)");
  grad.addColorStop(1, "rgba(7,12,22,0)");
  menuCtx.fillStyle = grad;
  menuCtx.fillRect(0, 0, w, h);
  for (const s of stars) {
    const x = s.x * w;
    const y = ((s.y + t * 0.02 * s.z) % 1) * h;
    const alpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.5 + s.tw));
    menuCtx.fillStyle = `rgba(200,220,255,${alpha * s.z})`;
    menuCtx.fillRect(x, y, 1.6 * s.z, 1.6 * s.z);
  }
}

// ---------------------------------------------------------------- loop
startLoop((dt, now) => {
  camera.update(dt);
  if (gameState === "playing") {
    if (input.actions.pause) pauseGame();
    updateGame(dt);
  } else if (gameState === "paused" && input.actions.pause) {
    resumeGame();
  }

  renderWorld();
  renderMenuBg(now / 1000);

  if (world && player && (gameState === "playing" || gameState === "paused" || gameState === "levelup" || gameState === "chest")) {
    updateHud(world, player, meta);
  }
  input.consumeFrame();

  if (window.__NOVA_DEBUG__) {
    const typeTally = {};
    let allyCount = 0;
    for (const e of world?.enemies || []) {
      if (!e.active) continue;
      if (e.isAlly) allyCount++;
      else typeTally[e.type] = (typeTally[e.type] || 0) + 1;
    }
    window.__NOVA_DEBUG__ = {
      gameState,
      mode: world?.mode,
      time: world?.time,
      enemyCount: world?.enemies?.length,
      enemyTypes: typeTally,
      allyCount,
      hazardCount: world?.hazards?.filter((h) => h.active).length,
      bulletActive: world?.bullets?.filter((b) => b.active).length,
      kills: world?.kills,
      playerHp: player?.hp,
      playerPos: player ? { x: player.x, y: player.y } : null,
      weapons: player?.weapons?.map((w) => ({ id: w.id, level: w.level, extra: !!w._blades })),
      ascensionLevel: meta.ascensionLevel,
      empires: world?.empires?.map((emp) => ({ id: emp.id, alive: emp.alive })),
    };
  }
});

// ---------------------------------------------------------------- screen wiring
initScreens({
  onAnyClick: () => audio.sfxUiClick(),
  play: openCharSelect,
  daily: openDaily,
  armory: openArmory,
  achievements: openAchievements,
  ascension: openAscension,
  warmode: openWarSetup,
  settings: () => openSettings(gameState),
  "back-to-menu": goMenu,
  back: () => {
    if (settingsReturnState === "paused") {
      gameState = "paused";
      showScreen("screen-pause");
    } else {
      goMenu();
    }
  },
  resume: resumeGame,
  "quit-to-menu": quitToMenu,
  retry: () => startRun(charDef.id, { daily: dailyMode }),
  quit: () => window.electronAPI?.quit(),
  overload: (btn) => {
    if (btn.dataset.confirming === "1") {
      selfDestruct();
    } else {
      btn.dataset.confirming = "1";
      btn.textContent = "Confirm? This ends the run.";
    }
  },
});

document.getElementById("btn-pause").addEventListener("click", pauseGame);
if (window.electronAPI?.isElectron) {
  document.getElementById("btn-quit").classList.remove("hidden");
}

goMenu();

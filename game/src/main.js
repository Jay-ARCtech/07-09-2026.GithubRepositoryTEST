import { clamp, angleTo, dist, TAU, SpatialGrid, easeOutCubic, hexToRgba } from "./engine/utils.js";
import { Camera, setupCanvas, startLoop } from "./engine/core.js";
import { audio } from "./engine/audio.js";
import { ParticleSystem } from "./engine/particles.js";
import { input } from "./engine/input.js";
import { loadSave, writeSave, exportSaveString, importSaveString } from "./engine/save.js";
import { bus } from "./engine/bus.js";

import { createWorld, dailySeedToday, clampToArena, isHostileFaction } from "./game/world.js";
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
import { updateEnemy, spawnEnemy, ENEMY_TYPES } from "./game/enemies.js";
import { updateBoss, BOSS_TYPES } from "./game/bosses.js";
import { updateDirector } from "./game/director.js";
import { updateAlly, updateAllySystem } from "./game/allies.js";
import { updateWarDirector, startWarMode } from "./game/warmode.js";
import {
  buildArenaScenery,
  drawArenaGround,
  drawArenaAmbience,
  drawGroundCraters,
  drawUnitShape,
  drawBossShape,
  drawAllyShape,
  drawBulletTracer,
  drawCitySkyline,
  resolveArenaObstacles,
} from "./engine/scenery.js";
import { spawnXpGem, spawnGold, spawnHealth, spawnChest, spawnOverdrive, updatePickup } from "./game/pickups.js";
import { unlockAchievement } from "./game/achievements.js";
import { META_UPGRADES, ALLY_META_UPGRADES, upgradeCost, computeCoresEarned } from "./game/upgrades.js";
import { generateOptions } from "./game/levelup-options.js";
import { ASCENSION_TIERS, canAscend, ascend } from "./game/ascension.js";
import { PASSIVE_LIST } from "./game/passives.js";
import { getDifficulty } from "./game/difficulty.js";
import { getArenaPalette, getCelestialBody, DEFAULT_ARENA_PALETTE } from "./game/celestialBodies.js";

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
  renderCodex,
  renderPlanetSelect,
  renderTutorial,
  setMenuBestLabel,
} from "./ui/screens.js";

// ---------------------------------------------------------------- state
let meta = loadSave();
let world = null;
let player = null;
let charDef = null;
let scenery = null;
let gameState = "menu"; // menu | tutorial | charselect | playing | paused | levelup | chest | gameover | settings | armory | achievements
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
let pendingDifficultyId = "hard";

function goMenu() {
  gameState = "menu";
  pendingWarEmpireCount = null;
  setHudVisible(false);
  setMenuBestLabel(meta);
  showScreen("screen-menu");
}

function openTutorial() {
  gameState = "tutorial";
  renderTutorial();
  showScreen("screen-tutorial");
}

function openDifficultySelect() {
  gameState = "difficulty";
  showScreen("screen-difficulty");
  // showScreen first: renderPlanetSelect() reads the portal button's live
  // getBoundingClientRect(), which is 0x0 while the screen is still hidden.
  renderPlanetSelect(pendingDifficultyId, (id) => {
    pendingDifficultyId = id;
    openCharSelect();
  });
}

function openCharSelect() {
  gameState = "charselect";
  renderCharSelect(meta, (id) => {
    if (pendingWarEmpireCount) {
      const empireCount = pendingWarEmpireCount;
      pendingWarEmpireCount = null;
      startRun(id, { war: true, empireCount });
    } else {
      startRun(id, { daily: false, difficultyId: pendingDifficultyId });
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

function handleAllyUpgradeBuy(key) {
  const def = ALLY_META_UPGRADES[key];
  const level = meta.allyUpgrades[key] || 0;
  if (level >= def.max) return;
  const cost = upgradeCost(def, level);
  if (meta.cores < cost) return;
  meta.cores -= cost;
  meta.allyUpgrades[key] = level + 1;
  writeSave(meta);
  openCodex();
}

function openCodex() {
  gameState = "codex";
  renderCodex(meta, handleAllyUpgradeBuy);
  showScreen("screen-codex");
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

function startRun(charId, { daily = false, war = false, empireCount = 4, difficultyId = "hard" } = {}) {
  charDef = CHARACTERS[charId];
  dailyMode = daily;
  const seed = daily ? dailySeedToday() : null;
  world = createWorld(seed, war ? "war" : "survival");
  // War Mode and the Daily Challenge don't go through the difficulty-select
  // screen -- they keep today's "Hard" behavior via getDifficultyMods()'s
  // fallback. Only a plain Survival run carries a real difficultyId.
  world.difficultyId = war || daily ? null : difficultyId;
  world.difficultyDef = getDifficulty(world.difficultyId || "hard");
  // The celestial body picked on the Planet Select screen recolors the
  // whole arena to match (see scenery.js/renderWorld()) -- War Mode/Daily
  // never set a real difficultyId, so they fall back to today's palette.
  world.arenaPalette = getArenaPalette(world.difficultyId);
  world.arenaBodyKind = getCelestialBody(world.difficultyId)?.kind || null;
  scenery = buildArenaScenery(world, world.difficultyDef.obstacleMult, world.arenaPalette);
  world._onEnemyDamaged = (e) => {
    particles.spawnBurst(e.x, e.y, "#ffffff", 3, { speed: 80, life: 0.2 });
  };
  world._spawnRing = (x, y, r) => particles.spawnRing(x, y, "#f87171", { size: r, life: 0.5 });
  world._onSupportPulse = (e, color) => particles.spawnRing(e.x, e.y, color, { size: 70, life: 0.4 });
  world._onMimicPulseHit = (dmg) => handlePlayerHit(dmg);
  player = createPlayer(charDef, meta, world.difficultyDef.xpNeededMult ?? 1);
  if (meta.ascensionLevel >= 3) {
    const pick = PASSIVE_LIST[Math.floor(Math.random() * PASSIVE_LIST.length)];
    addOrLevelPassive(player, pick.id);
  }
  recomputeStats(player, meta, charDef);
  player.hp = player.maxHp;

  if (war) startWarMode(world, empireCount, player);

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
  const reviveBtn = document.getElementById("btn-emergency-revive");
  if (reviveBtn) {
    reviveBtn.dataset.confirming = "";
    reviveBtn.textContent = "Emergency Revive (lose all buffs)";
    const anyDead = Object.values(world.allyDeadCount).some((n) => n > 0);
    reviveBtn.disabled = !anyDead;
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
  const options = generateOptions(player, world.rng, choiceCount, { deadAllyCount: world.allyDeadCount });
  world.rerollsLeft = world.rerollsLeft ?? 2 + (meta.ascensionLevel >= 2 ? 1 : 0) + Math.floor(player.stats.extraRerolls || 0);
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
        const fresh = generateOptions(player, world.rng, choiceCount, { deadAllyCount: world.allyDeadCount });
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

function reviveOneAlly() {
  const kind = Object.keys(world.allyDeadCount).find((k) => world.allyDeadCount[k] > 0);
  if (!kind) return false;
  world.allyDeadCount[kind] -= 1;
  showToast(`${ALLY_LABELS[kind] || "Ally"} revived!`, "#22d3ee");
  return true;
}

function applyOption(opt) {
  if (opt.kind === "revive") {
    reviveOneAlly();
    return;
  }
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
  const options = generateOptions(player, world.rng, 3, { deadAllyCount: world.allyDeadCount });
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
  // Only bullets tagged playerWeapon (fired by the player's own Blaster/
  // Missiles/Turret Drone -- see weapons.js) trigger lifesteal, not ally-
  // fired shots or a hostile mimic's copy of the player's weapons.
  if (b.playerWeapon && player.stats.lifesteal) player.hp = Math.min(player.maxHp, player.hp + b.dmg * player.stats.lifesteal);
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
  // Dodge rolls against the gameplay RNG (not Math.random) so Daily
  // Challenge stays seeded/reproducible. Deliberately not applied to hazard
  // zone ticks (updateHazards damages the player directly) -- you can't
  // "dodge" a DOT field you're already standing in.
  if (player.stats.dodgeChance > 0 && world.rng.chance(player.stats.dodgeChance)) {
    particles.spawnText(player.x, player.y - 20, "DODGE", "#67e8f9", { size: 12 });
    return;
  }
  const dealt = takeDamage(player, amount);
  if (dealt <= 0) return;
  camera.kick(7, 0.16);
  particles.spawnBurst(player.x, player.y, "#f87171", 10, { speed: 160 });
  audio.sfxHurt();
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const gp of pads) if (gp) input.vibrate(gp, 0.3, 0.6, 140);
  // Combat Stims: taking a real hit while critically low grants a short
  // speed/damage window (see updatePlayerMovement/updateWeapons).
  if (player.stats.combatStimsSpeedBonus > 0 && player.hp / player.maxHp < 0.3) {
    player._stimsUntil = world.time + 4;
  }
  if (player.hp <= 0) endRun(false);
}

const ALLY_LABELS = { drone: "Combat Drone", medic: "Field Medic", vanguard: "Vanguard" };
function killAlly(e) {
  e.active = false;
  particles.spawnBurst(e.x, e.y, e.color, 14, { speed: 160 });
  audio.sfxHit();
  world.allyDeadCount[e.allyKind] = (world.allyDeadCount[e.allyKind] || 0) + 1;
  showToast(`${ALLY_LABELS[e.allyKind] || "Ally"} lost -- gone for good unless revived.`, "#f87171");
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
    // Normal difficulty's graduating roster: each boss kill permanently
    // strikes the next tier of "basics" out of the spawn table (see
    // difficulty.js). No-op for every other difficulty.
    world.difficultyDef?.onBossKilled?.(world);
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

// Unlike Overload Core, this doesn't end the run -- it's an in-run trade:
// wipe every weapon/passive level (and overflow stacks) you've earned this
// run back to your starting loadout, in exchange for every dead ally
// coming back. A last-resort panic button, not a strategic choice.
function emergencyRevive() {
  if (gameState !== "paused") return;
  const anyDead = Object.values(world.allyDeadCount).some((n) => n > 0);
  if (!anyDead) return;
  player.weapons = [{ id: charDef.startWeapon, level: 1, evolved: false }];
  player.passives = [];
  player.overflowLevels = { overflowDamage: 0, overflowSpeed: 0, overflowRegen: 0, overflowLuck: 0 };
  for (const kind of Object.keys(world.allyDeadCount)) world.allyDeadCount[kind] = 0;
  recomputeStats(player, meta, charDef);
  player.hp = Math.min(player.hp, player.maxHp);
  showToast("Emergency revive: allies restored, all buffs lost.", "#22d3ee");
  resumeGame();
}

// ---------------------------------------------------------------- main update
function updatePlayerMovement(dt) {
  const mv = input.getMoveVector();
  let speed = player.stats.moveSpeed * (player.hazardSlow ?? 1);
  if (world.time < world.overdriveUntil) speed *= 1.3;
  // Combat Stims: a short window after taking a hit while critically low.
  if (world.time < (player._stimsUntil || 0)) speed *= 1 + (player.stats.combatStimsSpeedBonus || 0);

  player.dashCd = Math.max(0, player.dashCd - dt);
  if (player.dashing > 0) {
    player.dashing -= dt;
    speed *= 2.6;
    if (world.rng.chance(0.6)) particles.spawnBurst(player.x, player.y, player.color, 1, { speed: 20, life: 0.3 });
  } else if (input.actions.dash && player.dashCd <= 0 && (mv.x || mv.y)) {
    player.dashing = 0.16;
    player.dashCd = 2.4 * (1 + (player.stats.dashCooldownMult || 0));
    player.invuln = Math.max(player.invuln, 0.22);
    audio.sfxUiClick();
  }

  if (mv.x || mv.y) player.facingAngle = Math.atan2(mv.y, mv.x);
  player.x += mv.x * speed * dt;
  player.y += mv.y * speed * dt;
  const clamped = clampToArena(world, player.x, player.y, player.radius);
  player.x = clamped.x;
  player.y = clamped.y;
  if (scenery) {
    const pushed = resolveArenaObstacles(scenery, player.x, player.y, player.radius);
    player.x = pushed.x;
    player.y = pushed.y;
  }

  player.invuln = Math.max(0, player.invuln - dt);
  player.hitFlash = Math.max(0, player.hitFlash - dt);
  let dmgMult = 1;
  if (world.time < world.overdriveUntil) dmgMult = meta.ascensionLevel >= 9 ? 1.6 : 1.5;
  player.stats.runtimeDamageMult = dmgMult;
  player.hp = Math.min(player.maxHp, player.hp + player.stats.regen * dt);
}

function updateWeapons(dt) {
  const stimsActive = world.time < (player._stimsUntil || 0);
  const stimsDmgMult = stimsActive ? 1 + (player.stats.combatStimsDmgBonus || 0) : 1;
  for (const w of player.weapons) {
    const def = WEAPONS[w.id];
    const effectiveStats = { ...player.stats, damageMult: player.stats.damageMult * (player.stats.runtimeDamageMult || 1) * stimsDmgMult };
    def.update({ world, player, ws: w, dt, stats: effectiveStats, rng: world.rng });
  }
}

// Every combat unit's own AI/movement runs first; contact damage is then
// resolved in a second pass over fresh post-movement positions, faction by
// faction, so the same code handles horde-vs-player, horde-vs-ally, and (in
// War Mode) every empire-vs-player/ally contact instead of a player-only
// special case. isHostileFaction keeps empires from ever contact-damaging
// each other.
function updateEnemiesAndContact(dt) {
  for (const e of world.enemies) {
    if (!e.active) continue;
    if (e.isBoss) updateBoss(e, world, dt, player);
    // allyKind covers both the real player's own allies and a hostile
    // Mimic's ally escorts -- both run the same allyRanged/allyMedic/
    // allySeek AI in allies.js, just with different factions/targets.
    else if (e.isAlly || e.allyKind) updateAlly(e, world, dt, player);
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

    if (isHostileFaction(e.faction, player.faction)) {
      const dp = dist(e.x, e.y, player.x, player.y);
      if (dp < e.radius + player.radius) {
        e.contactCooldown = 0.5;
        handlePlayerHit(e.dmg);
        continue;
      }
    }

    const nearby = contactGrid.queryCircle(e.x, e.y, e.radius + 40);
    for (const o of nearby) {
      if (o === e || !o.active || !isHostileFaction(e.faction, o.faction)) continue;
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

// Collision resolves via isHostileFaction(b.sourceFaction, candidate.faction)
// rather than a hardcoded "player bullets hit world.enemies, enemy bullets
// hit the player" split. That's what lets ally-fired shots, horde shots, and
// every War Mode empire's shots all go through one path instead of several
// near-duplicate ones -- while still never letting one empire's bullets hit
// another empire's units.
function updateBullets(dt) {
  enemyGrid.clear();
  for (const e of world.enemies) if (e.active) enemyGrid.insert(e);

  for (const b of world.bullets) {
    if (!b.active) continue;

    if (b.homing) {
      let nearest = null,
        bestD = Infinity;
      for (const e of world.enemies) {
        if (!e.active || !isHostileFaction(b.sourceFaction, e.faction)) continue;
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

    if (isHostileFaction(b.sourceFaction, player.faction) && player.invuln <= 0 && dist(b.x, b.y, player.x, player.y) < b.radius + player.radius) {
      handlePlayerHit(b.dmg);
      b.active = false;
      continue;
    }

    const candidates = enemyGrid.queryCircle(b.x, b.y, b.radius + 40);
    for (const e of candidates) {
      if (!e.active || !isHostileFaction(b.sourceFaction, e.faction) || b._hitSet.has(e.id)) continue;
      const rr = b.radius + e.radius;
      if ((b.x - e.x) ** 2 + (b.y - e.y) ** 2 > rr * rr) continue;

      applyBulletDamage(e, b);
      b._hitSet.add(e.id);

      if (b.aoeRadius > 0) {
        // Impact Rounds/Kinetic Rebound only push harder on the player's
        // own explosions (playerWeapon-tagged, e.g. Homing Missiles), never
        // a hostile launcher/siege cannon blast hitting the player.
        if (b.playerWeapon && player.stats.knockbackMult) {
          const kb = 160 * player.stats.knockbackMult;
          const d0 = Math.hypot(e.x - b.x, e.y - b.y) || 1;
          e.knockX += ((e.x - b.x) / d0) * kb;
          e.knockY += ((e.y - b.y) / d0) * kb;
        }
        const aoeCandidates = enemyGrid.queryCircle(b.x, b.y, b.aoeRadius + 40);
        for (const e2 of aoeCandidates) {
          if (!e2.active || e2 === e || !isHostileFaction(b.sourceFaction, e2.faction)) continue;
          if ((b.x - e2.x) ** 2 + (b.y - e2.y) ** 2 <= b.aoeRadius * b.aoeRadius) {
            applyBulletDamage(e2, { ...b, dmg: b.dmg * 0.7, crit: false });
            if (b.playerWeapon && player.stats.knockbackMult) {
              const kb = 160 * player.stats.knockbackMult;
              const d2 = Math.hypot(e2.x - b.x, e2.y - b.y) || 1;
              e2.knockX += ((e2.x - b.x) / d2) * kb;
              e2.knockY += ((e2.y - b.y) / d2) * kb;
            }
          }
        }
        if (isHostileFaction(b.sourceFaction, player.faction) && player.invuln <= 0 && dist(b.x, b.y, player.x, player.y) <= b.aoeRadius) {
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
      gainXp(player, p.value * (1 + (player.stats.xpGainMult || 0)), offerLevelUp);
      audio.sfxPickup();
    } else if (p.kind === "gold") {
      world.coresEarned += p.value * (1 + (player.stats.goldGainMult || 0));
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
  const palette = world?.arenaPalette || DEFAULT_ARENA_PALETTE;
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, w, h);
  // A screen-space accent glow centered on the viewport, plus a per-body
  // `kind` ambient layer (moon craters live in world space, drawn later;
  // asteroid field / nebula / black hole are screen-space so they're always
  // visible from the first frame, not just once the player wanders near
  // world-space billboards). This is what actually makes a run on, say,
  // Nebula read differently from one on Mercury at a glance -- the palette
  // alone was too subtle against a near-black background to notice in play.
  const glow = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.75);
  glow.addColorStop(0, hexToRgba(palette.accent, 0.16));
  glow.addColorStop(1, hexToRgba(palette.accent, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  drawArenaAmbience(ctx, w, h, world?.time || 0, world?.arenaBodyKind || null, palette);
  if (!world || !player) return;

  const shake = camera.getShakeOffset();
  ctx.save();
  ctx.translate(w / 2 + shake.x, h / 2 + shake.y);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-player.x, -player.y);

  // arena boundary + soft grid for spatial readability -- recolored to
  // match the chosen celestial body's palette (world.arenaPalette).
  ctx.strokeStyle = palette.ring;
  ctx.shadowColor = palette.ring;
  ctx.shadowBlur = 12;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, world.arenaRadius, 0, TAU);
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.strokeStyle = palette.grid;
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

  // Moon (Clone difficulty): cratered ground texture tied to world space
  // via a deterministic cell hash, so it reads as real terrain the camera
  // pans over instead of a fixed overlay.
  if (world.arenaBodyKind === "moon") drawGroundCraters(ctx, player.x, player.y, world.seed || 0);

  // holographic billboards, boundary pylons, and distant city light glints --
  // turns the arena from a bare circle+grid into a rooftop/street battlefield.
  if (scenery) drawArenaGround(ctx, world, scenery, world.time);

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

  // enemies + allies (share one array/loop; isAlly flag picks styling).
  // Every unit is drawn as an armored mech/operator silhouette (via
  // scenery.js's drawUnitShape/drawBossShape/drawAllyShape, keyed off the
  // `shape` field ENEMY_TYPES/BOSS_TYPES carry) rather than a plain dot --
  // a soft glow disc underneath keeps the "lit from within" neon read
  // without hiding the silhouette detail drawn on top of it.
  for (const e of world.enemies) {
    if (!e.active) continue;
    const flashT = clamp(e.hitFlash / 0.1, 0, 1);
    const color = flashT > 0 ? mixWhite(e.color, flashT) : e.color;
    const facing = Math.atan2(e.vy, e.vx) || 0;
    ctx.save();
    ctx.translate(e.x, e.y);
    if (e.elite || e.isBoss) {
      ctx.shadowColor = e.color;
      ctx.shadowBlur = e.isBoss ? 26 : 14;
    }
    drawEntityGlow(ctx, 0, 0, e.radius * 1.15, color, e.isBoss || e.elite ? 0.55 : 0.35);
    ctx.shadowBlur = 0;
    // allyKind is set on both the real player's own allies (isAlly:true)
    // and a hostile Mimic's ally escorts (isAlly:false, faction matches the
    // mimic) -- either way it draws with the ally silhouette family.
    const shape = e.allyKind ? null : (e.isBoss ? BOSS_TYPES[e.type]?.shape : ENEMY_TYPES[e.type]?.shape) ?? (e.isBoss ? "fortress" : "swarm");
    // Ship-hull shapes (player/Mimic) are a dark silhouette over their own
    // bright glow disc, not a solid fill in e.color like every other
    // archetype -- matches how the real player renders.
    const shapeColor = shape === "mimic" || shape === "operator" ? (flashT > 0 ? "#ffffff" : "#0b1220") : color;
    if (e.allyKind) {
      ctx.strokeStyle = e.isAlly ? "rgba(0,240,255,0.85)" : "rgba(255,56,96,0.85)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius + 5, 0, TAU);
      ctx.stroke();
      drawAllyShape(ctx, e.allyKind, e.radius, color, facing);
    } else if (e.isBoss) {
      drawBossShape(ctx, shape, e.radius, shapeColor, { time: world.time, facing });
    } else {
      drawUnitShape(ctx, shape, e.radius, shapeColor, { facing });
    }
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

  // player -- same "operator" silhouette family as the Mimic (which is
  // literally supposed to look like a copy of you), just always in your
  // chosen character's color rather than a snapshot of it.
  ctx.save();
  ctx.translate(player.x, player.y);
  const invulnFlicker = player.invuln > 0 && Math.floor(world.time * 20) % 2 === 0 ? 0.4 : 1;
  ctx.globalAlpha = invulnFlicker;
  ctx.shadowColor = charDef.color;
  ctx.shadowBlur = 18;
  drawEntityGlow(ctx, 0, 0, player.radius * 1.15, charDef.color, 0.4);
  ctx.shadowBlur = 0;
  drawUnitShape(ctx, "operator", player.radius, player.hitFlash > 0 ? "#ffffff" : "#0b1220", { facing: player.facingAngle || 0 });
  ctx.globalAlpha = 1;
  ctx.restore();

  // bullets -- stretched glowing tracers along travel direction, not dots
  for (const b of world.bullets) {
    if (!b.active) continue;
    drawBulletTracer(ctx, b);
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
// Falling neon rain streaks over the skyline, rather than a plain twinkling
// starfield -- reads as a rainy Night City rooftop view instead of open sky.
const rainDrops = Array.from({ length: 90 }, () => ({
  x: Math.random(),
  y: Math.random(),
  z: 0.3 + Math.random() * 0.7,
  tw: Math.random() * TAU,
}));
function renderMenuBg(t) {
  const w = window.innerWidth,
    h = window.innerHeight;
  menuCtx.fillStyle = "#05030c";
  menuCtx.fillRect(0, 0, w, h);
  drawCitySkyline(menuCtx, w, h, t);
  for (const s of rainDrops) {
    const x = s.x * w;
    const y = ((s.y + t * 0.35 * s.z) % 1) * h;
    const alpha = 0.25 + 0.35 * s.z;
    const hue = s.tw > Math.PI ? "0,240,255" : "255,43,214";
    const len = 10 + 14 * s.z;
    menuCtx.strokeStyle = `rgba(${hue},${alpha})`;
    menuCtx.lineWidth = 1.2 * s.z;
    menuCtx.beginPath();
    menuCtx.moveTo(x, y);
    menuCtx.lineTo(x - 1.5, y + len);
    menuCtx.stroke();
  }
  const grad = menuCtx.createRadialGradient(w * 0.5, h * 0.35, 0, w * 0.5, h * 0.35, Math.max(w, h) * 0.55);
  grad.addColorStop(0, "rgba(124,58,237,0.16)");
  grad.addColorStop(0.6, "rgba(255,43,214,0.05)");
  grad.addColorStop(1, "rgba(5,3,12,0)");
  menuCtx.fillStyle = grad;
  menuCtx.fillRect(0, 0, w, h);
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
      difficultyId: world?.difficultyId,
      arenaPalette: world?.arenaPalette,
      arenaBodyKind: world?.arenaBodyKind,
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
      passiveCount: player?.passives?.length,
      ascensionLevel: meta.ascensionLevel,
      empires: world?.empires?.map((emp) => {
        const boss = world.enemies.find((e) => e.id === emp.bossId);
        return { id: emp.id, alive: emp.alive, bossHp: boss?.hp, bossMaxHp: boss?.maxHp, bossX: boss?.x, bossY: boss?.y };
      }),
      allyDeadCount: world?.allyDeadCount ? { ...world.allyDeadCount } : null,
      mimicSample: (() => {
        const m = world?.enemies?.find((e) => e.active && e.type === "mimic");
        return m ? { isBoss: !!m.isBoss, hp: m.hp, maxHp: m.maxHp, weapons: m.mimicWeapons?.map((w) => w.id) } : null;
      })(),
      billboards: scenery?.billboards?.map((b) => ({ x: b.x, y: b.y, w: b.w, h: b.h, rot: b.rot })),
    };
  }
});

// ---------------------------------------------------------------- screen wiring
initScreens({
  onAnyClick: () => audio.sfxUiClick(),
  play: openDifficultySelect,
  tutorial: openTutorial,
  daily: openDaily,
  armory: openArmory,
  achievements: openAchievements,
  ascension: openAscension,
  codex: openCodex,
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
  retry: () => startRun(charDef.id, { daily: dailyMode, difficultyId: world?.difficultyId || pendingDifficultyId }),
  quit: () => window.electronAPI?.quit(),
  overload: (btn) => {
    if (btn.dataset.confirming === "1") {
      selfDestruct();
    } else {
      btn.dataset.confirming = "1";
      btn.textContent = "Confirm? This ends the run.";
    }
  },
  "emergency-revive": (btn) => {
    if (btn.disabled) return;
    if (btn.dataset.confirming === "1") {
      emergencyRevive();
    } else {
      btn.dataset.confirming = "1";
      btn.textContent = "Confirm? All weapon/passive levels reset.";
    }
  },
});

document.getElementById("btn-pause").addEventListener("click", pauseGame);
if (window.electronAPI?.isElectron) {
  document.getElementById("btn-quit").classList.remove("hidden");
}

goMenu();

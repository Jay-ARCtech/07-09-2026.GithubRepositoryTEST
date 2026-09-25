// Turn-based tactical combat. 2 AP/turn. Every enemy shows its next
// intent a full round before it resolves (DESIGN.md §6-7) — nothing here
// rolls to-hit in secret; damage varies, whether something happens at all
// never does. Player weapon/ability damage always lands; the tactics are in
// resource allocation (AP, Power, Bloomstrain, and when to spend a
// consumable turn), not in hidden dice.

import { getItem } from '../data/items.js';
import { getEnemy } from '../data/bestiary.js';
import { COMPANIONS } from '../data/content.js';
import { clamp } from '../engine/state.js';

const BASE_AP = 2;

function rollIntent(rng, enemyDef) {
  return rng.pickWeighted(enemyDef.intents.map((i) => ({ item: i, weight: i.weight })));
}

export function startCombat(rng, enemyIds) {
  const enemies = enemyIds.map((id, i) => {
    const def = getEnemy(id);
    return {
      instanceId: `${id}_${i}`,
      enemyId: id,
      name: def.name,
      health: def.health,
      maxHealth: def.health,
      baseDefense: def.defense || 0,
      tempDefense: 0,
      bleedTurns: 0,
      bleedDamage: 0,
      rootedTurns: 0,
      weakenedTurns: 0,
      nextIntent: rollIntent(rng, def),
    };
  });
  return {
    enemies,
    playerAP: BASE_AP,
    maxAP: BASE_AP,
    turn: 'player',
    round: 1,
    log: [`Combat begins: ${enemies.map((e) => e.name).join(', ')}.`],
    outcome: null,
    allyActionUsed: false,
    shieldPoints: 0,
    evasiveTurns: 0,
  };
}

function pushLog(state, line) {
  state.log = [...state.log.slice(-40), line];
}

function livingEnemies(state) {
  return state.enemies.filter((e) => e.health > 0);
}

function findEnemy(state, instanceId) {
  return state.enemies.find((e) => e.instanceId === instanceId) || null;
}

function armorDefense(character) {
  const armorId = character.equipped?.armor;
  const armor = armorId ? getItem(armorId) : null;
  return armor?.defense || 0;
}

function damageEnemy(state, enemy, amount, character) {
  const mitigated = Math.max(0, amount - (enemy.baseDefense + enemy.tempDefense));
  enemy.tempDefense = 0;
  enemy.health = clamp(enemy.health - mitigated, 0, enemy.maxHealth);
  pushLog(state, `${enemy.name} takes ${mitigated} damage.${enemy.health <= 0 ? ` ${enemy.name} is down.` : ''}`);
  return mitigated;
}

function damagePlayer(state, character, amount) {
  if (state.evasiveTurns > 0) {
    state.evasiveTurns -= 1;
    pushLog(state, `You evade the attack completely.`);
    return 0;
  }
  let remaining = Math.max(0, amount - armorDefense(character));
  if (state.shieldPoints > 0) {
    const absorbed = Math.min(state.shieldPoints, remaining);
    state.shieldPoints -= absorbed;
    remaining -= absorbed;
    if (absorbed > 0) pushLog(state, `Your shield absorbs ${absorbed} damage.`);
  }
  character.health.current = clamp(character.health.current - remaining, 0, character.health.max);
  if (remaining > 0) pushLog(state, `You take ${remaining} damage.`);
  return remaining;
}

export function checkOutcome(state, character) {
  if (character.health.current <= 0) { state.outcome = 'defeat'; return; }
  if (character.bloomstrain >= 100) { state.outcome = 'transformed'; return; }
  if (livingEnemies(state).length === 0) { state.outcome = 'victory'; }
}

// ---------------- player actions ----------------

export function playerBasicAttack(state, rng, character, targetInstanceId) {
  if (state.outcome || state.turn !== 'player') return { ok: false, reason: 'not your turn' };
  const weapon = character.equipped?.weapon ? getItem(character.equipped.weapon) : null;
  const apCost = weapon?.apCost ?? 1;
  if (state.playerAP < apCost) return { ok: false, reason: 'Not enough AP.' };
  const target = findEnemy(state, targetInstanceId);
  if (!target || target.health <= 0) return { ok: false, reason: 'Invalid target.' };
  const range = weapon?.damage || [1, 3];
  const dmg = rng.int(range[0], range[1]);
  state.playerAP -= apCost;
  pushLog(state, `You attack with ${weapon ? weapon.name : 'bare hands'}.`);
  damageEnemy(state, target, dmg, character);
  checkOutcome(state, character);
  return { ok: true };
}

const ABILITY_AP_COST = 1;

function applyAbilityEffect(abilityId, ctx) {
  const { state, rng, character, target } = ctx;
  switch (abilityId) {
    case 'overclock_strike': {
      const weapon = character.equipped?.weapon ? getItem(character.equipped.weapon) : null;
      const range = weapon?.damage || [1, 3];
      const dmg = rng.int(range[0], range[1]) + rng.int(2, 5);
      if (target) damageEnemy(state, target, dmg, character);
      pushLog(state, 'Neural shunt fires — an overclocked strike.');
      break;
    }
    case 'optic_camo':
      state.evasiveTurns += 1;
      pushLog(state, 'You bend out of sight for a moment.');
      break;
    case 'choir_whisper':
      if (target) { target.nextIntent = { type: 'defend' }; pushLog(state, `Something whispers doubt into ${target.name}.`); }
      break;
    case 'kinetic_boost':
      state.playerAP += 1;
      pushLog(state, 'The kinetic frame kicks in — an extra action this turn.');
      break;
    case 'emp_pulse':
      for (const e of livingEnemies(state)) { e.tempDefense = 0; damageEnemy(state, e, rng.int(3, 6), character); }
      pushLog(state, 'An EMP pulse rips through every powered thing nearby.');
      break;
    case 'phase_step':
      state.evasiveTurns += 1;
      character.health.current = clamp(character.health.current + rng.int(4, 8), 0, character.health.max);
      pushLog(state, 'You step half out of the moment. It costs you less than staying would have.');
      break;
    case 'photosynth_shield':
      state.shieldPoints += rng.int(6, 10) + character.stats.resonance;
      pushLog(state, 'A living weave of light-fed cells hardens across your skin.');
      break;
    case 'thorn_lash': {
      if (target) {
        damageEnemy(state, target, rng.int(3, 6), character);
        target.bleedTurns = Math.max(target.bleedTurns, 2);
        target.bleedDamage = 3;
        pushLog(state, `Thorn growth tears into ${target.name}.`);
      }
      break;
    }
    case 'mycelial_link':
      character.health.current = clamp(character.health.current + rng.int(8, 14) + character.stats.resonance, 0, character.health.max);
      pushLog(state, 'A healing thread runs through the graft. You feel it knit something shut.');
      break;
    case 'spore_cloud':
      for (const e of livingEnemies(state)) e.weakenedTurns = Math.max(e.weakenedTurns, 1);
      pushLog(state, 'A disorienting cloud settles over the fight.');
      break;
    case 'overgrowth_root':
      if (target) { target.rootedTurns = Math.max(target.rootedTurns, 1); pushLog(state, `A living root drives ${target.name} into the floor.`); }
      break;
    case 'canopy_bloom':
      character.health.current = clamp(character.health.current + rng.int(14, 22), 0, character.health.max);
      state.shieldPoints += rng.int(8, 12);
      pushLog(state, 'A second heartbeat, grown not born, steadies everything at once.');
      break;
    default:
      pushLog(state, 'Nothing happens. (Unknown ability.)');
  }
}

export function playerUseAbility(state, rng, character, itemId, targetInstanceId) {
  if (state.outcome || state.turn !== 'player') return { ok: false, reason: 'not your turn' };
  const item = getItem(itemId);
  if (!item || (item.type !== 'cyberware' && item.type !== 'augment')) return { ok: false, reason: 'Invalid item.' };
  const equippedSet = item.type === 'cyberware' ? character.equipped.cyberware : character.equipped.augments;
  if (!equippedSet?.includes(itemId)) return { ok: false, reason: 'Not equipped.' };
  if (state.playerAP < ABILITY_AP_COST) return { ok: false, reason: 'Not enough AP.' };
  if (character.power.current < item.powerCost) return { ok: false, reason: 'Not enough Power.' };
  const target = targetInstanceId ? findEnemy(state, targetInstanceId) : null;
  state.playerAP -= ABILITY_AP_COST;
  character.power.current -= item.powerCost;
  if (item.type === 'augment') {
    character.bloomstrain = clamp(character.bloomstrain + (item.bloomCost || 0), 0, 100);
  }
  applyAbilityEffect(item.ability, { state, rng, character, target });
  checkOutcome(state, character);
  return { ok: true };
}

export function playerUseConsumable(state, character, itemId) {
  if (state.outcome || state.turn !== 'player') return { ok: false, reason: 'not your turn' };
  if (state.playerAP < 1) return { ok: false, reason: 'Not enough AP.' };
  const item = getItem(itemId);
  const stack = character.inventory.find((i) => i.itemId === itemId);
  if (!item || item.type !== 'consumable' || !stack || stack.qty <= 0) return { ok: false, reason: 'Item unavailable.' };
  state.playerAP -= 1;
  stack.qty -= 1;
  character.inventory = character.inventory.filter((i) => i.qty > 0);
  if (item.effect === 'heal') character.health.current = clamp(character.health.current + item.value, 0, character.health.max);
  if (item.effect === 'power') character.power.current = clamp(character.power.current + item.value, 0, character.power.max);
  if (item.effect === 'heat') character.heat = clamp(character.heat + item.value, 0, 100);
  if (item.effect === 'bloomstrain') character.bloomstrain = clamp(character.bloomstrain + item.value, 0, 100);
  pushLog(state, `You use ${item.name}.`);
  checkOutcome(state, character);
  return { ok: true };
}

export function playerUseAllyAction(state, rng, character) {
  if (state.outcome || state.turn !== 'player' || state.allyActionUsed) return { ok: false, reason: 'Unavailable.' };
  const active = character.companions.filter((c) => c.alive && c.bond >= 10).sort((a, b) => b.bond - a.bond)[0];
  if (!active) return { ok: false, reason: 'No companion ready to help.' };
  const def = COMPANIONS[active.companionId];
  state.allyActionUsed = true;
  const enemies = livingEnemies(state);
  switch (active.companionId) {
    case 'cp_reyes':
      if (enemies.length) damageEnemy(state, rng.pick(enemies), rng.int(5, 9), character);
      break;
    case 'cp_sable':
      state.shieldPoints += rng.int(6, 10);
      break;
    case 'cp_juno':
      for (const e of enemies) e.tempDefense = 0;
      if (enemies.length) damageEnemy(state, rng.pick(enemies), rng.int(3, 6), character);
      break;
    case 'cp_static':
      if (enemies.length) rng.pick(enemies).nextIntent = { type: 'defend' };
      break;
    case 'cp_ortiz':
      state.evasiveTurns += 1;
      character.health.current = clamp(character.health.current + rng.int(4, 7), 0, character.health.max);
      break;
    default:
      break;
  }
  pushLog(state, `${def.name} steps in: ${def.bondAbility.name}.`);
  checkOutcome(state, character);
  return { ok: true };
}

export function playerFlee(state, rng, character) {
  if (state.outcome || state.turn !== 'player') return { ok: false, reason: 'not your turn' };
  const chance = 0.35 + character.stats.reflex * 0.05;
  if (rng.chance(chance)) {
    state.outcome = 'fled';
    pushLog(state, 'You break away and put distance between you and the fight.');
    return { ok: true, fled: true };
  }
  pushLog(state, 'You try to break away and can’t shake them.');
  state.playerAP = 0;
  return { ok: true, fled: false };
}

// ---------------- enemy turn ----------------

function resolveEnemyIntent(state, rng, character, enemy) {
  const intent = enemy.nextIntent;
  if (enemy.bleedTurns > 0) {
    enemy.health = clamp(enemy.health - enemy.bleedDamage, 0, enemy.maxHealth);
    enemy.bleedTurns -= 1;
    pushLog(state, `${enemy.name} takes ${enemy.bleedDamage} bleed damage.`);
    if (enemy.health <= 0) { pushLog(state, `${enemy.name} is down.`); return; }
  }
  if (enemy.rootedTurns > 0) {
    enemy.rootedTurns -= 1;
    pushLog(state, `${enemy.name} is rooted and can’t act.`);
    return;
  }
  if (!intent) return;
  if (intent.type === 'attack') {
    let dmg = rng.int(intent.dmg[0], intent.dmg[1]);
    if (enemy.weakenedTurns > 0) { dmg = Math.round(dmg * 0.65); enemy.weakenedTurns -= 1; }
    pushLog(state, `${enemy.name} attacks.`);
    damagePlayer(state, character, dmg);
  } else if (intent.type === 'defend') {
    enemy.tempDefense += 3;
    pushLog(state, `${enemy.name} braces.`);
  } else if (intent.type === 'heal_self') {
    const amt = rng.int(intent.value[0], intent.value[1]);
    enemy.health = clamp(enemy.health + amt, 0, enemy.maxHealth);
    pushLog(state, `${enemy.name} recovers ${amt} health.`);
  } else if (intent.type === 'drain_power') {
    character.power.current = clamp(character.power.current - intent.value, 0, character.power.max);
    pushLog(state, `${enemy.name} drains ${intent.value} Power from you.`);
  }
}

export function endPlayerTurn(state, rng, character) {
  if (state.outcome) return;
  state.turn = 'enemy';
  for (const enemy of livingEnemies(state)) {
    resolveEnemyIntent(state, rng, character, enemy);
    checkOutcome(state, character);
    if (state.outcome) return;
  }
  for (const enemy of livingEnemies(state)) {
    const def = getEnemy(enemy.enemyId);
    enemy.nextIntent = rollIntent(rng, def);
  }
  state.round += 1;
  state.playerAP = state.maxAP;
  state.turn = 'player';
  checkOutcome(state, character);
}

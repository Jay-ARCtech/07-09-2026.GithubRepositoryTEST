// Pure-logic smoke test, run under plain Node (no DOM). Exercises the game
// systems directly to catch logic bugs before browser testing.
import { Rng } from '../src/engine/rng.js';
import { createInitialState, newCharacterShell } from '../src/engine/state.js';
import { validateState, validateLegacy, sanitizeName } from '../src/engine/save.js';
import { ORIGINS, ORIGIN_ORDER, startingHealthFor, startingPowerFor } from '../src/data/stats.js';
import { ITEMS, getItem } from '../src/data/items.js';
import { ENEMIES, enemiesForZoneAndTier, bossForZone } from '../src/data/bestiary.js';
import { ENCOUNTERS } from '../src/data/content.js';
import { resolveCheck, oddsBand, effectiveStats } from '../src/systems/checks.js';
import * as combat from '../src/systems/combat.js';
import * as run from '../src/systems/run.js';

let failures = 0;
function assert(cond, msg) { if (!cond) { failures++; console.log('FAIL:', msg); } else { console.log('ok  :', msg); } }

// ---- 1. node map generation: connectivity + boss reachable ----
for (const cycle of [1, 2, 3]) {
  const map = run.generateNodeMap(12345, cycle);
  const all = run.flattenNodes(map);
  assert(all.some((n) => n.kind === 'boss'), `cycle ${cycle} map has a boss node`);
  // every non-final layer node must connect to at least one real node in the next layer
  let brokenLinks = 0;
  for (const n of all) {
    if (n.kind === 'boss') continue;
    if (!n.connectsTo.length) brokenLinks++;
    for (const target of n.connectsTo) if (!all.find((x) => x.id === target)) brokenLinks++;
  }
  assert(brokenLinks === 0, `cycle ${cycle} map has no dangling connections (${brokenLinks} broken)`);
  // boss must be reachable from the start via some path (BFS)
  const seen = new Set(map.startNodeIds);
  let frontier = [...map.startNodeIds];
  while (frontier.length) {
    const next = [];
    for (const id of frontier) {
      const node = run.findNode(map, id);
      for (const t of node.connectsTo) if (!seen.has(t)) { seen.add(t); next.push(t); }
    }
    frontier = next;
  }
  const bossId = all.find((n) => n.kind === 'boss').id;
  assert(seen.has(bossId), `cycle ${cycle} boss is reachable from a start node`);
}

// ---- 2. full character creation -> combat simulation to victory or defeat, many seeds ----
for (let trial = 0; trial < 200; trial++) {
  const originId = ORIGIN_ORDER[trial % ORIGIN_ORDER.length];
  const origin = ORIGINS[originId];
  const character = newCharacterShell();
  character.stats = { ...origin.stats };
  character.health = { current: startingHealthFor(origin.stats), max: startingHealthFor(origin.stats) };
  character.power = { current: startingPowerFor(origin.stats), max: startingPowerFor(origin.stats) };
  character.inventory = origin.startingItems.map((id) => ({ itemId: id, qty: 1 }));
  for (const id of origin.startingItems) {
    const item = getItem(id);
    if (item.type === 'weapon') character.equipped.weapon = id;
    if (item.type === 'armor') character.equipped.armor = id;
    if (item.type === 'cyberware') character.equipped.cyberware.push(id);
    if (item.type === 'augment') character.equipped.augments.push(id);
  }
  const rng = new Rng(trial * 7 + 1);
  const enemyPool = enemiesForZoneAndTier('sprawl', Math.min(3, 1 + (trial % 3)));
  const enemyIds = [rng.pick(enemyPool).id];
  const state = combat.startCombat(rng, enemyIds);
  let rounds = 0;
  while (!state.outcome && rounds < 200) {
    rounds++;
    // simple bot: attack until out of AP, then end turn
    let guard = 0;
    while (state.playerAP > 0 && !state.outcome && guard < 10) {
      guard++;
      const target = state.enemies.find((e) => e.health > 0);
      if (!target) break;
      combat.playerBasicAttack(state, rng, character, target.instanceId);
    }
    if (!state.outcome) combat.endPlayerTurn(state, rng, character);
  }
  assert(rounds < 200, `trial ${trial} (${originId}) combat terminates (${rounds} rounds, outcome=${state.outcome})`);
  assert(['victory', 'defeat', 'transformed'].includes(state.outcome), `trial ${trial} produces a valid outcome (${state.outcome})`);
  assert(character.health.current >= 0 && character.health.current <= character.health.max, `trial ${trial} health stays in bounds (${character.health.current}/${character.health.max})`);
}

// ---- 3. ability usage doesn't corrupt state (Power/Bloomstrain bounds) ----
{
  const origin = ORIGINS.bloom_orphan;
  const character = newCharacterShell();
  character.stats = { ...origin.stats };
  character.health = { current: startingHealthFor(origin.stats), max: startingHealthFor(origin.stats) };
  character.power = { current: 99, max: 99 }; // deliberately generous so ability spam is possible
  character.equipped.augments = ['ba_canopy_heart', 'ba_root_talon'];
  const rng = new Rng(999);
  const state = combat.startCombat(rng, ['boss_handler_vesk']);
  for (let i = 0; i < 50 && !state.outcome; i++) {
    combat.playerUseAbility(state, rng, character, 'ba_canopy_heart', null);
    if (state.outcome) break;
    if (state.playerAP > 0) combat.playerUseAbility(state, rng, character, 'ba_root_talon', state.enemies[0]?.instanceId);
    if (!state.outcome) combat.endPlayerTurn(state, rng, character);
  }
  assert(character.bloomstrain >= 0 && character.bloomstrain <= 100, `bloomstrain stays clamped (${character.bloomstrain})`);
  assert(character.health.current >= 0 && character.health.current <= character.health.max, `health stays clamped after ability spam (${character.health.current}/${character.health.max})`);
}

// ---- 4. checks.js sanity ----
assert(oddsBand(10, 'easy') === 'good', 'high stat vs easy DC reads as good odds');
assert(oddsBand(-5, 'hard') === 'poor', 'negative-ish stat vs hard DC reads as poor odds');
assert(resolveCheck(new Rng(1), 5, 'certain').success === true, 'certain difficulty always succeeds');
{
  const c = newCharacterShell();
  c.stats.empathy = 5;
  c.equipped.cyberware = ['cw_kinetic_frame']; // essenceCost 2
  const eff = effectiveStats(c, ITEMS);
  assert(eff.empathy === 3, `cyberware essence cost reduces effective Empathy (got ${eff.empathy}, expected 3)`);
}

// ---- 5. save.js: adversarial input handling (the actual security-relevant test) ----
function tryPollution(payload, label) {
  const validated = validateState(payload);
  const polluted = ({}).polluted === true || Object.prototype.polluted === true;
  assert(!polluted, `${label}: no prototype pollution occurred`);
  assert(validated === null || typeof validated === 'object', `${label}: validateState returns null or a plain object, never throws uncontrolled`);
}
tryPollution(JSON.parse('{"__proto__":{"polluted":true},"character":{"name":"x"}}'), 'proto-pollution via __proto__ key');
tryPollution(JSON.parse('{"character":{"name":{"__proto__":{"polluted":true}}}}'), 'proto-pollution nested in character.name');
tryPollution(JSON.parse('{"flags":{"__proto__":{"polluted":true},"constructor":{"polluted":true},"a_ok_flag":"hi"}}'), 'proto-pollution via flags map keys');
tryPollution({ character: { name: 'A'.repeat(100000), stats: { body: 999999 } }, factions: { ashgrove: 999999 } }, 'huge strings / out-of-range numbers');
tryPollution('not even an object', 'raw string instead of object');
tryPollution(null, 'null input');
tryPollution([1, 2, 3], 'array instead of object');
tryPollution({ character: { health: { current: 'NaN-ish', max: -5 } } }, 'garbage health values');
{
  const validated = validateState({ character: { name: 'Kai', originId: 'corpo_defector', stats: { body: 3 } }, factions: { ashgrove: -25 }, run: { cycle: 2 } });
  assert(validated.character.name === 'Kai', 'valid-ish partial input still extracts good fields');
  assert(validated.character.stats.body === 3, 'valid stat value passes through');
  assert(validated.factions.ashgrove === -25, 'valid faction rep passes through');
  assert(validated.run.cycle === 2, 'valid cycle number passes through');
}
{
  const name = sanitizeName('<script>alert(1)<' + '/script>');
  assert(name.includes('<script>'), 'sanitizeName does not need to strip HTML chars (never rendered as HTML anyway)'); // documents behavior: safety comes from textContent rendering, not stripping
  const withControlChars = sanitizeName('Kai\u0000\u0007Voss');
  assert(!withControlChars.includes('\u0000') && !withControlChars.includes('\u0007'), 'sanitizeName strips control characters');
  assert(sanitizeName('a'.repeat(500)).length <= 24, 'sanitizeName enforces max length');
  assert(sanitizeName('   ') === 'Unnamed', 'sanitizeName falls back on whitespace-only input');
  assert(sanitizeName(12345) === 'Unnamed', 'sanitizeName falls back on non-string input');
}
{
  const legacy = validateLegacy({ legacyPoints: -50, unlockedOriginIds: ['corpo_defector', '__proto__', 'not_a_real_origin'], pastCharacters: 'not an array' });
  assert(legacy.legacyPoints === 0, 'negative legacy points clamp to 0');
  assert(Array.isArray(legacy.pastCharacters) && legacy.pastCharacters.length === 0, 'non-array pastCharacters becomes empty array');
  // unlockedOriginIds is an ARRAY (values, not object keys). The pollution
  // vector is a dynamic-key WRITE like target[value] = x on a live object;
  // reading obj['__proto__'] is not itself damage (it's just JS's normal
  // prototype accessor), it's the "what if" for whether a write pattern
  // exists anywhere. It doesn't: main.js/screens.js only ever consume this
  // array via .includes()/Set/index — never `target[id] = ...`. That's a
  // static fact about the code, not something to re-derive with a runtime
  // trick, so assert the actual read patterns are what's used and leave it
  // there rather than fabricate a misleading dynamic-write simulation.
  assert(legacy.unlockedOriginIds.includes('__proto__'), 'stray value is preserved as inert array data (sanity: .includes() is a safe read regardless of content)');
  assert(new Set(legacy.unlockedOriginIds).has('__proto__'), 'Set-based membership check is equally safe regardless of content');
}

// ---- 6. run.js applyEffects + legacy/epilogue don't crash on edge states ----
{
  const state = createInitialState();
  state.character.name = 'Test Runner';
  state.character.health.max = 50; state.character.health.current = 50;
  run.applyEffects(state, state.character, { faction: { ashgrove: 500 }, health: -1000, items: ['cs_ration_bar', 'cs_ration_bar'], flags: { test_flag: true }, companionRecruit: 'cp_reyes', journal: 'j_awakening' });
  assert(state.factions.ashgrove === 100, 'faction delta clamps to +100 max');
  assert(state.character.health.current === 0, 'health delta clamps at 0, does not go negative');
  assert(state.character.inventory.find((i) => i.itemId === 'cs_ration_bar')?.qty === 2, 'repeated item grants stack quantity');
  assert(state.character.companions.some((c) => c.companionId === 'cp_reyes'), 'companion recruit adds companion');
  const ending = run.checkRunEnding(state);
  assert(ending === 'health_loss', 'checkRunEnding detects zero health');
  const epilogue = run.composeEpilogue(state, 'health_loss');
  assert(typeof epilogue.personal === 'string' && epilogue.personal.includes('Test Runner'), 'epilogue personal fate includes character name');
  assert(typeof epilogue.city === 'string' && epilogue.city.length > 0, 'epilogue city-state text generated');
  assert(Array.isArray(epilogue.companionLines), 'epilogue companion lines is an array');
  const pts = run.computeLegacyPoints(state, 'health_loss');
  assert(Number.isFinite(pts) && pts >= 0, `legacy points computed as a sane number (${pts})`);
}

// ---- 7. every encounter's items/flags/companion references point at real data ----
{
  const validCompanionIds = new Set(['cp_reyes', 'cp_sable', 'cp_juno', 'cp_static', 'cp_ortiz']);
  let badRefs = 0;
  for (const enc of Object.values(ENCOUNTERS)) {
    for (const choice of enc.choices) {
      for (const branch of [choice.success, choice.fail]) {
        if (!branch) continue;
        const eff = branch.effects || {};
        for (const id of eff.items || []) if (!ITEMS[id]) { badRefs++; console.log('bad item ref', enc.id, id); }
        if (eff.companionRecruit && !validCompanionIds.has(eff.companionRecruit)) { badRefs++; console.log('bad companion ref', enc.id, eff.companionRecruit); }
        if (eff.journal && !('j_' === eff.journal.slice(0, 2))) { badRefs++; }
      }
    }
  }
  assert(badRefs === 0, `all encounter item/companion/journal references resolve to real data (${badRefs} bad)`);
}

// ---- 8. every enemy referenced by bestiary helper functions actually exists ----
{
  let bad = 0;
  for (const zone of ['sprawl', 'canopy', 'liminal', 'choir']) {
    for (const tier of [1, 2, 3]) {
      const pool = enemiesForZoneAndTier(zone, tier);
      for (const e of pool) if (!ENEMIES[e.id]) bad++;
    }
    const boss = bossForZone(zone);
    if (!boss || !ENEMIES[boss.id]) bad++;
  }
  assert(bad === 0, `all zone/tier enemy pools and bosses resolve (${bad} bad)`);
}

console.log('\n' + (failures === 0 ? `ALL CHECKS PASSED` : `${failures} CHECK(S) FAILED`));
process.exit(failures === 0 ? 0 : 1);

// Boot + the GameController: the single orchestrator that owns persisted
// state (via Store), the Legacy meta-progression, and transient runtime
// objects that are deliberately NOT persisted (the live RNG stream, an
// in-progress combat, a resolved encounter) — see engine/save.js for why
// combat is never trusted from a save.

import { Store, createInitialState, createInitialLegacy, clamp } from './engine/state.js';
import { loadGame, saveGame, clearGame, loadLegacy, saveLegacy, exportSaveFile, importSaveFile, sanitizeName } from './engine/save.js';
import { Rng, makeSeed } from './engine/rng.js';
import { flash as flashDom } from './engine/dom.js';
import { ORIGINS, startingHealthFor, startingPowerFor } from './data/stats.js';
import { getItem, ITEMS } from './data/items.js';
import { TUTORIAL_ENCOUNTER } from './data/content.js';
import {
  generateNodeMap, findNode, reachableNodeIds, pickEnemiesForNode, pickEncounterForNode,
  applyEffects, rollLoot, computeLegacyPoints, causeOfDeathText, composeEpilogue,
  applyLegacyUnlocks, checkRunEnding, advanceCycle, CYCLES_PER_RUN,
} from './systems/run.js';
import {
  startCombat, playerBasicAttack, playerUseAbility, playerUseConsumable,
  playerUseAllyAction, playerFlee, endPlayerTurn,
} from './systems/combat.js';
import { effectiveStats, resolveCheck } from './systems/checks.js';
import { renderScreen } from './ui/screens.js';

// Phases whose meaning depends on runtime-only fields (this.combat,
// this.activeEncounter, this.epilogueData) that are never persisted.
// Resuming into one of these from a save (including one resurrected by the
// beforeunload handler below) would render a broken, contextless screen —
// so the constructor redirects them to the nearest safe, resumable phase.
const TRANSIENT_PHASES = new Set(['combat', 'encounter', 'epilogue']);

class GameController {
  constructor(root) {
    this.root = root;
    this.legacy = applyLegacyUnlocks(loadLegacy() || createInitialLegacy());
    const loaded = loadGame();
    let initial = loaded || createInitialState();
    if (initial.phase === 'epilogue') {
      // The run that reached this epilogue is definitively over (permadeath
      // already resolved) — there is no epilogueData to resume it with, and
      // resuming into 'map'/'hub' would let a dead character keep playing.
      // The only correct resume point is a fresh state at the title screen.
      initial = createInitialState();
    } else if (TRANSIENT_PHASES.has(initial.phase)) {
      initial.phase = initial.run.nodeMap ? 'map' : (initial.character?.originId ? 'hub' : 'title');
    }
    this.store = new Store(initial);
    this.rng = new Rng(initial.run.seed || makeSeed());

    // transient runtime-only fields, never persisted
    this.combat = null;
    this.inTutorialCombat = false;
    this.tutorialSafetyUsed = false;
    this.tutorialStep = 0;
    this.activeEncounter = null;
    this.encounterResult = null;
    this.activeNodeId = null;
    this.pendingAbilityItemId = null;
    this.pendingEndingAfterEncounter = null;
    this.epilogueData = null;
    this.epilogueLegacyPoints = 0;
    this.draftName = '';
    this.draftOriginId = null;
  }

  flash(msg) { flashDom(this.root, msg); }

  persistAndRender(shouldSave = true) {
    if (shouldSave) saveGame(this.store.getState());
    renderScreen(this.root, this);
  }

  // ---------------- title / character creation ----------------

  setDraftName(v) { this.draftName = v; }
  setDraftOrigin(id) { this.draftOriginId = id; this.persistAndRender(false); }

  goToCharCreate() {
    this.draftOriginId = this.legacy.unlockedOriginIds[0] || 'bloom_orphan';
    this.store.getState().phase = 'charcreate';
    this.persistAndRender(false);
  }

  confirmCharacter() {
    const originId = this.draftOriginId;
    const origin = ORIGINS[originId];
    if (!origin) { this.flash('Choose an Origin first.'); return; }
    const state = createInitialState();
    state.character.name = sanitizeName(this.draftName);
    state.character.originId = originId;
    state.character.stats = { ...origin.stats };
    const maxHealth = startingHealthFor(origin.stats);
    const maxPower = startingPowerFor(origin.stats);
    state.character.health = { current: maxHealth, max: maxHealth };
    state.character.power = { current: maxPower, max: maxPower };
    state.character.inventory = origin.startingItems.map((id) => ({ itemId: id, qty: 1 }));
    for (const id of origin.startingItems) {
      const item = getItem(id);
      if (!item) continue;
      if (item.type === 'weapon') state.character.equipped.weapon = id;
      else if (item.type === 'armor') state.character.equipped.armor = id;
      else if (item.type === 'cyberware') state.character.equipped.cyberware.push(id);
      else if (item.type === 'augment') state.character.equipped.augments.push(id);
    }
    state.factions = { ashgrove: 0, commons: 0, undertow: 0, choir: 0, wardens: 0, ...origin.startingFactions };
    state.flags = { ...origin.startingFlags };
    state.run.seed = makeSeed();
    state.run.cycle = 1;
    state.phase = this.legacy.perks.tutorialSeen ? 'hub' : 'tutorial';
    this.rng = new Rng(state.run.seed);
    this.tutorialStep = 0;
    this.tutorialSafetyUsed = false;
    this.draftName = '';
    this.draftOriginId = null;
    this.store.setState(() => state);
    this.persistAndRender();
  }

  abandonRun() {
    if (!window.confirm('Abandon this character now? This is permanent — the same as any other death, just one you chose yourself.')) return;
    clearGame();
    this.store.setState(() => createInitialState());
    this.activeEncounter = null; this.combat = null; this.epilogueData = null;
    this.persistAndRender(false);
  }

  exportSave() { exportSaveFile(this.store.getState()); }

  importSave(file) {
    // Deliberately two separate try/catch scopes: the outer .catch() is for
    // "this file failed to parse/validate as a save" (importSaveFile's own
    // errors). Rendering the now-trusted, sanitized state should never
    // throw, but if some future bug made it, that's a different failure
    // (a render bug, not a bad file) and must not get mislabeled as one by
    // this same handler -- that's exactly what let a real crash hide
    // during security testing of this feature.
    importSaveFile(file).then((validated) => {
      this.store.setState(() => validated);
      this.rng = new Rng(validated.run.seed || makeSeed());
      try {
        this.flash('Save imported.');
        this.persistAndRender();
      } catch (renderErr) {
        console.error('Render failed after a successfully validated save import:', renderErr);
        this.store.setState(() => createInitialState());
        this.flash('That save loaded but couldn’t be displayed safely, so it was not kept. Starting fresh.');
        this.persistAndRender(false);
      }
    }).catch((err) => this.flash(err.message));
  }

  // ---------------- tutorial: "The Awakening" ----------------

  tutorialStartCombat() {
    this.inTutorialCombat = true;
    this.combat = startCombat(this.rng, ['en_scrap_hound']);
    this.persistAndRender();
  }

  tutorialAdvance() {
    if (this.tutorialStep === 0) { this.tutorialStep = 1; this.tutorialStartCombat(); return; }
    if (this.tutorialStep === 2) { this.tutorialStep = 3; this.persistAndRender(); return; }
    if (this.tutorialStep === 3) { this.finishTutorial(); return; }
  }

  finishTutorial() {
    this.legacy.perks = { ...this.legacy.perks, tutorialSeen: true };
    saveLegacy(this.legacy);
    const state = this.store.getState();
    state.phase = 'hub';
    this.persistAndRender();
  }

  // ---------------- hub ----------------

  enterMap() {
    const state = this.store.getState();
    if (!state.run.nodeMap) state.run.nodeMap = generateNodeMap(state.run.seed, state.run.cycle);
    state.phase = 'map';
    this.persistAndRender();
  }

  equipItem(itemId) {
    const item = getItem(itemId);
    if (!item) return;
    const eq = this.store.getState().character.equipped;
    if (item.type === 'weapon') eq.weapon = itemId;
    else if (item.type === 'armor') eq.armor = itemId;
    else if (item.type === 'cyberware') {
      if (eq.cyberware.includes(itemId)) return;
      if (eq.cyberware.length >= 2) { this.flash('Unequip a cyberware slot first (max 2).'); return; }
      eq.cyberware.push(itemId);
    } else if (item.type === 'augment') {
      if (eq.augments.includes(itemId)) return;
      if (eq.augments.length >= 2) { this.flash('Unequip an augment slot first (max 2).'); return; }
      eq.augments.push(itemId);
    }
    this.persistAndRender();
  }

  unequipItem(type, itemId) {
    const eq = this.store.getState().character.equipped;
    if (type === 'weapon') eq.weapon = null;
    else if (type === 'armor') eq.armor = null;
    else if (type === 'cyberware') eq.cyberware = eq.cyberware.filter((id) => id !== itemId);
    else if (type === 'augment') eq.augments = eq.augments.filter((id) => id !== itemId);
    this.persistAndRender();
  }

  useConsumableInHub(itemId) {
    const state = this.store.getState();
    const item = getItem(itemId);
    const stack = state.character.inventory.find((i) => i.itemId === itemId);
    if (!item || item.type !== 'consumable' || !stack) return;
    stack.qty -= 1;
    state.character.inventory = state.character.inventory.filter((i) => i.qty > 0);
    const c = state.character;
    if (item.effect === 'heal') c.health.current = clamp(c.health.current + item.value, 0, c.health.max);
    if (item.effect === 'power') c.power.current = clamp(c.power.current + item.value, 0, c.power.max);
    if (item.effect === 'heat') c.heat = clamp(c.heat + item.value, 0, 100);
    if (item.effect === 'bloomstrain') c.bloomstrain = clamp(c.bloomstrain + item.value, 0, 100);
    this.persistAndRender();
  }

  // ---------------- map / encounters ----------------

  selectNode(nodeId) {
    const state = this.store.getState();
    const reachable = reachableNodeIds(state.run.nodeMap, state.run.currentNodeId);
    if (!reachable.includes(nodeId)) return;
    const node = findNode(state.run.nodeMap, nodeId);
    this.activeNodeId = nodeId;
    if (node.kind === 'combat' || node.kind === 'boss') {
      const enemyIds = pickEnemiesForNode(this.rng, node, state.run.cycle);
      this.combat = startCombat(this.rng, enemyIds);
      state.phase = 'combat';
    } else {
      this.activeEncounter = pickEncounterForNode(node, state.run.cycle, state.character, state.run.usedEncounterIds);
      this.encounterResult = null;
      state.phase = 'encounter';
    }
    this.persistAndRender();
  }

  resolveChoice(choiceIndex) {
    const state = this.store.getState();
    const encounter = this.activeEncounter;
    const choice = encounter.choices[choiceIndex];
    const stats = effectiveStats(state.character, ITEMS);
    const result = resolveCheck(this.rng, stats[choice.stat], choice.difficulty);
    const outcome = result.success ? choice.success : (choice.fail || choice.success);
    applyEffects(state, state.character, outcome.effects);
    if (encounter.id !== TUTORIAL_ENCOUNTER.id) {
      state.run.usedEncounterIds = [...state.run.usedEncounterIds, encounter.id];
    }
    this.encounterResult = { text: outcome.text, success: result.success, certain: result.certain };
    const ending = checkRunEnding(state);
    if (ending) this.pendingEndingAfterEncounter = ending;
    this.persistAndRender();
  }

  finishEncounter() {
    const state = this.store.getState();
    if (this.tutorialStep === 2) {
      this.activeEncounter = null; this.encounterResult = null;
      this.tutorialStep = 3;
      this.persistAndRender();
      return;
    }
    if (this.pendingEndingAfterEncounter) {
      const ending = this.pendingEndingAfterEncounter;
      this.pendingEndingAfterEncounter = null;
      this.activeEncounter = null; this.encounterResult = null;
      this.beginEpilogue(ending);
      return;
    }
    const nodeId = this.activeNodeId;
    state.run.completedNodeIds = [...state.run.completedNodeIds, nodeId];
    state.run.currentNodeId = nodeId;
    this.activeEncounter = null;
    this.encounterResult = null;
    state.phase = 'map';
    this.persistAndRender();
  }

  // ---------------- combat ----------------

  combatAttack(targetId) {
    const res = playerBasicAttack(this.combat, this.rng, this.store.getState().character, targetId);
    if (!res.ok) this.flash(res.reason);
    this.afterCombatAction();
  }
  combatAbility(itemId, targetId) {
    const res = playerUseAbility(this.combat, this.rng, this.store.getState().character, itemId, targetId);
    if (!res.ok) this.flash(res.reason);
    this.afterCombatAction();
  }
  combatConsumable(itemId) {
    const res = playerUseConsumable(this.combat, this.store.getState().character, itemId);
    if (!res.ok) this.flash(res.reason);
    this.afterCombatAction();
  }
  combatAlly() {
    const res = playerUseAllyAction(this.combat, this.rng, this.store.getState().character);
    if (!res.ok) this.flash(res.reason);
    this.afterCombatAction();
  }
  combatEndTurn() {
    endPlayerTurn(this.combat, this.rng, this.store.getState().character);
    this.afterCombatAction();
  }
  combatFlee() {
    playerFlee(this.combat, this.rng, this.store.getState().character);
    this.afterCombatAction();
  }

  afterCombatAction() {
    this.pendingAbilityItemId = null;
    if (this.combat && this.combat.outcome) this.handleCombatOutcome();
    else this.persistAndRender();
  }

  handleCombatOutcome() {
    const outcome = this.combat.outcome;
    const state = this.store.getState();

    if (this.inTutorialCombat) {
      if (outcome === 'defeat' && !this.tutorialSafetyUsed) {
        this.tutorialSafetyUsed = true;
        state.character.health.current = 1;
        this.combat.outcome = null;
        this.combat.log = [...this.combat.log, 'The Memory-Echo catches the blow that should have ended this. "Not yet," it says. "Not like this."'];
        this.persistAndRender();
        return;
      }
      this.combat = null;
      this.inTutorialCombat = false;
      this.tutorialStep = 2;
      this.activeEncounter = TUTORIAL_ENCOUNTER;
      this.encounterResult = null;
      this.persistAndRender();
      return;
    }

    if (outcome === 'victory' || outcome === 'fled') {
      const nodeId = this.activeNodeId;
      const node = findNode(state.run.nodeMap, nodeId);
      let lootMsg = '';
      if (outcome === 'victory') {
        const lootId = rollLoot(this.rng, node, state.run.cycle);
        if (lootId) {
          const existing = state.character.inventory.find((i) => i.itemId === lootId);
          if (existing) existing.qty += 1; else state.character.inventory.push({ itemId: lootId, qty: 1 });
          lootMsg = `Recovered: ${getItem(lootId).name}.`;
        }
        if (node.kind === 'boss') {
          if (state.run.cycle >= CYCLES_PER_RUN) {
            this.combat = null;
            this.beginEpilogue('boss_victory');
            return;
          }
          advanceCycle(state);
          this.combat = null;
          state.phase = 'hub';
          this.persistAndRender();
          if (lootMsg) this.flash(lootMsg);
          this.flash('Cycle complete. The Sprawl resets around you — harder, this time.');
          return;
        }
      }
      state.run.completedNodeIds = [...state.run.completedNodeIds, nodeId];
      state.run.currentNodeId = nodeId;
      this.combat = null;
      state.phase = 'map';
      this.persistAndRender();
      if (lootMsg) this.flash(lootMsg);
      return;
    }

    this.combat = null;
    this.beginEpilogue(outcome === 'transformed' ? 'bloomstrain_complete' : 'health_loss');
  }

  // ---------------- epilogue ----------------

  beginEpilogue(endingType) {
    const state = this.store.getState();
    this.epilogueData = composeEpilogue(state, endingType);
    this.epilogueLegacyPoints = computeLegacyPoints(state, endingType);
    this.legacy.legacyPoints += this.epilogueLegacyPoints;
    this.legacy.pastCharacters = [...this.legacy.pastCharacters, {
      name: state.character.name,
      originId: state.character.originId,
      cycleReached: state.run.cycle,
      endingId: endingType,
      causeOfDeath: causeOfDeathText(endingType),
      timestamp: Date.now(),
    }];
    this.legacy.perks = { ...this.legacy.perks, tutorialSeen: true };
    this.legacy = applyLegacyUnlocks(this.legacy);
    saveLegacy(this.legacy);
    clearGame();
    state.phase = 'epilogue';
    this.persistAndRender(false);
  }

  returnToTitle() {
    this.epilogueData = null;
    this.store.setState(() => createInitialState());
    this.persistAndRender(false);
  }
}

function boot() {
  const root = document.getElementById('app');
  const game = new GameController(root);
  window.addEventListener('beforeunload', () => {
    // 'title' has nothing worth persisting; 'epilogue' is a run that's
    // already over (and beginEpilogue() already cleared its save on
    // purpose) -- resaving it here would resurrect a dead run on next load.
    const phase = game.store.getState().phase;
    if (phase !== 'title' && phase !== 'epilogue') saveGame(game.store.getState());
  });
  renderScreen(root, game);
}

boot();

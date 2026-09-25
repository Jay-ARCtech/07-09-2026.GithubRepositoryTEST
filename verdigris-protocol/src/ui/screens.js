// All screens. Pure(ish) render functions: read from `state` (persisted)
// and `game` (the controller, for transient runtime fields and actions),
// return a DOM subtree built with h(). No screen ever builds an HTML
// string — see engine/dom.js.

import { h, clear } from '../engine/dom.js';
import {
  meter, coreMeters, statGrid, factionList, choiceButton, panel, narrative,
  topbar, btn, pill, logPanel,
} from './components.js';
import { ORIGINS, ORIGIN_ORDER, STATS } from '../data/stats.js';
import { getItem, ITEMS } from '../data/items.js';
import { ZONES, COMPANIONS, JOURNAL_ENTRIES } from '../data/content.js';
import { findNode, reachableNodeIds, CYCLES_PER_RUN } from '../systems/run.js';
import { effectiveStats, oddsBand } from '../systems/checks.js';

const TARGETED_ABILITIES = new Set(['overclock_strike', 'choir_whisper', 'thorn_lash', 'overgrowth_root']);

function intentLabel(intent) {
  if (!intent) return '[UNREADABLE]';
  if (intent.type === 'attack') return `[ATTACK] ${intent.dmg[0]}–${intent.dmg[1]} dmg`;
  if (intent.type === 'defend') return '[BRACE] bonus defense';
  if (intent.type === 'heal_self') return `[RECOVER] ${intent.value[0]}–${intent.value[1]} hp`;
  if (intent.type === 'drain_power') return `[DRAIN] ${intent.value} Power`;
  return '[UNKNOWN]';
}

function rarityColor(rarity) {
  return { common: 'var(--text-dim)', uncommon: 'var(--health)', rare: 'var(--bloom)', legendary: 'var(--copper)' }[rarity] || 'var(--text-dim)';
}

// ---------------- title ----------------

function TitleScreen(game) {
  const legacy = game.legacy;
  const last = legacy.pastCharacters[legacy.pastCharacters.length - 1];
  return h('div', { class: 'vp-center-screen' },
    h('div', { class: 'vp-col-flex vp-gap-lg', style: { maxWidth: '560px', textAlign: 'center', alignItems: 'center' } },
      h('div', { class: 'vp-label' }, 'A CYBERPUNK / SOLARPUNK ROGUELIKE RPG'),
      h('h1', { class: 'vp-h1' }, 'VERDIGRIS PROTOCOL'),
      h('p', { class: 'vp-narrative', style: { textAlign: 'center' } }, 'Meridian is two cities wearing one skin. You carry something both of them want. No tomorrow — just this run, and what it leaves behind.'),
      legacy.legacyPoints > 0 || legacy.pastCharacters.length > 0
        ? h('div', { class: 'vp-panel', style: { width: '100%' } },
            h('div', { class: 'vp-label' }, 'LEGACY'),
            h('p', { class: 'vp-narrative', style: { textAlign: 'left', fontSize: '14px' } },
              `${legacy.legacyPoints} Legacy Points earned across ${legacy.pastCharacters.length} character${legacy.pastCharacters.length === 1 ? '' : 's'}.`,
              last ? h('br') : '', last ? `Last: ${last.name} (${ORIGINS[last.originId]?.name || last.originId}) — ${last.causeOfDeath}` : ''))
        : '',
      h('div', { class: 'vp-row', style: { justifyContent: 'center' } },
        btn('Begin a Run', () => game.goToCharCreate())),
      h('label', { class: 'vp-btn vp-btn--ghost', style: { cursor: 'pointer' } },
        'Import Save',
        h('input', { type: 'file', accept: 'application/json', style: { display: 'none' }, onChange: (e) => { const f = e.target.files?.[0]; if (f) game.importSave(f); } })),
      h('p', { class: 'vp-footer-note' }, 'Single player. No accounts, no network calls. Your save lives in this browser — export it if you want a copy.')));
}

// ---------------- character creation ----------------

function OriginCard(game, id, selected) {
  const origin = ORIGINS[id];
  const unlocked = game.legacy.unlockedOriginIds.includes(id);
  return h('div', {
    class: `vp-card${unlocked ? ' vp-card--interactive' : ''}${selected ? ' vp-card--selected' : ''}`,
    style: { opacity: unlocked ? 1 : 0.45 },
    onClick: unlocked ? () => game.setDraftOrigin(id) : null,
  },
    h('div', { class: 'vp-h3' }, origin.name),
    h('p', { class: 'vp-narrative', style: { fontSize: '13px', margin: '6px 0' } }, origin.tagline),
    !unlocked ? h('div', { class: 'vp-mono', style: { fontSize: '10px', color: 'var(--text-faint)' } }, 'Locked — earn more Legacy Points to unlock.') : '');
}

function CharCreateScreen(game) {
  const originId = game.draftOriginId;
  const origin = originId ? ORIGINS[originId] : null;
  return h('div', { class: 'vp-screen' },
    topbar({ cycleLabel: 'CHARACTER CREATION' }),
    h('div', { class: 'vp-content' },
      h('div', { class: 'vp-field', style: { maxWidth: '360px' } },
        h('label', {}, 'NAME'),
        h('input', { class: 'vp-textinput', type: 'text', maxLength: 24, placeholder: 'Unnamed', value: game.draftName, onInput: (e) => game.setDraftName(e.target.value) })),
      h('div', { class: 'vp-label' }, 'ORIGIN — recolors dialogue and starting relationships for the whole run'),
      h('div', { class: 'vp-grid-auto' }, ...ORIGIN_ORDER.map((id) => OriginCard(game, id, id === originId))),
      origin ? h('div', { class: 'vp-panel vp-panel--tab' },
        h('h3', { class: 'vp-h3' }, origin.name),
        h('p', { class: 'vp-narrative' }, origin.description),
        h('p', { class: 'vp-mono', style: { fontSize: '11px', color: 'var(--text-dim)' } }, origin.recolorNote),
        h('div', { class: 'vp-row', style: { marginTop: '12px' } }, statGrid(origin.stats, null)),
        origin.startingContact ? h('p', { class: 'vp-narrative', style: { fontSize: '13px', marginTop: '10px' } }, h('b', {}, 'Starting contact: '), origin.startingContact) : '',
        h('div', { class: 'vp-row vp-row--wrap', style: { marginTop: '10px', gap: '8px' } },
          ...origin.startingItems.map((id) => pill(getItem(id)?.name || id, 'var(--text-dim)')))) : '',
      h('div', { class: 'vp-row', style: { justifyContent: 'space-between', marginTop: '8px' } },
        btn('Back', () => game.returnToTitle(), { ghost: true }),
        btn('Begin', () => game.confirmCharacter(), { disabled: !origin }))));
}

// ---------------- shared: encounter body ----------------

function EncounterBody(game, state, encounter, onDone) {
  const result = game.encounterResult;
  const stats = effectiveStats(state.character, ITEMS);
  return h('div', { class: 'vp-col-flex vp-gap-lg' },
    panel(narrative(encounter.body)),
    result
      ? h('div', { class: 'vp-col-flex' },
          h('div', { class: 'vp-panel', style: { borderColor: result.success ? 'var(--accent)' : 'var(--heat)' } }, narrative(result.text)),
          h('div', { class: 'vp-row' }, btn('Continue', onDone)))
      : h('div', { class: 'vp-choicelist' }, ...encounter.choices.map((choice, i) => {
          const statDef = STATS.find((s) => s.id === choice.stat);
          const band = oddsBand(stats[choice.stat], choice.difficulty);
          return choiceButton({ statShort: statDef?.short, label: choice.label, band, onClick: () => game.resolveChoice(i) });
        })));
}

function EncounterScreen(game, state) {
  const node = findNode(state.run.nodeMap, game.activeNodeId);
  return h('div', { class: 'vp-screen' },
    topbar({ zoneName: node ? (ZONES[node.zone]?.name || 'Unknown District') : '', cycleLabel: `CYCLE ${state.run.cycle}` }),
    h('div', { class: 'vp-content' }, h('h2', { class: 'vp-h2' }, game.activeEncounter.title), EncounterBody(game, state, game.activeEncounter, () => game.finishEncounter())));
}

// ---------------- shared: combat body ----------------

function AbilitySlot(game, state, itemId, type) {
  const item = getItem(itemId);
  const character = state.character;
  const combat = game.combat;
  const affordable = character.power.current >= item.powerCost && combat.playerAP >= 1;
  const selected = game.pendingAbilityItemId === itemId;
  return h('button', {
    class: `vp-card${affordable ? ' vp-card--interactive' : ''}${selected ? ' vp-card--selected' : ''}`,
    style: { textAlign: 'left', cursor: affordable ? 'pointer' : 'not-allowed', opacity: affordable ? 1 : 0.5, all: 'unset', display: 'block', padding: '10px 12px' },
    disabled: !affordable,
    onClick: affordable ? () => {
      if (TARGETED_ABILITIES.has(item.ability)) { game.pendingAbilityItemId = itemId; game.persistAndRender(false); }
      else game.combatAbility(itemId, null);
    } : null,
  },
    h('div', { class: 'vp-row vp-row--between' }, h('span', { class: 'vp-mono', style: { fontSize: '12px' } }, item.name), h('span', { class: 'vp-mono', style: { fontSize: '10px', color: 'var(--accent)' } }, `${item.powerCost}⚡`)),
    type === 'augment' ? h('div', { class: 'vp-mono', style: { fontSize: '9px', color: 'var(--bloom)' } }, `+${item.bloomCost} Bloomstrain on use`) : '');
}

function CombatBody(game, state) {
  const combat = game.combat;
  const character = state.character;
  const targetingAbility = game.pendingAbilityItemId ? getItem(game.pendingAbilityItemId) : null;
  const weapon = character.equipped.weapon ? getItem(character.equipped.weapon) : null;
  const requiredAp = targetingAbility ? 1 : (weapon?.apCost ?? 1);
  const canAct = combat.turn === 'player' && !combat.outcome && combat.playerAP >= requiredAp;

  const enemyCards = combat.enemies.map((e) => {
    const alive = e.health > 0;
    const clickable = alive && canAct;
    return h('button', {
      class: `vp-card${clickable ? ' vp-card--interactive' : ''}`,
      style: { textAlign: 'left', opacity: alive ? 1 : 0.4, all: 'unset', display: 'block', cursor: clickable ? 'pointer' : 'default', padding: '14px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '10px' },
      disabled: !clickable,
      onClick: clickable ? () => { targetingAbility ? game.combatAbility(targetingAbility.id, e.instanceId) : game.combatAttack(e.instanceId); } : null,
    },
      h('div', { class: 'vp-row vp-row--between' }, h('span', { class: 'vp-h3' }, e.name), h('span', { class: 'vp-mono', style: { fontSize: '11px' } }, `${Math.max(0, e.health)}/${e.maxHealth}`)),
      h('div', { class: 'vp-meter__track', style: { marginTop: '8px' } }, h('div', { class: 'vp-meter__fill vp-meter__fill--heat', style: { width: Math.max(0, (e.health / e.maxHealth) * 100) + '%' } })),
      alive ? h('div', { class: 'vp-mono', style: { fontSize: '10px', color: 'var(--text-dim)', marginTop: '8px' } }, intentLabel(e.nextIntent)) : h('div', { class: 'vp-mono', style: { fontSize: '10px', color: 'var(--text-faint)', marginTop: '8px' } }, 'Down.'));
  });

  const consumables = character.inventory.filter((i) => getItem(i.itemId)?.type === 'consumable');
  const companion = character.companions.filter((c) => c.alive && c.bond >= 10).sort((a, b) => b.bond - a.bond)[0];

  const actionBar = h('div', { class: 'vp-col-flex' },
    h('div', { class: 'vp-label' }, `YOUR TURN — ${combat.playerAP} AP` + (targetingAbility ? ` — select a target for ${targetingAbility.name}` : '')),
    targetingAbility ? h('div', { class: 'vp-row' }, btn('Cancel targeting', () => { game.pendingAbilityItemId = null; game.persistAndRender(false); }, { ghost: true })) : '',
    character.equipped.cyberware.length || character.equipped.augments.length
      ? h('div', { class: 'vp-col-flex' },
          h('div', { class: 'vp-label' }, 'ABILITIES'),
          h('div', { class: 'vp-grid-auto' },
            ...character.equipped.cyberware.map((id) => AbilitySlot(game, state, id, 'cyberware')),
            ...character.equipped.augments.map((id) => AbilitySlot(game, state, id, 'augment'))))
      : '',
    consumables.length ? h('div', { class: 'vp-col-flex' },
      h('div', { class: 'vp-label' }, 'ITEMS'),
      h('div', { class: 'vp-grid-auto' }, ...consumables.map((stack) => {
        const item = getItem(stack.itemId);
        return h('button', { class: 'vp-card vp-card--interactive', style: { all: 'unset', cursor: 'pointer', display: 'block', padding: '10px 12px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '10px' }, onClick: () => game.combatConsumable(stack.itemId) },
          h('div', { class: 'vp-row vp-row--between' }, h('span', { class: 'vp-mono', style: { fontSize: '12px' } }, item.name), h('span', { class: 'vp-mono', style: { fontSize: '10px', color: 'var(--text-dim)' } }, `x${stack.qty}`)));
      }))) : '',
    h('div', { class: 'vp-row vp-row--wrap' },
      companion && !combat.allyActionUsed ? btn(`${COMPANIONS[companion.companionId].name}: ${COMPANIONS[companion.companionId].bondAbility.name}`, () => game.combatAlly(), { ghost: true }) : '',
      btn('End Turn', () => game.combatEndTurn()),
      btn('Flee', () => game.combatFlee(), { ghost: true })));

  return h('div', { class: 'vp-main' },
    h('div', { class: 'vp-col vp-col--left' }, coreMeters(character), statGrid(effectiveStats(character, ITEMS), null),
      meter('Power', character.power.current, character.power.max, 'power')),
    h('div', { class: 'vp-content' },
      h('div', { class: 'vp-grid-auto' }, ...enemyCards),
      combat.turn === 'player' && !combat.outcome ? actionBar : h('p', { class: 'vp-mono', style: { color: 'var(--text-dim)' } }, 'Resolving...'),
      logPanel(combat.log)));
}

function CombatScreen(game, state) {
  const node = findNode(state.run.nodeMap, game.activeNodeId);
  return h('div', { class: 'vp-screen' },
    topbar({ zoneName: node ? (ZONES[node.zone]?.name || 'Unknown District') : '', cycleLabel: `CYCLE ${state.run.cycle} · COMBAT` }),
    CombatBody(game, state));
}

// ---------------- tutorial ----------------

function mentorIntroText(game) {
  const past = game.legacy.pastCharacters;
  if (!past.length) {
    return 'A presence surfaces in your thoughts, unmistakably someone else’s, unmistakably kind about it. "First time," it says. "The Bloomstrain just went active. I know that’s a lot. I’m not going to explain all of it at once — I’m going to show you the parts that’ll keep you alive tonight."';
  }
  const last = past[past.length - 1];
  return `A presence surfaces in your thoughts — fragments of someone who carried this before you. "${last.name}," it says, like a name it’s still getting used to not being. "${last.causeOfDeath} That’s as far as I got. I’m not going to let you find out the hard way what I already know. Pay attention."`;
}

function TutorialScreen(game, state) {
  const step = game.tutorialStep;
  if (step === 0) {
    return h('div', { class: 'vp-screen' },
      topbar({ cycleLabel: 'THE AWAKENING' }),
      h('div', { class: 'vp-content' },
        panel(narrative(mentorIntroText(game))),
        panel(narrative('Three things worth watching, always visible, never hidden from you: Health, which ends your story if it hits zero. Heat, which is how hard Ashgrove is looking for you right now. And the Bloomstrain — the thing under your collarbone that brought you here, and that is, on its own schedule, going to finish becoming whatever it’s becoming. That one doesn’t go down. Only up. Everything you do this run happens against that clock.')),
        h('div', { class: 'vp-row' }, btn('Continue', () => game.tutorialAdvance()))));
  }
  if (step === 1) {
    return h('div', { class: 'vp-screen' },
      topbar({ cycleLabel: 'THE AWAKENING · GUIDED COMBAT' }),
      h('div', { class: 'vp-content' }, panel(narrative('"Something’s actually here. A scrap hound — not much of a fight, which is the point. Watch the line under its name: that’s what it’s about to do. It always tells you first."')), ''),
      CombatBody(game, state));
  }
  if (step === 2) {
    return h('div', { class: 'vp-screen' },
      topbar({ cycleLabel: 'THE AWAKENING · ONE MORE THING' }),
      h('div', { class: 'vp-content' }, h('h2', { class: 'vp-h2' }, game.activeEncounter.title), EncounterBody(game, state, game.activeEncounter, () => game.finishEncounter())));
  }
  return h('div', { class: 'vp-screen' },
    topbar({ cycleLabel: 'THE AWAKENING · READY' }),
    h('div', { class: 'vp-content' },
      panel(narrative('"That’s the shape of it. Fights are yours to read before they happen. Choices tell you your odds before you take them. None of what comes next is going to be easy — it starts hard and it does not get gentler because you survived longer. But nothing in it is going to be hidden from you either. That part’s a promise."')),
      panel(narrative('"I have to go. Whatever you do with this — make it yours."')),
      h('div', { class: 'vp-row' }, btn('Begin the run', () => game.tutorialAdvance()))));
}

// ---------------- hub ----------------

function InventoryRow(game, stack) {
  const item = getItem(stack.itemId);
  if (!item) return '';
  const character = game.store.getState().character;
  const equipped = (item.type === 'weapon' && character.equipped.weapon === item.id)
    || (item.type === 'armor' && character.equipped.armor === item.id)
    || (item.type === 'cyberware' && character.equipped.cyberware.includes(item.id))
    || (item.type === 'augment' && character.equipped.augments.includes(item.id));
  return h('div', { class: 'vp-card' },
    h('div', { class: 'vp-row vp-row--between' },
      h('div', {},
        h('span', { class: 'vp-h3' }, item.name), ' ',
        pill(item.rarity, rarityColor(item.rarity)),
        stack.qty > 1 ? h('span', { class: 'vp-mono', style: { fontSize: '11px', color: 'var(--text-dim)' } }, ` x${stack.qty}`) : ''),
      equipped ? pill('EQUIPPED', 'var(--accent)')
        : item.type === 'consumable'
          ? btn('Use', () => game.useConsumableInHub(item.id), { ghost: true })
          : btn('Equip', () => game.equipItem(item.id), { ghost: true })),
    h('p', { class: 'vp-narrative', style: { fontSize: '12px', margin: '8px 0 0' } }, item.desc));
}

function EquippedSlot(label, item, onUnequip) {
  return h('div', { class: 'vp-card' },
    h('div', { class: 'vp-label' }, label),
    item ? h('div', { class: 'vp-row vp-row--between', style: { marginTop: '6px' } }, h('span', { class: 'vp-h3', style: { fontSize: '13px' } }, item.name), btn('Unequip', onUnequip, { ghost: true }))
      : h('p', { class: 'vp-mono', style: { fontSize: '11px', color: 'var(--text-faint)', marginTop: '6px' } }, 'Empty'));
}

function HubScreen(game, state) {
  const character = state.character;
  const origin = ORIGINS[character.originId];
  const weapon = character.equipped.weapon ? getItem(character.equipped.weapon) : null;
  const armor = character.equipped.armor ? getItem(character.equipped.armor) : null;

  return h('div', { class: 'vp-screen' },
    topbar({ cycleLabel: `CYCLE ${state.run.cycle} of ${CYCLES_PER_RUN} · THE SAFEHOUSE`, heat: character.heat, bloomstrain: character.bloomstrain }),
    h('div', { class: 'vp-main' },
      h('div', { class: 'vp-col vp-col--left' },
        h('div', {}, h('div', { class: 'vp-h3' }, character.name), h('div', { class: 'vp-mono', style: { fontSize: '11px', color: 'var(--text-dim)' } }, origin?.name || '')),
        coreMeters(character),
        statGrid(effectiveStats(character, ITEMS), null),
        h('div', { class: 'vp-spacer' }),
        h('div', {},
          h('div', { class: 'vp-label' }, 'FACTION STANDING'),
          h('div', { style: { marginTop: '8px' } }, factionList(state.factions)))),
      h('div', { class: 'vp-content' },
        h('div', { class: 'vp-row', style: { justifyContent: 'space-between' } },
          btn('Enter the Sprawl', () => game.enterMap()),
          h('div', { class: 'vp-row' }, btn('Export Save', () => game.exportSave(), { ghost: true }), btn('Abandon Run', () => game.abandonRun(), { danger: true }))),

        h('div', { class: 'vp-label' }, 'EQUIPPED'),
        h('div', { class: 'vp-grid-auto' },
          EquippedSlot('WEAPON', weapon, () => game.unequipItem('weapon', weapon?.id)),
          EquippedSlot('ARMOR', armor, () => game.unequipItem('armor', armor?.id)),
          ...character.equipped.cyberware.map((id) => EquippedSlot('CYBERWARE', getItem(id), () => game.unequipItem('cyberware', id))),
          ...character.equipped.augments.map((id) => EquippedSlot('BIO-AUGMENT', getItem(id), () => game.unequipItem('augment', id)))),

        character.companions.length ? h('div', { class: 'vp-col-flex' },
          h('div', { class: 'vp-label' }, 'COMPANIONS'),
          h('div', { class: 'vp-grid-auto' }, ...character.companions.map((c) => {
            const def = COMPANIONS[c.companionId];
            return h('div', { class: 'vp-card' },
              h('div', { class: 'vp-row vp-row--between' }, h('span', { class: 'vp-h3', style: { fontSize: '14px' } }, def.name), pill(c.alive ? `bond ${c.bond}` : 'lost', c.alive ? 'var(--accent)' : 'var(--danger)')),
              h('p', { class: 'vp-narrative', style: { fontSize: '12px', margin: '6px 0 0' } }, def.tagline));
          }))) : '',

        h('div', { class: 'vp-label' }, 'INVENTORY'),
        character.inventory.length
          ? h('div', { class: 'vp-grid-auto' }, ...character.inventory.map((stack) => InventoryRow(game, stack)))
          : h('p', { class: 'vp-mono', style: { fontSize: '12px', color: 'var(--text-faint)' } }, 'Nothing but what you’re carrying.'),

        character.journal.length ? h('div', { class: 'vp-col-flex' },
          h('div', { class: 'vp-label' }, 'JOURNAL'),
          h('div', { class: 'vp-col-flex' }, ...character.journal.map((id) => {
            const e = JOURNAL_ENTRIES[id];
            if (!e) return '';
            return h('div', { class: 'vp-card' }, h('div', { class: 'vp-h3', style: { fontSize: '13px' } }, e.title), h('p', { class: 'vp-narrative', style: { fontSize: '12px', margin: '6px 0 0' } }, e.body));
          }))) : '')));
}

// ---------------- map ----------------

function nodeKindLabel(kind) {
  return { combat: 'Combat', skill: 'Skill Check', faction: 'Faction', cache: 'Cache', companion: 'Companion', rest: 'Rest', boss: 'CONFRONTATION' }[kind] || kind;
}

function MapScreen(game, state) {
  const nodeMap = state.run.nodeMap;
  if (!nodeMap) {
    return h('div', { class: 'vp-center-screen' }, h('div', { class: 'vp-col-flex' }, h('p', {}, 'No map generated.'), btn('Return to Safehouse', () => { state.phase = 'hub'; game.persistAndRender(); })));
  }
  const reachable = new Set(reachableNodeIds(nodeMap, state.run.currentNodeId));
  const completed = new Set(state.run.completedNodeIds);

  return h('div', { class: 'vp-screen' },
    topbar({ cycleLabel: `CYCLE ${state.run.cycle} of ${CYCLES_PER_RUN}`, heat: state.character.heat, bloomstrain: state.character.bloomstrain }),
    h('div', { class: 'vp-content' },
      h('div', { class: 'vp-nodemap' }, ...nodeMap.layers.map((layer) =>
        h('div', { class: 'vp-nodemap__row' }, ...layer.map((node) => {
          const isReachable = reachable.has(node.id);
          const isDone = completed.has(node.id);
          const isCurrent = state.run.currentNodeId === node.id;
          return h('button', {
            class: `vp-node${isDone ? ' vp-node--done' : ''}${isCurrent ? ' vp-node--current' : ''}`,
            disabled: !isReachable,
            onClick: isReachable ? () => game.selectNode(node.id) : null,
          },
            h('span', { class: 'vp-h3', style: { fontSize: '13px' } }, nodeKindLabel(node.kind)),
            h('span', { class: 'vp-mono', style: { fontSize: '10px', color: 'var(--text-dim)' } }, (ZONES[node.zone]?.name || 'Unknown District')));
        })))),
      h('p', { class: 'vp-footer-note' }, 'Choose your path. Every node is a real cost or a real gain — there is no free node on this map.')));
}

// ---------------- epilogue ----------------

function EpilogueScreen(game) {
  const data = game.epilogueData;
  if (!data) return h('div', { class: 'vp-center-screen' }, btn('Return to Title', () => game.returnToTitle()));
  return h('div', { class: 'vp-center-screen' },
    h('div', { class: 'vp-col-flex vp-gap-lg', style: { maxWidth: '640px' } },
      h('div', { class: 'vp-label' }, 'THIS RUN, IN FULL'),
      panel(narrative(data.personal)),
      panel(narrative(data.city)),
      data.companionLines.length ? h('div', { class: 'vp-col-flex' }, ...data.companionLines.map((l) => h('p', { class: 'vp-narrative', style: { fontSize: '14px' } }, l))) : '',
      h('div', { class: 'vp-panel', style: { textAlign: 'center' } }, h('div', { class: 'vp-label' }, 'LEGACY EARNED'), h('div', { class: 'vp-h2' }, `+${game.epilogueLegacyPoints} points`)),
      h('div', { class: 'vp-row', style: { justifyContent: 'center' } }, btn('Return to Title', () => game.returnToTitle()))));
}

// ---------------- dispatcher ----------------

export function renderScreen(root, game) {
  const state = game.store.getState();
  clear(root);
  let view;
  switch (state.phase) {
    case 'charcreate': view = CharCreateScreen(game); break;
    case 'tutorial': view = TutorialScreen(game, state); break;
    case 'hub': view = HubScreen(game, state); break;
    case 'map': view = MapScreen(game, state); break;
    case 'encounter': view = EncounterScreen(game, state); break;
    case 'combat': view = CombatScreen(game, state); break;
    case 'epilogue': view = EpilogueScreen(game); break;
    case 'title':
    default: view = TitleScreen(game); break;
  }
  root.appendChild(view);
}

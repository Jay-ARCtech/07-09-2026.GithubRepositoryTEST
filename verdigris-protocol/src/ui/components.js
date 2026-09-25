// Shared render helpers. Every dynamic value flows through dom.js's h(),
// which only ever creates text nodes for strings — this file is where most
// of that untrusted data (character names, item flavor, journal text)
// actually reaches the page, so it leans entirely on that guarantee rather
// than any escaping convention.

import { h } from '../engine/dom.js';
import { STATS, FACTIONS, FACTION_ORDER } from '../data/stats.js';
import { oddsLabel } from '../systems/checks.js';
import { IconBolt, IconLeaf, IconChip, IconShield, IconHeart, IconFlame, IconSeed, IconUsers } from './icons.js';

export function meter(label, current, max, kind) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
  return h('div', { class: 'vp-meter' },
    h('div', { class: 'vp-meter__row' }, h('span', {}, label), h('span', {}, `${Math.round(current)}${max !== 100 ? `/${max}` : '%'}`)),
    h('div', { class: 'vp-meter__track' }, h('div', { class: `vp-meter__fill vp-meter__fill--${kind}`, style: { width: pct + '%' } })));
}

export function coreMeters(character) {
  return h('div', { class: 'vp-col-flex' },
    meter('Health', character.health.current, character.health.max, 'health'),
    meter('Heat', character.heat, 100, 'heat'),
    meter('Bloomstrain', character.bloomstrain, 100, 'bloom'));
}

export function statGrid(stats, focusStatId) {
  return h('div', { class: 'vp-statgrid' },
    ...STATS.map((s) => h('div', { class: `vp-statchip${s.id === focusStatId ? ' vp-statchip--focus' : ''}` },
      h('div', { class: 'vp-statchip__label' }, s.short),
      h('div', { class: 'vp-statchip__value' }, String(stats[s.id])))));
}

export function factionList(factions) {
  return h('div', { class: 'vp-factionlist' },
    ...FACTION_ORDER.map((id) => {
      const def = FACTIONS[id];
      const v = factions[id] ?? 0;
      const pct = Math.max(2, ((v + 100) / 200) * 100);
      return h('div', { class: 'vp-factionrow' },
        h('span', { class: 'vp-factionrow__label' }, def.short),
        h('div', { class: 'vp-factionrow__track' }, h('div', { class: 'vp-factionrow__fill', style: { width: pct + '%', background: def.color } })));
    }));
}

export function oddsPillClass(band) {
  return { good: 'vp-odds-good', fair: 'vp-odds-fair', poor: 'vp-odds-poor', certain: 'vp-odds-certain' }[band] || 'vp-odds-fair';
}

export function choiceButton({ statShort, label, band, disabledReason, onClick }) {
  const btn = h('button', { class: 'vp-choice', onClick, disabled: Boolean(disabledReason) },
    h('span', { class: 'vp-choice__text' }, statShort ? h('b', { class: 'vp-choice__tag' }, `[${statShort}] `) : '', label),
    h('span', { class: `vp-choice__odds ${oddsPillClass(band)}` }, disabledReason || oddsLabel(band)));
  return btn;
}

export function panel(...children) {
  return h('div', { class: 'vp-panel vp-panel--tab' }, ...children);
}

export function narrative(text) {
  return h('p', { class: 'vp-narrative' }, text);
}

export function topbar({ zoneName, cycleLabel, heat, bloomstrain, extraRight }) {
  return h('div', { class: 'vp-topbar' },
    h('div', { class: 'vp-topbar__left' },
      h('span', { class: 'vp-title-word' }, 'MERIDIAN'),
      h('span', { class: 'vp-sub' }, cycleLabel || ''),
      zoneName ? h('span', { class: 'vp-sub' }, `· ${zoneName}`) : ''),
    h('div', { class: 'vp-topbar__right' },
      typeof heat === 'number' ? h('span', { class: 'vp-sub' }, 'HEAT ', h('b', { style: { color: 'var(--heat)' } }, String(heat)), '/100') : '',
      typeof bloomstrain === 'number' ? h('span', { class: 'vp-sub' }, 'BLOOMSTRAIN ', h('b', { style: { color: 'var(--bloom)' } }, bloomstrain + '%')) : '',
      extraRight || ''));
}

export function iconSlot(itemId, ability, iconFn, color, opts = {}) {
  return h('div', { class: `vp-statchip${opts.selected ? ' vp-statchip--focus' : ''}`, style: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px', cursor: opts.onClick ? 'pointer' : 'default' }, onClick: opts.onClick, title: opts.title || '' },
    h('span', { class: 'vp-svg-icon' }, iconFn({ size: 18, color })));
}

export const TYPE_ICON = { weapon: IconBolt, cyberware: IconChip, augment: IconLeaf, armor: IconShield, consumable: IconHeart };
export { IconBolt, IconLeaf, IconChip, IconShield, IconHeart, IconFlame, IconSeed, IconUsers };

export function pill(text, colorVar) {
  return h('span', { class: 'vp-pill', style: { color: colorVar } }, text);
}

export function btn(label, onClick, opts = {}) {
  return h('button', { class: `vp-btn${opts.ghost ? ' vp-btn--ghost' : ''}${opts.danger ? ' vp-btn--danger' : ''}`, onClick, disabled: opts.disabled }, label);
}

export function logPanel(lines) {
  return h('div', { class: 'vp-log' }, ...lines.slice(-12).map((l) => h('div', {}, `› ${l}`)));
}

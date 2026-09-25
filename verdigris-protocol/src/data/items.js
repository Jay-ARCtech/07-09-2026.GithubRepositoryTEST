// Itemization. Two currencies of cost on the "better" gear, on purpose
// (DESIGN.md §6, §8): cyberware spends Essence (a permanent trade-off
// against Empathy while equipped — Shadowrun's precedent, see RESEARCH.md
// §18), bio-augments spend a little Bloomstrain progress on every use. The
// strongest ability in the room is never free.

export const RARITY = ['common', 'uncommon', 'rare', 'legendary'];

export const ITEMS = {
  // ---- weapons ----
  wp_service_pistol: { id: 'wp_service_pistol', name: 'Ashgrove Service Pistol', type: 'weapon', rarity: 'common', range: 'ranged', apCost: 1, damage: [3, 6], desc: 'Standard-issue. Every corp guard in the Sprawl carries the same one.' },
  wp_grafted_thornblade: { id: 'wp_grafted_thornblade', name: 'Grafted Thornblade', type: 'weapon', rarity: 'common', range: 'melee', apCost: 1, damage: [4, 7], desc: 'Grown, not forged, in a Canopy terrace. Still slightly warm.' },
  wp_scrap_smg: { id: 'wp_scrap_smg', name: 'Scrap-Nine SMG', type: 'weapon', rarity: 'common', range: 'ranged', apCost: 1, damage: [4, 8], desc: 'Undertow-built from three other guns. Loud. Effective. Ugly.' },
  wp_warden_baton: { id: 'wp_warden_baton', name: 'Warden Charge Baton', type: 'weapon', rarity: 'common', range: 'melee', apCost: 1, damage: [3, 5], desc: 'Issued to subdue, not to kill. You never quite believed that was the whole point of it.' },
  wp_arc_katana: { id: 'wp_arc_katana', name: 'Arc-Edge Katana', type: 'weapon', rarity: 'uncommon', range: 'melee', apCost: 1, damage: [6, 10], desc: 'Ashgrove military surplus. The edge never dulls; the capacitor whine never stops.' },
  wp_canopy_bow: { id: 'wp_canopy_bow', name: 'Canopy Recurve', type: 'weapon', rarity: 'uncommon', range: 'ranged', apCost: 1, damage: [5, 9], desc: 'Bio-composite, silent, grown to the archer’s own draw length.' },
  wp_relic_smg_mk2: { id: 'wp_relic_smg_mk2', name: 'Choir Relic SMG', type: 'weapon', rarity: 'rare', range: 'ranged', apCost: 1, damage: [7, 13], desc: 'It corrects your aim before you’ve finished flinching. You did not teach it that.' },

  // ---- cyberware (Essence cost: a permanent Empathy penalty while equipped) ----
  cw_neural_shunt: { id: 'cw_neural_shunt', name: 'Neural Shunt', type: 'cyberware', rarity: 'common', ability: 'overclock_strike', powerCost: 1, essenceCost: 1, desc: 'Shaves your reaction time. You also flinch less at things that should make you flinch.' },
  cw_optic_relay: { id: 'cw_optic_relay', name: 'Optic Relay', type: 'cyberware', rarity: 'common', ability: 'optic_camo', powerCost: 1, essenceCost: 1, desc: 'Bends light around your outline for half a second. Feels like lying with your whole body.' },
  cw_choir_earbead: { id: 'cw_choir_earbead', name: 'Choir Earbead', type: 'cyberware', rarity: 'uncommon', ability: 'choir_whisper', powerCost: 2, essenceCost: 1, desc: 'Lets you borrow the Choir’s voice for one sentence. It always sounds a little like more than one voice.' },
  cw_kinetic_frame: { id: 'cw_kinetic_frame', name: 'Kinetic Frame', type: 'cyberware', rarity: 'uncommon', ability: 'kinetic_boost', powerCost: 2, essenceCost: 2, desc: 'Subdermal actuators. Fast. The kind of fast that makes old friends flinch when you reach for something.' },
  cw_emp_knuckles: { id: 'cw_emp_knuckles', name: 'EMP Knuckles', type: 'cyberware', rarity: 'rare', ability: 'emp_pulse', powerCost: 2, essenceCost: 2, desc: 'Drops anything with a chip in it. Including, on a bad day, you.' },
  cw_ghost_ice: { id: 'cw_ghost_ice', name: 'Ghost ICE Rig', type: 'cyberware', rarity: 'legendary', ability: 'phase_step', powerCost: 3, essenceCost: 3, desc: 'Ashgrove black-budget prototype. Steps you half out of the moment that would’ve killed you. Costs plenty of the moments after.' },

  // ---- bio-augments (Bloomstrain cost per use: a little permanent clock, every time) ----
  ba_photosynth_weave: { id: 'ba_photosynth_weave', name: 'Photosynth Weave', type: 'augment', rarity: 'common', ability: 'photosynth_shield', powerCost: 1, bloomCost: 2, desc: 'A living layer under your skin that drinks light and gives back a little armor.' },
  ba_wild_bloomseed: { id: 'ba_wild_bloomseed', name: 'Wild Bloomseed Graft', type: 'augment', rarity: 'common', ability: 'thorn_lash', powerCost: 1, bloomCost: 2, desc: 'Feral cutting, never cultivated properly. It works. It also spreads, slowly, on its own schedule.' },
  ba_mycelial_graft: { id: 'ba_mycelial_graft', name: 'Mycelial Graft', type: 'augment', rarity: 'uncommon', ability: 'mycelial_link', powerCost: 2, bloomCost: 3, desc: 'Threads a healing network through you and whoever you’re touching when it fires.' },
  ba_spore_gland: { id: 'ba_spore_gland', name: 'Spore Gland', type: 'augment', rarity: 'uncommon', ability: 'spore_cloud', powerCost: 2, bloomCost: 3, desc: 'Releases a disorienting cloud on command. The command is the easy part.' },
  ba_root_talon: { id: 'ba_root_talon', name: 'Root Talon', type: 'augment', rarity: 'rare', ability: 'overgrowth_root', powerCost: 2, bloomCost: 4, desc: 'Drives a living root through whatever’s in front of you and into the floor beneath it.' },
  ba_canopy_heart: { id: 'ba_canopy_heart', name: 'Canopy Heart', type: 'augment', rarity: 'legendary', ability: 'canopy_bloom', powerCost: 3, bloomCost: 5, desc: 'A second heartbeat, grown, not born. When it fires, everyone nearby can feel it.' },

  // ---- armor ----
  ar_surplus_plating: { id: 'ar_surplus_plating', name: 'Surplus Plating', type: 'armor', rarity: 'common', defense: 2, desc: 'Decommissioned Ashgrove riot gear. Dented already; someone else took that hit first.' },
  ar_woven_bark: { id: 'ar_woven_bark', name: 'Woven Bark Vest', type: 'armor', rarity: 'common', defense: 2, desc: 'Grown as a single piece over eight weeks in a Canopy terrace. Lighter than it looks.' },
  ar_choir_lattice_mesh: { id: 'ar_choir_lattice_mesh', name: 'Lattice Mesh', type: 'armor', rarity: 'uncommon', defense: 3, desc: 'Reactive weave that shifts a half-second before the hit that would’ve landed.' },

  // ---- consumables ----
  cs_ration_bar: { id: 'cs_ration_bar', name: 'Ration Bar', type: 'consumable', rarity: 'common', effect: 'heal', value: 6, desc: 'Tastes like nothing. Keeps you standing.' },
  cs_black_market_stims: { id: 'cs_black_market_stims', name: 'Black-Market Stims', type: 'consumable', rarity: 'common', effect: 'power', value: 2, desc: 'Undertow-cut. Not FDA anything. Works fast.' },
  cs_signal_flare: { id: 'cs_signal_flare', name: 'Signal Flare', type: 'consumable', rarity: 'common', effect: 'heat', value: -15, desc: 'Burn it somewhere else. Buys you room to breathe.' },
  cs_synth_stabilizer: { id: 'cs_synth_stabilizer', name: 'Synth Stabilizer', type: 'consumable', rarity: 'uncommon', effect: 'bloomstrain', value: -5, desc: 'Rare, precious, and the only thing on the market that actually slows the Bloomstrain down. Hoard it.' },
  cs_trauma_kit: { id: 'cs_trauma_kit', name: 'Trauma Kit', type: 'consumable', rarity: 'uncommon', effect: 'heal', value: 14, desc: 'Real medical gear, not street cut. Someone paid for this once.' },
};

export function getItem(id) {
  return ITEMS[id] || null;
}

export function itemsByType(type) {
  return Object.values(ITEMS).filter((it) => it.type === type);
}

export const RARITY_WEIGHT = { common: 100, uncommon: 45, rare: 16, legendary: 4 };

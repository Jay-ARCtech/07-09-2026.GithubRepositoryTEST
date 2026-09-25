// Enemies. Every one telegraphs its NEXT action a full turn before it
// resolves (systems/combat.js rolls `nextIntent` from this weighted pool
// the moment an enemy is spawned, and again right after it acts) — this is
// the concrete implementation of the fairness rule in DESIGN.md §7: danger
// is always visible before it lands.
//
// Intent types: attack (damage range vs you or lowest-HP ally), defend
// (bonus defense next hit against it), heal_self, drain_power (saps your
// Power). Weighted pool, one roll per turn.

export const ENEMIES = {
  // ---- tier 1 ----
  en_corp_guard: { id: 'en_corp_guard', name: 'Ashgrove Guard', tier: 1, zones: ['sprawl'], health: 16, defense: 0, desc: 'Contract security, bored until it isn’t.',
    intents: [{ type: 'attack', weight: 60, dmg: [3, 6] }, { type: 'defend', weight: 25 }, { type: 'drain_power', weight: 15, value: 1 }] },
  en_undertow_thug: { id: 'en_undertow_thug', name: 'Undertow Enforcer', tier: 1, zones: ['sprawl'], health: 14, defense: 0, desc: 'Only here because Undertow doesn’t trust you today.',
    intents: [{ type: 'attack', weight: 65, dmg: [4, 6] }, { type: 'defend', weight: 20 }, { type: 'drain_power', weight: 15, value: 1 }] },
  en_feral_thornback: { id: 'en_feral_thornback', name: 'Feral Thornback', tier: 1, zones: ['canopy'], health: 18, defense: 0, desc: 'Wild Bloom growth given something like a body.',
    intents: [{ type: 'attack', weight: 55, dmg: [3, 7] }, { type: 'heal_self', weight: 25, value: [3, 6] }, { type: 'defend', weight: 20 }] },
  en_spore_drifter: { id: 'en_spore_drifter', name: 'Spore Drifter', tier: 1, zones: ['canopy'], health: 10, defense: 0, desc: 'Barely solid. Drifts, and drains.',
    intents: [{ type: 'attack', weight: 40, dmg: [2, 5] }, { type: 'drain_power', weight: 40, value: 2 }, { type: 'defend', weight: 20 }] },
  en_choir_sentinel_drone: { id: 'en_choir_sentinel_drone', name: 'Choir Sentinel', tier: 1, zones: ['choir', 'liminal'], health: 12, defense: 0, desc: 'A small watching thing. It is always already watching.',
    intents: [{ type: 'attack', weight: 50, dmg: [3, 6] }, { type: 'drain_power', weight: 35, value: 1 }, { type: 'defend', weight: 15 }] },
  en_scrap_hound: { id: 'en_scrap_hound', name: 'Scrap Hound', tier: 1, zones: ['sprawl'], health: 13, defense: 0, desc: 'Feral tech-mutt, more patched than built.',
    intents: [{ type: 'attack', weight: 70, dmg: [3, 5] }, { type: 'defend', weight: 30 }] },

  // ---- tier 2 ----
  en_corp_enforcer: { id: 'en_corp_enforcer', name: 'Ashgrove Enforcer', tier: 2, zones: ['sprawl'], health: 24, defense: 1, desc: 'The guards who show up once the guards you fought call it in.',
    intents: [{ type: 'attack', weight: 55, dmg: [5, 9] }, { type: 'defend', weight: 25 }, { type: 'drain_power', weight: 20, value: 2 }] },
  en_security_drone_mk2: { id: 'en_security_drone_mk2', name: 'Security Drone Mk.II', tier: 2, zones: ['sprawl'], health: 20, defense: 1, desc: 'Faster than the last one. They learn.',
    intents: [{ type: 'attack', weight: 50, dmg: [4, 8] }, { type: 'drain_power', weight: 30, value: 2 }, { type: 'defend', weight: 20 }] },
  en_riot_turret: { id: 'en_riot_turret', name: 'Riot Turret', tier: 2, zones: ['sprawl'], health: 30, defense: 2, desc: 'Bolted down. Doesn’t need to move to be a problem.',
    intents: [{ type: 'attack', weight: 60, dmg: [6, 10] }, { type: 'defend', weight: 40 }] },
  en_bloomback_brute: { id: 'en_bloomback_brute', name: 'Bloomback Brute', tier: 2, zones: ['canopy'], health: 32, defense: 1, desc: 'A thornback that got old and enormous instead of dying.',
    intents: [{ type: 'attack', weight: 60, dmg: [6, 10] }, { type: 'heal_self', weight: 25, value: [5, 9] }, { type: 'defend', weight: 15 }] },
  en_thorn_choir_hybrid: { id: 'en_thorn_choir_hybrid', name: 'Grafted Relay-Vine', tier: 2, zones: ['liminal'], health: 22, defense: 1, desc: 'Choir circuitry grown through a Bloom root system. Neither side meant for this to happen.',
    intents: [{ type: 'attack', weight: 45, dmg: [5, 8] }, { type: 'drain_power', weight: 30, value: 2 }, { type: 'heal_self', weight: 25, value: [4, 7] }] },
  en_undertow_enforcer: { id: 'en_undertow_enforcer', name: 'Undertow Heavy', tier: 2, zones: ['sprawl'], health: 22, defense: 1, desc: 'Undertow’s idea of a closing argument.',
    intents: [{ type: 'attack', weight: 60, dmg: [5, 9] }, { type: 'defend', weight: 25 }, { type: 'drain_power', weight: 15, value: 1 }] },
  en_netrunner: { id: 'en_netrunner', name: 'Ashgrove Netrunner', tier: 2, zones: ['sprawl'], health: 14, defense: 0, desc: 'Never gets close. Doesn’t need to.',
    intents: [{ type: 'attack', weight: 30, dmg: [3, 5] }, { type: 'drain_power', weight: 55, value: 3 }, { type: 'defend', weight: 15 }] },
  en_choir_wraith: { id: 'en_choir_wraith', name: 'Choir Wraith', tier: 2, zones: ['choir'], health: 18, defense: 0, desc: 'Mostly signal. The rest of it is enough.',
    intents: [{ type: 'attack', weight: 40, dmg: [4, 7] }, { type: 'drain_power', weight: 40, value: 3 }, { type: 'defend', weight: 20 }] },

  // ---- tier 3 (elite) ----
  en_repo_mech: { id: 'en_repo_mech', name: 'Repo Mech', tier: 3, zones: ['sprawl'], health: 42, defense: 2, desc: 'Came for the Bloomstrain. Not for you specifically. That’s not better.',
    intents: [{ type: 'attack', weight: 55, dmg: [8, 14] }, { type: 'defend', weight: 30 }, { type: 'drain_power', weight: 15, value: 2 }] },
  en_ashgrove_specialist: { id: 'en_ashgrove_specialist', name: 'Ashgrove Specialist', tier: 3, zones: ['sprawl'], health: 30, defense: 2, desc: 'Trained on cases exactly like yours.',
    intents: [{ type: 'attack', weight: 50, dmg: [7, 11] }, { type: 'defend', weight: 25 }, { type: 'drain_power', weight: 25, value: 3 }] },
  en_canopy_warden_zealot: { id: 'en_canopy_warden_zealot', name: 'Canopy Zealot', tier: 3, zones: ['canopy'], health: 34, defense: 1, desc: 'Certain the Bloom is only safe in the right hands. Certain those are theirs.',
    intents: [{ type: 'attack', weight: 50, dmg: [7, 11] }, { type: 'heal_self', weight: 30, value: [6, 10] }, { type: 'defend', weight: 20 }] },
  en_choir_construct_prime: { id: 'en_choir_construct_prime', name: 'Choir Construct', tier: 3, zones: ['choir'], health: 38, defense: 2, desc: 'A body the Choir built specifically because it wanted, for once, to be understood by hitting something.',
    intents: [{ type: 'attack', weight: 45, dmg: [7, 12] }, { type: 'drain_power', weight: 35, value: 3 }, { type: 'defend', weight: 20 }] },

  // ---- cycle bosses ----
  boss_handler_vesk: { id: 'boss_handler_vesk', name: 'VESK, Your Former Handler', tier: 4, isBoss: true, zones: ['sprawl'], health: 60, defense: 2, desc: 'Trained you personally. Still thinks that means something.',
    intents: [{ type: 'attack', weight: 50, dmg: [9, 15] }, { type: 'defend', weight: 25 }, { type: 'drain_power', weight: 25, value: 3 }] },
  boss_zealot_warden: { id: 'boss_zealot_warden', name: 'Sister Iyen, of the Canopy', tier: 4, isBoss: true, zones: ['canopy'], health: 55, defense: 1, desc: 'Believes she’s saving the Bloom from you specifically.',
    intents: [{ type: 'attack', weight: 45, dmg: [8, 14] }, { type: 'heal_self', weight: 30, value: [7, 11] }, { type: 'defend', weight: 25 }] },
  boss_choir_avatar: { id: 'boss_choir_avatar', name: 'LATTICE-Prime', tier: 4, isBoss: true, zones: ['choir'], health: 70, defense: 2, desc: 'The Choir, wearing something shaped like patience.',
    intents: [{ type: 'attack', weight: 40, dmg: [8, 13] }, { type: 'drain_power', weight: 40, value: 4 }, { type: 'defend', weight: 20 }] },
};

export function getEnemy(id) {
  return ENEMIES[id] || null;
}

export function enemiesForZoneAndTier(zone, tier) {
  return Object.values(ENEMIES).filter((e) => !e.isBoss && e.zones.includes(zone) && e.tier <= tier);
}

export function bossForZone(zone) {
  return Object.values(ENEMIES).find((e) => e.isBoss && e.zones.includes(zone)) || ENEMIES.boss_handler_vesk;
}

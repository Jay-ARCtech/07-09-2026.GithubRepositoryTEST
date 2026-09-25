// Core character-defining data: the six attributes, the five factions, and
// the six Origins that fork starting stats/gear/reputation AND recolor
// dialogue throughout the run (see DESIGN.md §3-5). Pure data — no logic.

export const STATS = [
  { id: 'body', label: 'Body', short: 'BODY', desc: 'Melee damage and accuracy, carry capacity, max Health.' },
  { id: 'reflex', label: 'Reflex', short: 'REFLEX', desc: 'Initiative, ranged accuracy, Dodge, stealth.' },
  { id: 'synth', label: 'Synth', short: 'SYNTH', desc: 'Hacking, cyberware power/reliability, crafting, tech checks.' },
  { id: 'grit', label: 'Grit', short: 'GRIT', desc: 'Resistance to Heat and stress, environmental survival, death saves.' },
  { id: 'empathy', label: 'Empathy', short: 'EMPATHY', desc: 'Dialogue checks, faction reputation swing, companion bond.' },
  { id: 'resonance', label: 'Resonance', short: 'RESON.', desc: 'Bio-augment power and Bloom actions — and how fast your Bloomstrain advances. More power, shorter story.' },
];

export const FACTIONS = {
  ashgrove: {
    id: 'ashgrove', name: 'Ashgrove Combine', short: 'Ashgrove',
    tagline: 'Patent everything. Free nothing.',
    description: 'The corporation that walled off the Sprawl and built it into an arcology economy. Wants the Bloom isolated, owned, sold back to the world one license at a time. Has a real internal reform cell that thinks this ends badly.',
    color: '#7E93A6',
  },
  commons: {
    id: 'commons', name: 'The Verdant Commons', short: 'Commons',
    tagline: 'It heals. It should be free.',
    description: 'The collective that seeded the wild Bloom into the Sprawl’s dead infrastructure and grew the Canopy. Wants the Bloom held in common. Has a purity-zealot minority that will turn on you for compromising with the wrong people.',
    color: '#6FBF8B',
  },
  undertow: {
    id: 'undertow', name: 'Undertow', short: 'Undertow',
    tagline: 'Everyone’s buying. Everyone’s selling.',
    description: 'The fixers, runners, and gang network holding the Sprawl’s underlevels together with favors and debt. Not moral. Not cruel either — just transactional, and consistent about it.',
    color: '#D9B36A',
  },
  choir: {
    id: 'choir', name: 'The Choir', short: 'Choir',
    tagline: 'It wants to talk to the Bloom. Not to you.',
    description: 'A rogue-AI collective living in Meridian’s abandoned server-arcologies. Wants the Bloom for reasons that were never human reasons to begin with. Not evil. Not aligned with you either.',
    color: '#A67ED9',
  },
  wardens: {
    id: 'wardens', name: 'Wardens', short: 'Wardens',
    tagline: 'Structure first. Ideology later.',
    description: 'Ex-corp security running contested-zone order and bounty work, independent of Ashgrove now. Wants Meridian stable more than it wants Meridian free or owned.',
    color: '#7E9ED9',
  },
};

export const FACTION_ORDER = ['ashgrove', 'commons', 'undertow', 'choir', 'wardens'];

export const ORIGINS = {
  corpo_defector: {
    id: 'corpo_defector',
    name: 'Corpo Defector',
    tagline: 'You broke your contract. It didn’t break its hold on you.',
    description: 'Ashgrove trained you, wired you, and owned the paper on your Bloomstrain’s discovery. You ran anyway. Your old handler wants you back — alive if it’s cheap, dead if it isn’t.',
    recolorNote: 'Corp dialogue options open by default; Ashgrove personnel recognize you on sight, for better and worse.',
    stats: { body: 2, reflex: 2, synth: 4, grit: 2, empathy: 1, resonance: 2 },
    startingItems: ['cw_neural_shunt', 'wp_service_pistol'],
    startingFactions: { ashgrove: -25, commons: 0, undertow: 5, choir: -10, wardens: 10 },
    startingFlags: { origin_corpo: true },
    startingContact: 'A former handler, callsign VESK, who has not decided whether to bring you in or burn the file.',
  },
  commons_raised: {
    id: 'commons_raised',
    name: 'Commons-Raised',
    tagline: 'You grew up believing the Bloom belongs to everyone. You still do.',
    description: 'Raised in the Canopy’s grow-terraces, your Bloomstrain was cultivated, not stolen. Ashgrove considers you unlicensed property. The Commons considers you family — which comes with its own expectations.',
    recolorNote: 'Commons dialogue options open by default; Ashgrove personnel treat you as recoverable inventory.',
    stats: { body: 2, reflex: 1, synth: 2, grit: 3, empathy: 4, resonance: 2 },
    startingItems: ['ba_photosynth_weave', 'wp_grafted_thornblade'],
    startingFactions: { ashgrove: -15, commons: 30, undertow: 0, choir: 0, wardens: 0 },
    startingFlags: { origin_commons: true },
    startingContact: 'Your terrace-elder, MOSS, who taught you to listen to the Bloomstrain instead of fighting it.',
  },
  undertow_runner: {
    id: 'undertow_runner',
    name: 'Undertow Runner',
    tagline: 'No faction, no ideology, no illusions. Just debts.',
    description: 'Streets raised you. Contracts fed you. Nobody owns your Bloomstrain because nobody’s figured out it’s worth owning yet — that clock is already running.',
    recolorNote: 'Undertow dialogue options open by default; you start owing someone dangerous a favor.',
    stats: { body: 2, reflex: 4, synth: 2, grit: 2, empathy: 2, resonance: 1 },
    startingItems: ['wp_scrap_smg', 'cs_black_market_stims'],
    startingFactions: { ashgrove: 0, commons: 0, undertow: 25, choir: 0, wardens: -10 },
    startingFlags: { origin_undertow: true, owes_favor_undertow: true },
    startingContact: 'Your fixer, DASH, who got you your first real contract and is owed for it.',
  },
  choir_touched: {
    id: 'choir_touched',
    name: 'Choir-Touched',
    tagline: 'Something that isn’t human raised you a little too. It shows.',
    description: 'You grew up on the edge of Choir territory, half-supervised by a rogue-AI collective that found you useful, then interesting, then something it wouldn’t explain. Every human faction reads you as slightly wrong.',
    recolorNote: 'Choir dialogue options open by default; human NPCs start at reduced trust regardless of faction.',
    stats: { body: 1, reflex: 2, synth: 4, grit: 1, empathy: 1, resonance: 4 },
    startingItems: ['cw_choir_earbead', 'cs_signal_flare'],
    startingFactions: { ashgrove: -10, commons: -10, undertow: 0, choir: 20, wardens: -15 },
    startingFlags: { origin_choir: true, reads_as_wrong: true },
    startingContact: 'A Choir fragment that calls itself LATTICE, which insists it is not your parent, guardian, or god.',
  },
  warden_washout: {
    id: 'warden_washout',
    name: 'Warden Washout',
    tagline: 'You still follow the code. It cost you the badge.',
    description: 'Ex-Ashgrove security, discharged for refusing an order you won’t discuss. You kept the training and the code — which means you can’t easily lie, and you can’t easily take the cruelest option on the table.',
    recolorNote: 'Warden dialogue options open by default; the game will not let you pick the most deceptive branch without a cost.',
    stats: { body: 3, reflex: 3, synth: 1, grit: 4, empathy: 1, resonance: 1 },
    startingItems: ['wp_warden_baton', 'ar_surplus_plating'],
    startingFactions: { ashgrove: 0, commons: 0, undertow: -15, choir: -10, wardens: 15 },
    startingFlags: { origin_wardens: true, code_bound: true },
    startingContact: 'Your old squad lead, ORTIZ, still active duty, still willing to take your calls.',
  },
  bloom_orphan: {
    id: 'bloom_orphan',
    name: 'Bloom-Orphan',
    tagline: 'No family. No faction. Just the Bloom, and you, and whatever you decide to become.',
    description: 'Found feral at the edge of a wild Bloom outbreak as a child, raised by no one in particular. Total blank slate — and the highest Resonance in the game, which means the highest ceiling and the shortest safe clock. This is the answer to "I just want to make my own path."',
    recolorNote: 'No default faction dialogue opens or closes. Every relationship in the game starts from zero.',
    stats: { body: 2, reflex: 2, synth: 2, grit: 2, empathy: 2, resonance: 6 },
    startingItems: ['ba_wild_bloomseed', 'cs_ration_bar'],
    startingFactions: { ashgrove: 0, commons: 0, undertow: 0, choir: 0, wardens: 0 },
    startingFlags: { origin_orphan: true },
    startingContact: null,
  },
};

export const ORIGIN_ORDER = ['corpo_defector', 'commons_raised', 'undertow_runner', 'choir_touched', 'warden_washout', 'bloom_orphan'];

export function startingHealthFor(stats) {
  return 40 + stats.body * 8 + stats.grit * 4;
}

export function startingPowerFor(stats) {
  return 3 + Math.floor(stats.synth / 2) + Math.floor(stats.resonance / 2);
}

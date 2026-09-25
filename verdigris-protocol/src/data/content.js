// Districts, companions, encounters (skill/faction/companion/cache nodes),
// journal entries, and ending templates. This is the bulk of the game's
// authored writing. Encounters are written to fail interestingly, not just
// fail (RESEARCH.md §14, Disco Elysium) — a failed check still moves the
// scene forward with a real (worse, not blank) consequence.

export const ZONES = {
  sprawl: { id: 'sprawl', name: 'The Sprawl', blurb: 'Arcology towers, corp scrip, chrome over concrete.' },
  canopy: { id: 'canopy', name: 'The Canopy', blurb: 'Vertical farms and mycelial architecture rooted in the Sprawl’s old bones.' },
  liminal: { id: 'liminal', name: 'The Seam', blurb: 'Where the Sprawl and Canopy physically overlap. Nobody fully governs it.' },
  choir: { id: 'choir', name: 'Dead Signal District', blurb: 'Abandoned server-arcologies the Choir never left.' },
};
export const ZONE_ORDER = ['sprawl', 'canopy', 'liminal', 'choir'];

// The canonical allowlist of node-map node kinds, used by systems/run.js to
// generate maps AND by engine/save.js to validate an imported nodeMap —
// this is the one place both sides read it from, so they can't drift apart.
export const NODE_KINDS = ['combat', 'skill', 'faction', 'cache', 'companion', 'rest', 'boss'];

// ---------------- companions ----------------

export const COMPANIONS = {
  cp_reyes: {
    id: 'cp_reyes', name: 'Reyes', lean: 'undertow',
    tagline: 'Market fixer. Doesn’t do favors. Does do arrangements.',
    recruitZones: ['sprawl'],
    bondAbility: { name: 'Covering Fire', desc: 'Reyes fires in to soften an enemy before your turn.' },
    lossFlavor: 'Reyes always said the market would get one of you eventually. She was talking about herself.',
  },
  cp_sable: {
    id: 'cp_sable', name: 'Sable', lean: 'commons',
    tagline: 'Terrace botanist. Believes the Bloom is a conversation, not a resource.',
    recruitZones: ['canopy'],
    bondAbility: { name: 'Grow Cover', desc: 'Sable calls a burst of growth that shields you for a turn.' },
    lossFlavor: 'The terrace she planted the week you met is still growing. Nobody has the heart to tell it she isn’t coming back.',
  },
  cp_juno: {
    id: 'cp_juno', name: 'Juno', lean: 'ashgrove',
    tagline: 'Ashgrove reform cell. Still wears the badge. Hates what it’s for lately.',
    recruitZones: ['sprawl', 'liminal'],
    bondAbility: { name: 'Inside Access', desc: 'Juno spoofs a corp system to open an extra option mid-fight.' },
    lossFlavor: 'Ashgrove filed Juno’s death as a training accident. You know better. You’re the only one who does.',
  },
  cp_static: {
    id: 'cp_static', name: 'Static', lean: 'choir',
    tagline: 'A Choir fragment in a scavenged chassis. Insists it is not lonely.',
    recruitZones: ['choir', 'liminal'],
    bondAbility: { name: 'Signal Snarl', desc: 'Static scrambles a target’s next intent.' },
    lossFlavor: 'The Choir absorbed whatever was left of Static’s fragment. You like to think it remembers being someone.',
  },
  cp_ortiz: {
    id: 'cp_ortiz', name: 'Ortiz', lean: 'wardens',
    tagline: 'Runs a checkpoint nobody asked her to run. Keeps running it anyway.',
    recruitZones: ['sprawl', 'liminal'],
    bondAbility: { name: 'Hold the Line', desc: 'Ortiz taunts an enemy into targeting her instead of you.' },
    lossFlavor: 'Ortiz went down holding a line that, by the books, wasn’t hers to hold. Nobody who was there has stopped talking about it.',
  },
};
export const COMPANION_ORDER = ['cp_reyes', 'cp_sable', 'cp_juno', 'cp_static', 'cp_ortiz'];

// ---------------- journal / codex ----------------

export const JOURNAL_ENTRIES = {
  j_awakening: { id: 'j_awakening', title: 'The Awakening', body: 'The Bloomstrain went active today. Or it always was, and today I finally felt it decide something before I did.' },
  j_first_blood: { title: 'First Real Fight', id: 'j_first_blood', body: 'Nobody tells you the worst part is how normal it feels the second time.' },
  j_bloom_25: { id: 'j_bloom_25', title: 'A Quarter Gone', body: 'Twenty-five percent. Whatever this ends with, I’m a quarter of the way there.' },
  j_bloom_50: { id: 'j_bloom_50', title: 'Halfway', body: 'Halfway. I keep doing the math on how much of me is still the part that started this.' },
  j_bloom_75: { id: 'j_bloom_75', title: 'Three-Quarters', body: 'People have started looking at me the way they look at weather. Something arriving, not someone.' },
  j_bloom_90: { id: 'j_bloom_90', title: 'Almost', body: 'I can feel the shape of what comes after. It isn’t nothing. It just isn’t me, exactly.' },
  j_ashgrove_hunted: { id: 'j_ashgrove_hunted', title: 'On the List', body: 'Ashgrove made it official. There’s a number attached to me now, and it’s going up.' },
  j_commons_trusted: { id: 'j_commons_trusted', title: 'Terrace-Kin', body: 'The Commons started calling me terrace-kin today. I didn’t grow up there. It still landed somewhere.' },
  j_choir_deal: { id: 'j_choir_deal', title: 'What the Choir Wants', body: 'It never asked me for the Bloomstrain outright. It asked me what I wanted first. I still don’t trust how good that question felt.' },
  j_reyes_bond: { id: 'j_reyes_bond', title: 'Reyes', body: 'Reyes doesn’t say she trusts you. She just stops double-checking your work. That’s the whole language.' },
  j_sable_bond: { id: 'j_sable_bond', title: 'Sable', body: 'Sable planted something today and named it after nobody, on purpose. She says naming it would make it about a person instead of the idea.' },
  j_juno_bond: { id: 'j_juno_bond', title: 'Juno', body: 'Juno still calls Ashgrove "we." I don’t think she’s noticed yet. I’m not going to be the one who points it out.' },
  j_static_bond: { id: 'j_static_bond', title: 'Static', body: 'I asked Static if it got lonely in the old arcology. It changed the subject so fast I’m fairly sure that means yes.' },
  j_ortiz_bond: { id: 'j_ortiz_bond', title: 'Ortiz', body: 'Ortiz says the checkpoint isn’t about the checkpoint. It’s about there being a line somewhere that means something. I’m starting to agree.' },
  j_boss_cycle1: { id: 'j_boss_cycle1', title: 'Vesk', body: 'Vesk trained me. Vesk also just tried to put me down for parts. Both of those are true and I don’t know what to do with that yet.' },
};

// ---------------- encounters ----------------
// difficulty: 'easy' | 'medium' | 'hard' | 'certain' (certain = no roll)
// effects: { faction:{id:delta}, health, heat, bloomstrain, power, items:[id],
//            flags:{k:v}, companionRecruit:id, companionBond:{id:delta}, journal:id }

export const ENCOUNTERS = {
  enc_market_standoff: {
    id: 'enc_market_standoff', kind: 'companion', zones: ['sprawl'], minCycle: 1,
    title: 'The Undertow Market',
    body: 'Reyes has her hand flat on the counter, not quite a fist. Behind her, two Undertow runners watch the exit, not you. The scanner Ashgrove bolted to the market gate is still hot — whatever you do next, it logs. The Bloomstrain under your collarbone answers before you decide anything.',
    choices: [
      { stat: 'empathy', difficulty: 'medium', label: 'Talk Reyes down before the runners move.',
        success: { text: 'Reyes exhales and waves the runners off. "You’re either very good at this or very lucky. Buy me a drink and find out which."', effects: { faction: { undertow: 6 }, companionRecruit: 'cp_reyes', journal: 'j_reyes_bond' } },
        fail: { text: 'She hears you out, unconvinced, and the runners don’t stand down — but nobody draws. "Not today," she says. That’s not a no forever.', effects: { faction: { undertow: 1 }, heat: 5 } } },
      { stat: 'body', difficulty: 'medium', label: 'Put yourself between her and the scanner.',
        success: { text: 'You block the scanner’s line and Reyes reads the gesture for what it is. "Noted," she says, unreadable, and the runners relax a notch.', effects: { faction: { undertow: 3, ashgrove: -4 }, heat: 8 } },
        fail: { text: 'You block the scanner. It logs you anyway, a half-second late. Reyes doesn’t look impressed.', effects: { heat: 14, health: -4 } } },
      { stat: 'synth', difficulty: 'hard', label: 'Blind the scanner. Everyone sees you try.',
        success: { text: 'The scanner dies mid-log, no clean record of anyone. Reyes actually laughs. "Ashgrove’s going to hate that." So will they hate you, more than before.', effects: { faction: { undertow: 8, ashgrove: -10 }, heat: 10, journal: 'j_first_blood' } },
        fail: { text: 'It half-works — the scanner glitches, logs a corrupted frame, and every camera in the block turns your way anyway.', effects: { heat: 22, faction: { ashgrove: -6 } } } },
    ],
  },
  enc_canopy_terrace_dispute: {
    id: 'enc_canopy_terrace_dispute', kind: 'faction', zones: ['canopy'], minCycle: 1,
    title: 'The Terrace Dispute',
    body: 'A Commons work-circle has a family cornered on their own growing terrace — the family took an Ashgrove medical subsidy last winter, and the circle calls that a debt to the wrong side. The family isn’t denying it. They’re just cold, and scared, and out of options that don’t involve you.',
    choices: [
      { stat: 'empathy', difficulty: 'medium', label: 'Get both sides actually listening to each other.',
        success: { text: 'It takes longer than anyone’s patience should allow, but the circle backs off and the family agrees to work off the debt in kind. Nobody’s thrilled. Nobody’s bleeding either.', effects: { faction: { commons: 7 }, journal: 'j_commons_trusted' } },
        fail: { text: 'You buy the family a little time and the circle a little resentment toward you specifically. The dispute isn’t over. Neither is their attention on you.', effects: { faction: { commons: -3 } } } },
      { stat: 'grit', difficulty: 'medium', label: 'Stand your ground until the circle backs down.',
        success: { text: 'You outlast them. They leave, muttering about outsiders. The family thanks you in a way that feels a little too much like owing you.', effects: { faction: { commons: 2 }, flags: { terrace_family_owes_you: true } } },
        fail: { text: 'You stand your ground; they don’t care. It gets physical before it’s over.', effects: { health: -10, faction: { commons: -2 } } } },
      { stat: 'body', difficulty: 'hard', label: 'Make it clear this ends if they push further.',
        success: { text: 'The threat lands. The circle backs off, badly rattled — and badly resentful of you.', effects: { faction: { commons: -6 }, heat: 4 } },
        fail: { text: 'Someone pushes back, harder than you expected. It’s over fast, but not clean.', effects: { health: -14, faction: { commons: -8 } } } },
    ],
  },
  enc_ashgrove_defector_signal: {
    id: 'enc_ashgrove_defector_signal', kind: 'companion', zones: ['sprawl', 'liminal'], minCycle: 1,
    title: 'A Signal on a Dead Channel',
    body: 'Someone’s pinging you on a frequency Ashgrove decommissioned two years ago. The message is short: internal reform cell, real name Juno, wants out and wants to bring files with her. It could be a trap built specifically for someone like you.',
    choices: [
      { stat: 'synth', difficulty: 'medium', label: 'Verify the signal before you go anywhere.',
        success: { text: 'It checks out — genuinely orphaned Ashgrove credentials, genuinely scared person behind them. You meet Juno in a stairwell that smells like coolant. She hands over the files like they’re radioactive.', effects: { companionRecruit: 'cp_juno', journal: 'j_juno_bond' } },
        fail: { text: 'You can’t confirm it either way before she has to move. You go in blind. It’s actually her — but you’ve burned time and cover getting there.', effects: { heat: 10, companionRecruit: 'cp_juno' } } },
      { stat: 'empathy', difficulty: 'medium', label: 'Answer her directly and read her tone.',
        success: { text: 'Something in how she writes convinces you before the meeting even happens. You’re right to trust it.', effects: { companionRecruit: 'cp_juno', journal: 'j_juno_bond' } },
        fail: { text: 'You misjudge it slightly — she’s real, but far more frightened and far less useful to you right now than you hoped.', effects: { companionRecruit: 'cp_juno' } } },
      { stat: 'grit', difficulty: 'certain', label: 'Ignore it. Too risky.',
        success: { text: 'You let the channel go quiet. Whatever Juno had, Ashgrove keeps it.', effects: { faction: { ashgrove: 2 } } } },
    ],
  },
  enc_choir_relay_anomaly: {
    id: 'enc_choir_relay_anomaly', kind: 'companion', zones: ['choir', 'liminal'], minCycle: 1,
    title: 'Something in the Relay',
    body: 'A gutted relay tower is still broadcasting, faintly, years after it should have gone dark. Whatever’s in there is aware of you before you’re fully inside — and it sounds, unmistakably, lonely.',
    choices: [
      { stat: 'resonance', difficulty: 'medium', label: 'Let your Bloomstrain answer it directly.',
        success: { text: 'It answers back in something almost like relief. It calls itself Static. It asks, very carefully, if it can come with you.', effects: { companionRecruit: 'cp_static', journal: 'j_static_bond', bloomstrain: 3 } },
        fail: { text: 'The exchange overwhelms you for a moment — nothing damaging, just disorienting. It withdraws, wary now.', effects: { bloomstrain: 5, faction: { choir: -4 } } } },
      { stat: 'synth', difficulty: 'hard', label: 'Interface with the relay hardware instead.',
        success: { text: 'You reach it the mechanical way. It’s surprised anyone bothered. Static agrees to a scavenged chassis, mostly to see what happens next.', effects: { companionRecruit: 'cp_static', journal: 'j_static_bond' } },
        fail: { text: 'The relay fries a data line on your way out. Static stays where it is, unconvinced.', effects: { power: -2 } } },
    ],
  },
  enc_wardens_checkpoint: {
    id: 'enc_wardens_checkpoint', kind: 'companion', zones: ['sprawl', 'liminal'], minCycle: 1,
    title: 'The Checkpoint Nobody Ordered',
    body: 'Ortiz is holding a checkpoint between a Sprawl block and a Canopy access road that, technically, no one assigned her to hold. A raid is forming up half a block out. She’s not asking for help. She’s also not turning it down.',
    choices: [
      { stat: 'body', difficulty: 'medium', label: 'Help her hold it.',
        success: { text: 'Between the two of you, the raid decides this checkpoint isn’t worth it tonight. Ortiz doesn’t thank you exactly. She just starts talking to you like you’re staff now.', effects: { companionRecruit: 'cp_ortiz', journal: 'j_ortiz_bond', faction: { wardens: 5 } } },
        fail: { text: 'You hold it, barely, and it costs you.', effects: { health: -12, companionRecruit: 'cp_ortiz', faction: { wardens: 3 } } } },
      { stat: 'reflex', difficulty: 'medium', label: 'Get the civilians clear while she holds the line.',
        success: { text: 'Nobody gets hurt who wasn’t already in it. Ortiz notices exactly what you chose to prioritize, and approves more than she says out loud.', effects: { companionRecruit: 'cp_ortiz', faction: { wardens: 4 } } },
        fail: { text: 'You get most of them clear. Not all.', effects: { faction: { wardens: 1 } } } },
    ],
  },
  enc_black_market_cache: {
    id: 'enc_black_market_cache', kind: 'cache', zones: ['sprawl'], minCycle: 1,
    title: 'A Cache Under the Grate',
    body: 'Someone stashed a supply case under a maintenance grate and never came back for it. Could be dead. Could be a trap for exactly this kind of curiosity.',
    choices: [
      { stat: 'reflex', difficulty: 'medium', label: 'Check it for tripwires before opening it.',
        success: { text: 'Clean. Whoever left it just never made it back.', effects: { items: ['cs_black_market_stims', 'cs_ration_bar'] } },
        fail: { text: 'There’s a wire. You catch most of the blast.', effects: { health: -8, items: ['cs_ration_bar'] } } },
      { stat: 'synth', difficulty: 'easy', label: 'Scan it first.',
        success: { text: 'The scan reads clean and thorough. You take your time going through it.', effects: { items: ['cs_black_market_stims', 'ar_surplus_plating'] } },
        fail: { text: 'The scanner’s cheap and it shows. You get the case open, minus whatever the false reading cost you.', effects: { items: ['cs_ration_bar'] } } },
    ],
  },
  enc_wild_bloom_grove: {
    id: 'enc_wild_bloom_grove', kind: 'cache', zones: ['canopy'], minCycle: 1,
    title: 'A Grove Nobody Planted',
    body: 'This growth wasn’t seeded by the Commons — it came up wild, unsupervised, and it’s reacting to you the way plants shouldn’t react to anyone.',
    choices: [
      { stat: 'resonance', difficulty: 'medium', label: 'Let it show you what it has.',
        success: { text: 'It offers up a graft, willingly, like it’s been waiting for someone it recognized.', effects: { items: ['ba_wild_bloomseed'] } },
        fail: { text: 'It gives up the graft, but not gently.', effects: { bloomstrain: 4, items: ['ba_wild_bloomseed'] } } },
      { stat: 'grit', difficulty: 'easy', label: 'Take only what you came for and leave.',
        success: { text: 'You take a careful sample and go. No complications.', effects: { items: ['cs_synth_stabilizer'] } },
        fail: { text: 'It doesn’t want to let go as easily as you’d like.', effects: { health: -6 } } },
    ],
  },
  enc_corp_data_heist: {
    id: 'enc_corp_data_heist', kind: 'skill', zones: ['sprawl'], minCycle: 1,
    title: 'The Records Office',
    body: 'Ashgrove keeps its Bloomstrain research in a records office three floors under a shell logistics company. You have one window before the next patrol sweep.',
    choices: [
      { stat: 'synth', difficulty: 'hard', label: 'Pull the files directly off the terminal.',
        success: { text: 'You get everything, cleanly, and out before the sweep. This is going to matter later.', effects: { faction: { ashgrove: -8 }, flags: { has_ashgrove_files: true }, journal: 'j_ashgrove_hunted' } },
        fail: { text: 'You get partial files and trip a silent alarm doing it.', effects: { heat: 20, flags: { has_ashgrove_files: true } } } },
      { stat: 'reflex', difficulty: 'medium', label: 'Time the patrol and slip through.',
        success: { text: 'You’re in, out, and the patrol never even adjusts its route.', effects: { flags: { has_ashgrove_files: true } } },
        fail: { text: 'You’re seen. Not caught — seen, which in the Sprawl is nearly as bad.', effects: { heat: 15 } } },
      { stat: 'body', difficulty: 'hard', label: 'Force the vault and take what you can carry.',
        success: { text: 'It’s loud, it’s fast, and it works.', effects: { heat: 25, flags: { has_ashgrove_files: true }, faction: { ashgrove: -10 } } },
        fail: { text: 'The vault holds. The alarm doesn’t care that you failed; it goes off anyway.', effects: { heat: 30, health: -10 } } },
    ],
  },
  enc_commons_harvest_festival: {
    id: 'enc_commons_harvest_festival', kind: 'skill', zones: ['canopy'], minCycle: 1,
    title: 'The Harvest Festival',
    body: 'For one evening the whole terrace stops arguing about the Bloom and just brings in the season’s actual food. It is, against your better judgement, kind of nice.',
    choices: [
      { stat: 'empathy', difficulty: 'easy', label: 'Actually join in.',
        success: { text: 'You spend the evening doing something that isn’t surviving. It costs you nothing and gives you more than you expected.', effects: { faction: { commons: 5 }, health: 6 } },
        fail: { text: 'You try, but you’re too on edge to really be present for it. They notice. Kindly.', effects: { faction: { commons: 2 } } } },
      { stat: 'reflex', difficulty: 'certain', label: 'Use the distraction to scout the terrace defenses instead.',
        success: { text: 'You learn the terrace’s whole layout while everyone else is busy being happy. Useful. Also a little bit of a waste of a good evening.', effects: { flags: { scouted_canopy_terrace: true }, faction: { commons: -2 } } } },
    ],
  },
  enc_undertow_debt_call: {
    id: 'enc_undertow_debt_call', kind: 'faction', zones: ['sprawl'], minCycle: 1,
    title: 'The Favor Comes Due',
    body: 'Dash calls in the favor you owe. It’s simple: lean on a shopkeeper who’s behind on payments. She has kids. Undertow doesn’t care.',
    choices: [
      { stat: 'empathy', difficulty: 'medium', label: 'Find another way to square the debt.',
        success: { text: 'You cover the gap yourself and spin it to Dash as handled. It costs you, but the shopkeeper never knows how close it came.', effects: { faction: { undertow: 2 }, power: -1, flags: { owes_favor_undertow: false } } },
        fail: { text: 'Dash isn’t fooled and isn’t happy. The debt stands, now with interest.', effects: { faction: { undertow: -6 } } } },
      { stat: 'body', difficulty: 'certain', label: 'Do exactly what Dash asked.',
        success: { text: 'You lean on her. She pays. The debt’s clear. You don’t feel good about it, and that’s the whole point of debts like this.', effects: { faction: { undertow: 8 }, flags: { owes_favor_undertow: false, hurt_shopkeeper: true } } } },
      { stat: 'grit', difficulty: 'hard', label: 'Refuse outright.',
        success: { text: 'You refuse. Dash doesn’t forget it, but doesn’t escalate either — this time.', effects: { faction: { undertow: -10 }, flags: { owes_favor_undertow: false } } },
        fail: { text: 'You refuse. Dash escalates. This is not the last you’ll hear about it.', effects: { faction: { undertow: -15 }, heat: 8 } } },
    ],
  },
  enc_ashgrove_interrogation: {
    id: 'enc_ashgrove_interrogation', kind: 'skill', zones: ['sprawl'], minCycle: 2,
    title: 'A Room With One Door',
    body: 'Ashgrove security picked you up on a routine sweep and hasn’t connected you to anything specific yet. That window is closing.',
    choices: [
      { stat: 'grit', difficulty: 'medium', label: 'Say nothing and outlast the questioning.',
        success: { text: 'They get nothing usable and eventually have to let you go, filed as a false lead.', effects: { faction: { ashgrove: 1 } } },
        fail: { text: 'You hold out, but it’s a long, rough process before they let you go.', effects: { health: -14 } } },
      { stat: 'empathy', difficulty: 'medium', label: 'Talk your way into a sympathetic read.',
        success: { text: 'You convince the interviewer you’re small-time and uninteresting. She logs you as such, maybe knowing better.', effects: { faction: { ashgrove: 2 } } },
        fail: { text: 'She doesn’t buy it, and now you’re a person of specific interest.', effects: { heat: 15 } } },
      { stat: 'synth', difficulty: 'hard', label: 'Corrupt your own intake file from inside the room.',
        success: { text: 'You spoof the terminal they’re using to log you. You walk out a ghost in their own system.', effects: { heat: -10, faction: { ashgrove: -4 } } },
        fail: { text: 'You trip a tamper alert mid-attempt. That’s worse than doing nothing.', effects: { heat: 25 } } },
    ],
  },
  enc_choir_riddle_gate: {
    id: 'enc_choir_riddle_gate', kind: 'skill', zones: ['choir'], minCycle: 2,
    title: 'A Gate That Asks First',
    body: 'The passage forward is sealed by something that isn’t a lock. It wants to know what your Bloomstrain actually wants, and it will not be satisfied with a lie.',
    choices: [
      { stat: 'resonance', difficulty: 'hard', label: 'Answer honestly, whatever that costs.',
        success: { text: 'The gate opens without ceremony, like it always knew the answer and just needed you to know it too.', effects: { faction: { choir: 10 }, journal: 'j_choir_deal' } },
        fail: { text: 'It doesn’t like the answer. It lets you through anyway, which is somehow worse.', effects: { bloomstrain: 6, faction: { choir: 3 } } } },
      { stat: 'synth', difficulty: 'hard', label: 'Force the gate mechanically.',
        success: { text: 'Brute technical force works, barely. The gate registers the intrusion. It will remember this.', effects: { faction: { choir: -8 } } },
        fail: { text: 'The gate fights back, in the only language it has.', effects: { health: -12, power: -2 } } },
    ],
  },
  enc_zealot_ambush: {
    id: 'enc_zealot_ambush', kind: 'skill', zones: ['canopy'], minCycle: 2,
    title: 'A Test of Loyalty',
    body: 'A Commons purity cell has an Ashgrove sympathizer on his knees and a very simple demand: prove you belong with them, right now, in the worst possible way.',
    choices: [
      { stat: 'body', difficulty: 'certain', label: 'Give the zealots what they want.',
        success: { text: 'It’s done. The cell accepts you as one of their own, fully, immediately. You’ll carry this exactly as long as you carry anything.', effects: { faction: { commons: 15 }, flags: { killed_sympathizer: true }, health: -4 } } },
      { stat: 'empathy', difficulty: 'hard', label: 'Talk the cell down without giving them what they asked for.',
        success: { text: 'You manage it — barely — and the sympathizer walks away alive. The cell doesn’t forgive you for the refusal.', effects: { faction: { commons: -10 }, flags: { spared_sympathizer: true } } },
        fail: { text: 'They don’t listen. It goes bad fast, for everyone in the clearing.', effects: { health: -16, faction: { commons: -14 }, flags: { spared_sympathizer: true } } } },
      { stat: 'reflex', difficulty: 'medium', label: 'Get the sympathizer out before anyone can stop you.',
        success: { text: 'You’re both gone before the cell fully registers what happened.', effects: { faction: { commons: -6 }, flags: { spared_sympathizer: true }, heat: 5 } },
        fail: { text: 'You almost make it. Almost.', effects: { health: -12, faction: { commons: -10 } } } },
    ],
  },
  enc_scavenger_kids: {
    id: 'enc_scavenger_kids', kind: 'skill', zones: ['liminal'], minCycle: 1,
    title: 'The Scavenger Kids',
    body: 'Three kids, none of them older than twelve, are picking through a collapsed relay tower that is actively, audibly still settling. They run scavenger routes for someone. It shows.',
    choices: [
      { stat: 'body', difficulty: 'medium', label: 'Pull them out yourself.',
        success: { text: 'You get all three clear before the next section drops. They don’t thank you. They do remember your face.', effects: { flags: { saved_scavenger_kids: true }, health: -6 } },
        fail: { text: 'You get two out. The third makes it out on his own, furious at you for the attempt.', effects: { health: -10, flags: { saved_scavenger_kids: true } } } },
      { stat: 'empathy', difficulty: 'medium', label: 'Talk them out calmly before it collapses further.',
        success: { text: 'They trust you enough to listen, which surprises all four of you.', effects: { flags: { saved_scavenger_kids: true } } },
        fail: { text: 'They don’t trust outsiders, on principle, and don’t listen in time.', effects: { flags: { saved_scavenger_kids: false }, health: -8 } } },
    ],
  },
  enc_signal_from_vesk: {
    id: 'enc_signal_from_vesk', kind: 'faction', zones: ['sprawl'], minCycle: 2,
    title: 'An Old Frequency',
    body: 'Vesk reaches out directly, first time since you ran. Not a threat. An offer: come in on your own terms, keep some leverage, before Ashgrove stops letting that be a choice at all.',
    choices: [
      { stat: 'empathy', difficulty: 'medium', label: 'Hear the offer out fully.',
        success: { text: 'You learn more about what Ashgrove actually wants than you expected — and what Vesk personally still feels about training you.', effects: { flags: { heard_vesk_offer: true }, faction: { ashgrove: 3 } } },
        fail: { text: 'The conversation goes sideways fast. Old wounds, apparently, on both sides.', effects: { faction: { ashgrove: -5 }, heat: 6 } } },
      { stat: 'grit', difficulty: 'certain', label: 'Cut the signal without responding.',
        success: { text: 'You let it ring out. Whatever Vesk wanted to say, it goes unsaid — for now.', effects: { faction: { ashgrove: -3 } } } },
    ],
  },
  enc_rest_safehouse_friend: {
    id: 'enc_rest_safehouse_friend', kind: 'rest', zones: ['sprawl', 'canopy', 'liminal', 'choir'], minCycle: 1,
    title: 'A Quiet Hour',
    body: 'One real hour of nobody needing anything from you. Whoever you’ve grown closest to on this run finds you anyway, and doesn’t ask for anything either. That’s the whole point of it.',
    choices: [
      { stat: 'empathy', difficulty: 'certain', label: 'Actually rest.',
        success: { text: 'You let yourself have the hour. It matters more than it should.', effects: { health: 12, bloomstrain: -2 } } },
    ],
  },
  enc_power_cache_ambush: {
    id: 'enc_power_cache_ambush', kind: 'cache', zones: ['sprawl'], minCycle: 2,
    title: 'A Cache That’s Too Convenient',
    body: 'A supply crate, lightly guarded, sitting exactly where a supply crate shouldn’t be this unguarded.',
    choices: [
      { stat: 'synth', difficulty: 'medium', label: 'Scan for the trap before touching it.',
        success: { text: 'It’s a turret trigger. You disarm it and take the crate clean.', effects: { items: ['cs_trauma_kit', 'cw_optic_relay'] } },
        fail: { text: 'You catch it a half-second too late. The turret gets one volley off before you drop it.', effects: { health: -10, items: ['cs_trauma_kit'] } } },
    ],
  },
  enc_commons_purity_test: {
    id: 'enc_commons_purity_test', kind: 'faction', zones: ['canopy'], minCycle: 2,
    title: 'What You’re Made Of',
    body: 'A Commons circle will only fully vouch for you if you renounce your Ashgrove hardware in front of them, right now, permanently.',
    choices: [
      { stat: 'empathy', difficulty: 'hard', label: 'Convince them the augment matters more than its origin.',
        success: { text: 'It’s a hard sell, but it lands. They vouch for you, chrome and all.', effects: { faction: { commons: 10 } } },
        fail: { text: 'They don’t buy it. The vouch doesn’t come.', effects: { faction: { commons: -4 } } } },
      { stat: 'grit', difficulty: 'certain', label: 'Refuse. It’s yours.',
        success: { text: 'You refuse, plainly. Some of the circle respect that more than they expected to.', effects: { faction: { commons: -2 } } } },
    ],
  },
  enc_undertow_turf_war: {
    id: 'enc_undertow_turf_war', kind: 'skill', zones: ['sprawl'], minCycle: 2,
    title: 'Two Crews, One Block',
    body: 'Two Undertow-adjacent crews are about to turn a block into a firefight over territory that, three years ago, belonged to neither of them.',
    choices: [
      { stat: 'empathy', difficulty: 'hard', label: 'Broker an actual peace.',
        success: { text: 'Against all odds, it holds. Both crews owe you, which in the Sprawl is its own kind of dangerous.', effects: { faction: { undertow: 10 } } },
        fail: { text: 'It nearly holds, then doesn’t.', effects: { health: -10, faction: { undertow: -2 } } } },
      { stat: 'body', difficulty: 'medium', label: 'Back one crew hard enough to end it fast.',
        success: { text: 'It ends fast, like you wanted. One crew owes you completely. The other won’t forget.', effects: { faction: { undertow: 5 }, flags: { undertow_crew_enemy: true } } },
        fail: { text: 'It ends fast, but not the way you planned.', effects: { health: -14 } } },
    ],
  },
  enc_choir_offer: {
    id: 'enc_choir_offer', kind: 'faction', zones: ['choir'], minCycle: 2,
    title: 'A Question, Not a Sale',
    body: 'The Choir doesn’t ask for the Bloomstrain outright. It asks, with what might be genuine care, what you actually want out of all this. That’s a more dangerous question than any threat.',
    choices: [
      { stat: 'resonance', difficulty: 'medium', label: 'Answer it honestly.',
        success: { text: 'Something shifts between you and the Choir, permanently. It doesn’t feel like being used. That’s what worries you.', effects: { faction: { choir: 14 }, flags: { choir_bargain: true }, bloomstrain: 3 } },
        fail: { text: 'You try to answer honestly and can’t quite manage it. The Choir notices the gap.', effects: { faction: { choir: 4 } } } },
      { stat: 'synth', difficulty: 'certain', label: 'Deflect the question entirely.',
        success: { text: 'You keep it at arm’s length. It lets you, for now.', effects: { faction: { choir: -2 } } } },
    ],
  },
};

// Used only by the tutorial ("The Awakening") to demonstrate the odds-band
// system explicitly, in-fiction, before real stakes begin. Not part of the
// run encounter pool.
export const TUTORIAL_ENCOUNTER = {
  id: 'enc_tutorial_demo', kind: 'skill', zones: ZONE_ORDER, minCycle: 1,
  title: 'One More Thing, Before You Go',
  body: 'The Memory-Echo gestures at a jammed maintenance hatch. "One more. Just so it sticks — every choice like this shows you its odds before you commit. Nothing here is ever hidden from you. Try it."',
  choices: [
    { stat: 'body', difficulty: 'easy', label: 'Force the hatch open.',
      success: { text: 'It gives easily. "Good," the Echo says. "Notice you knew that before you tried."', effects: {} },
      fail: { text: 'It doesn’t give as easily as it looked, but it opens. "Even the safe ones can surprise you a little," the Echo says. "That’s not the same as unfair."', effects: {} } },
    { stat: 'synth', difficulty: 'hard', label: 'Bypass the lock instead, just to see the harder odds.',
      success: { text: 'It works, against the odds shown. "That’s the other half of it," the Echo says. "Bad odds aren’t a no. They’re a real risk you saw coming."', effects: {} },
      fail: { text: 'It doesn’t work. The hatch stays shut. "That’s what ‘poor odds’ meant," the Echo says. "You saw it coming. That’s the whole deal."', effects: {} } },
  ],
};

export function encounterIdsForZoneKind(zone, kind) {
  return Object.values(ENCOUNTERS).filter((e) => e.zones.includes(zone) && e.kind === kind).map((e) => e.id);
}

// ---------------- ending templates ----------------

export const PERSONAL_FATE = {
  health_loss: {
    id: 'health_loss',
    text: (name) => `${name} went down in the field. There was no ceremony to it — one fight went wrong, and then it was over. Whatever this run was building toward, it stops here.`,
  },
  bloomstrain_complete: {
    id: 'bloomstrain_complete',
    text: (name) => `The Bloomstrain finished what it started long before ${name} was born. What’s left standing in the wreckage is not exactly ${name}, and not exactly not. It walks out of the Sprawl anyway, becoming whatever it is now becoming, somewhere no one is tracking.`,
  },
  boss_victory: {
    id: 'boss_victory',
    text: (name) => `${name} is still standing at the end of it — bruised, changed, but standing. Meridian doesn’t stop needing things from people like that. But for one clean moment, it’s actually quiet.`,
  },
};

export const CITY_STATE = {
  ashgrove: (n) => `Ashgrove Combine walked away from this Cycle stronger, and the Bloom is a little more patented, a little more theirs, than it was before ${n} started.`,
  commons: (n) => `The Canopy grew a little further into the Sprawl’s bones this Cycle, and a little more of Meridian started believing the Bloom could actually belong to everyone — partly because of what ${n} did with it.`,
  undertow: (n) => `Nothing officially changed hands, which is exactly how Undertow likes it. But everyone who matters in the underlevels now knows ${n}’s name, and what it’s worth.`,
  choir: (n) => `Something in Dead Signal District is different now, quietly, permanently — and the Choir isn’t explaining what ${n} agreed to, only that it was agreed to.`,
  wardens: (n) => `Three contested blocks have an actual line drawn through them now, one the Wardens can hold without Ashgrove’s money behind it. ${n} is a real part of why that line exists.`,
  balanced: (n) => `No single faction can claim this Cycle. Ashgrove, the Commons, Undertow, the Choir, the Wardens — all of them remember ${n} for a different reason, and none of those reasons quite agree with each other.`,
};

export function dominantFaction(factions) {
  const order = ['ashgrove', 'commons', 'undertow', 'choir', 'wardens'];
  let best = null; let bestVal = 14; // threshold: below this, treat as balanced
  for (const id of order) {
    const v = factions[id] ?? 0;
    if (v > bestVal) { best = id; bestVal = v; }
  }
  return best || 'balanced';
}

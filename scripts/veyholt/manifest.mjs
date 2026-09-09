const action = (name, description, attackBonus = null, dice = null, damageType = null, save = null) => ({
  name,
  description,
  kind: "ACTION",
  usage: null,
  attackType: attackBonus === null ? "OTHER" : "MELEE",
  attackBonus,
  reach: attackBonus === null ? null : 5,
  range: null,
  damage: dice ? [{ average: null, dice, flatBonus: Number(dice.match(/[+]([0-9]+)/)?.[1] ?? 0), damageType }] : [],
  save,
  conditions: [],
  effects: [],
  variants: [],
});

const creature = (input) => ({
  size: "Medium",
  type: "construct",
  hpFormula: null,
  speed: 30,
  movement: { walk: 30, fly: 0, swim: 0, climb: 0, burrow: 0, hover: false },
  initiative: { modifier: 2, score: 12 },
  abilities: { str: 12, dex: 14, con: 12, int: 6, wis: 10, cha: 5 },
  savingThrows: {},
  skills: {},
  vulnerabilities: [],
  resistances: [],
  immunities: [],
  conditionImmunities: [],
  senses: [{ name: "darkvision", range: 60, unit: "ft" }],
  passivePerception: 10,
  languages: [],
  notes: "DM-only Veyrholt creature. See the [Veyrholt] Encounter Mechanics campaign note and docs/campaign/chapters/VEYRHOLT_BELL_REVISION.md.",
  traits: [],
  actions: [],
  bonusActions: [],
  reactions: [],
  legendaryActions: [],
  legendaryActionUses: null,
  spellcasting: [],
  tokenSize: 1,
  ...input,
});

export const assets = {
  maps: {
    bellpost: { file: "maps/bellpost-crossing.png", width: 1254, height: 1254 },
    town: { file: "maps/veyholt-town.png", width: 1448, height: 1086 },
    farms: { file: "maps/sunward-farms.png", width: 1254, height: 1254 },
    gate: { file: "maps/castle-gate-court.png", width: 1536, height: 1024 },
    halls: { file: "maps/castle-halls.png", width: 1536, height: 1024 },
    foundry: { file: "maps/bellfoundry.png", width: 1254, height: 1254 },
    belfry: { file: "maps/regents-belfry.png", width: 1254, height: 1254 },
  },
  portraits: {
    elian: "portraits/elian-morrow.png",
    bryn: "portraits/bryn-halvek.png",
    nessa: "portraits/nessa-calder.png",
    avra: "portraits/avra-seln.png",
    tamsin: "portraits/tamsin-reed.png",
    kest: "portraits/kest-rane.png",
    mara: "portraits/mara-venn.png",
  },
  monsters: {
    bellRegent: "monsters/bell-regent.png",
    bronzeRam: "monsters/bronze-ram.png",
    ledgerSwarm: "monsters/ledger-swarm.png",
    roadRefrain: "monsters/road-refrain.png",
    titheBailiff: "monsters/tithe-bailiff.png",
  },
  discoverables: {
    ledger: "discoverables/clock-ledger.png",
    mural: "discoverables/builders-mural.png",
    doors: "discoverables/three-doorway-sketches.png",
    fragments: "discoverables/catalyst-fragments.png",
    handbell: "discoverables/seven-notch-handbell.png",
    titheTag: "discoverables/tithe-tag-and-collar.png",
    titheMap: "discoverables/old-tithe-map.png",
    anchorLeaves: "discoverables/anchor-design-leaves.png",
  },
};

export const scenes = [
  { key: "bellpost", name: "Veyrholt 01 — Bellpost Road", asset: "bellpost", gridType: "SQUARE", gridSize: 63, lighting: "MIDDAY" },
  { key: "town", name: "Veyrholt 02 — Town & Castle Ring", asset: "town", gridType: "GRIDLESS", gridSize: 64, lighting: "DAY" },
  { key: "farms", name: "Veyrholt 03 — Sunward Farms & Tithe Barn", asset: "farms", gridType: "SQUARE", gridSize: 63, lighting: "MIDDAY" },
  { key: "gate", name: "Veyrholt 04 — Castle Gate, Pens & Court", asset: "gate", gridType: "SQUARE", gridSize: 64, lighting: "NIGHT" },
  { key: "halls", name: "Veyrholt 05 — Hall, Archive & Banquet", asset: "halls", gridType: "SQUARE", gridSize: 64, lighting: "NIGHT" },
  { key: "foundry", name: "Veyrholt 06 — Bellfoundry Undercroft", asset: "foundry", gridType: "SQUARE", gridSize: 63, lighting: "NIGHT" },
  { key: "belfry", name: "Veyrholt 07 — Regent's Belfry", asset: "belfry", gridType: "SQUARE", gridSize: 63, lighting: "NIGHT" },
];

export const partyEntries = [
  { scene: "bellpost", x: 160, y: 1080 },
  { scene: "town", x: 150, y: 880 },
  { scene: "farms", x: 155, y: 1070 },
  { scene: "gate", x: 165, y: 835 },
  { scene: "halls", x: 150, y: 860 },
  { scene: "foundry", x: 160, y: 1080 },
  { scene: "belfry", x: 170, y: 1070 },
];

export const npcs = [
  {
    key: "elian", name: "Reeve Elian Morrow", asset: "elian",
    placements: [{ scene: "town", x: 505, y: 405 }],
    pages: [
      "One thing you'll notice right away: when the first bell rings, everyone stops. When the second rings a few seconds later, people keep going. Most of us were taught that as kids and never questioned it.",
      "At first we thought someone was stealing livestock. Then we noticed every missing animal had one of the old family bells, and every trail followed the same abandoned tithe route.",
      "Our first uncontrolled double toll happened the same night the Greymere Hollow went quiet. I don't know if those events are connected, but I'm not going to hide it from you.",
    ],
  },
  {
    key: "bryn", name: "Captain Bryn Halvek", asset: "bryn",
    placements: [{ scene: "town", x: 730, y: 360 }, { scene: "gate", x: 245, y: 780 }],
    pages: [
      "First bell means stop. Second bell means move. Every guard in Veyrholt learns that before they learn the gate routes. I couldn't tell you who first wrote the rule.",
      "Inside the castle, take that rule seriously. If the first bell rings, don't be the first thing to make a big move unless you mean to. Something done in those few seconds can come back wrong at the second bell.",
      "I lost a scout near the gate and kept it quiet because I was afraid the town would panic. That was a mistake.",
    ],
  },
  {
    key: "nessa", name: "Nessa Calder", asset: "nessa",
    placements: [{ scene: "town", x: 935, y: 565 }], type: "BOTH",
    pages: [
      "Here's what the old bell records are actually saying: the first bell marks a dangerous six-second window. The Hollow catches the first important motion made during that time. The second bell is when that motion comes back in a distorted form.",
      "That's why everyone stops. The old rule wasn't manners or superstition. It was survival. People kept teaching the habit long after they forgot the reason.",
      "Tuned bronze is the useful part. If a bell is the first thing struck during that window, the second toll makes the vibration happen again inside the bronze. The old builders learned to use that on purpose.",
    ],
    shop: [
      { name: "Resonance chalk", description: "Marks the path or object caught as the current First Motion so the party can track what will echo at the second bell.", priceGp: 5, quantity: 4 },
      { name: "Bellwax", description: "One use; grants advantage on a save against a bell or Second Motion effect.", priceGp: 3, quantity: 6 },
      { name: "Brass earplugs", description: "Useful against the sound of the bells, but not the force of a Second Motion.", priceGp: 1, quantity: null },
    ],
  },
  {
    key: "avra", name: "Sister Avra Seln", asset: "avra",
    placements: [{ scene: "town", x: 330, y: 655 }],
    pages: [
      "The chapel kept the old rule alive after the reason was forgotten: first bell, stop; second bell, continue. Most people here think it's just tradition now.",
      "Caldris Veyr was the last person assigned to keep the castle's anchors working. If anything of him is still in there, his name may still matter.",
      "I've also dreamed about the same doorway drawn three different ways. I don't know what it means, so don't treat it like an answer just because it sounds important.",
    ],
  },
  {
    key: "tamsin", name: "Tamsin Reed", asset: "tamsin",
    placements: [{ scene: "town", x: 1110, y: 770 }, { scene: "farms", x: 295, y: 790 }],
    pages: [
      "They didn't take the whole flock. Only the animals wearing the old bells our families have passed down for generations disappeared.",
      "One of my lambs panicked after the first bell and ran before the second. When the second bell hit, something like its path tore through the fence a second time. That's when the whole flock started fighting the old route.",
      "Kest lied about the culvert because he was hiding smuggling, not because he caused this. I followed him far enough to know the animals are still alive.",
    ],
  },
  {
    key: "kest", name: "Kest Rane", asset: "kest",
    placements: [{ scene: "farms", x: 970, y: 705 }],
    pages: [
      "I used the old tithe tunnel to move untaxed wool. Then one night I pulled a gate between the first and second bell. At the second toll, the gate moved again by itself hard enough to rip the hinge loose.",
      "I hid the route because admitting what I was doing means prison. The map is under the loose stone by the trough. Take it. I just didn't wake the castle.",
    ],
  },
  {
    key: "mara", name: "Mara Venn", asset: "mara",
    placements: [{ scene: "town", x: 570, y: 540 }, { scene: "halls", x: 220, y: 825 }],
    pages: [
      "The founders didn't create the Hollow. They learned when its unstable window happened and built the bells to warn people: stop at the first toll, move again after the second.",
      "Later they learned tuned bronze behaves more predictably than almost anything else during a Second Motion. That's when the warning system became part of the castle's containment system.",
      "These records tell us how they controlled part of it. They do not tell us where the Hollow came from. Don't turn a missing answer into one you want to hear.",
    ],
  },
];

export const monsters = [
  creature({
    name: "Veyrholt Road Refrain", asset: "roadRefrain", maxHp: 9, ac: 12,
    traits: [action("Fed by the Second Motion", "When a harmful Second Motion resolves within 10 feet, the Refrain can immediately move up to 10 feet without provoking opportunity attacks. If the restored handbell was the Stored Motion, the Refrain cannot use this trait and has disadvantage on its next attack.")],
    actions: [action("Echo Slam", "Melee Attack: +4 to hit, reach 5 ft. Hit: 1d6+2 force damage.", 4, "1d6+2", "Force")],
  }),
  creature({
    name: "Veyrholt Tithe Bailiff", asset: "titheBailiff", maxHp: 13, ac: 13, abilities: { str: 12, dex: 14, con: 15, int: 6, wis: 8, cha: 5 }, resistances: ["Force"],
    traits: [action("Named Collection", "A creature can use an action to read a correct animal name from the collection roll. One Bailiff spends its next turn escorting that animal instead of attacking.")],
    actions: [action("Collection Hook", "Melee Attack: +4 to hit, reach 5 ft. Hit: 1d6+2 slashing damage; the target is grappled (escape DC 12) if Large or smaller.", 4, "1d6+2", "Slashing")],
  }),
  creature({
    name: "Veyrholt Ledger Swarm", asset: "ledgerSwarm", size: "Small", type: "construct (swarm)", maxHp: 22, ac: 13, speed: 10,
    movement: { walk: 10, fly: 30, swim: 0, climb: 0, burrow: 0, hover: true },
    actions: [action("Binding Paper-Cut", "Melee Attack: +4 to hit, reach 5 ft. Hit: 2d4 slashing damage, and speed is reduced by 10 feet until the target uses an action to tear away the records.", 4, "2d4", "Slashing")],
  }),
  creature({
    name: "Veyrholt Processional Echo", asset: "titheBailiff", maxHp: 18, ac: 13,
    traits: [action("Bound to the Procession", "If the gate mechanism is deliberately made the First Motion, its Second Motion jars the processional defense and incapacitates this Echo until the end of its next turn.")],
    actions: [action("Echo Glaive", "Melee Attack: +4 to hit, reach 10 ft. Hit: 1d8+2 force damage.", 4, "1d8+2", "Force")],
  }),
  creature({
    name: "Veyrholt Bronze Ram", asset: "bronzeRam", size: "Large", maxHp: 37, ac: 15, tokenSize: 2,
    abilities: { str: 17, dex: 15, con: 15, int: 3, wis: 12, cha: 7 }, initiative: { modifier: 2, score: 12 },
    traits: [action("Charge", "If the ram moves at least 20 feet straight toward a target before a Horns hit, the target must succeed on a DC 12 Strength save or fall prone.")],
    actions: [action("Horns", "Melee Attack: +5 to hit, reach 5 ft. Hit: 2d6+3 bludgeoning damage.", 5, "2d6+3", "Bludgeoning")],
  }),
  creature({
    name: "Veyrholt Foundry Refrain", asset: "roadRefrain", maxHp: 14, ac: 12, vulnerabilities: ["Thunder"], immunities: ["Fire"],
    traits: [action("Unstable Resonance", "When tuned bronze or a prepared mold is the First Motion, the internal Second Motion destabilizes this Refrain; it loses reactions and has disadvantage on attacks until the end of its next turn.")],
    actions: [action("Forge Touch", "Melee Attack: +4 to hit, reach 5 ft. Hit: 1d6+2 fire damage.", 4, "1d6+2", "Fire")],
  }),
  creature({
    name: "Veyrholt Greyhook Scout", asset: "roadRefrain", type: "humanoid", maxHp: 18, ac: 13, abilities: { str: 11, dex: 14, con: 12, int: 11, wis: 13, cha: 11 },
    traits: [action("No Multiattack", "This road scout makes only one attack per turn and surrenders when both Greyhook bandits fall.")],
    actions: [action("Shortbow", "Ranged Attack: +4 to hit, range 80/320 ft. Hit: 1d6+2 piercing damage.", 4, "1d6+2", "Piercing")],
  }),
  creature({
    name: "The Bell Regent", asset: "bellRegent", maxHp: 72, ac: 16, tokenSize: 1.5,
    abilities: { str: 16, dex: 12, con: 16, int: 15, wis: 14, cha: 12 }, initiative: { modifier: 1, score: 11 }, savingThrows: { Constitution: 5, Wisdom: 3 },
    resistances: ["Nonmagical Bludgeoning", "Nonmagical Piercing", "Nonmagical Slashing"], languages: ["Common"], passivePerception: 12,
    notes: "DM-only Catalyst. Veyrholt uses First Motion / Second Motion. First Toll starts the six-second unsafe interval; only the first meaningful movement/action is stored. Second Toll resolves one simple distorted echo. If an anchor bell is rung/struck as the First Motion, its own vibration repeats inside the bronze for 14 thunder damage, ignoring resistance. Ward removes physical resistance; Command removes Commanding Toll; Crown lowers AC 16 to 14.",
    traits: [
      action("Bell Cycle", "First Toll: clear Stored Motion. The first meaningful movement/action before the Second Toll is stored. Only one motion is stored per cycle. If nobody else claims it before the Regent acts, its first Bellstaff attack becomes the Stored Motion."),
      action("Three Anchor Bells", "Ward, Command, and Crown anchors are AC 13 with 14 HP, immune to psychic and poison, and resistant to ordinary weapon damage. If an anchor is rung or struck as the First Motion, the Second Toll reproduces its vibration internally for 14 thunder damage that ignores resistance."),
      action("Toll of Assignment (once at half HP)", "Each creature makes a DC 13 Wisdom save. On a failure, speed becomes 0 until it uses an action to reject its assigned position. Pipp's tuning key or speaking Caldris's name grants advantage."),
    ],
    actions: [
      { ...action("Multiattack", "The Bell Regent makes two Bellstaff attacks."), kind: "MULTIATTACK", multiattack: { count: 2, options: "Bellstaff", description: "The Bell Regent makes two Bellstaff attacks." } },
      action("Bellstaff", "Melee Attack: +5 to hit, reach 5 ft. Hit: 1d8+3 bludgeoning damage.", 5, "1d8+3", "Bludgeoning"),
      { ...action("Commanding Toll", "Recharge 5–6. One creature within 60 feet must succeed on a DC 13 Wisdom save or move up to 15 feet toward an intact anchor bell by the safest available path. This ability is lost when the Command Anchor is destroyed."), usage: { kind: "RECHARGE", value: "5–6" } },
    ],
  }),
];

export const encounters = [
  { name: "Veyrholt — Toll-Takers and Road Refrains", members: [["Veyrholt Greyhook Scout", 1], ["Bandit", 2], ["Veyrholt Road Refrain", 2]], notes: "Bellpost Road teaches why Veyrholt freezes between bells. First Toll: clear Stored Motion. The first meaningful movement/action before the Second Toll becomes Stored Motion; later actions are not stored. Second Toll: stored movement creates a force-trace along that route (DC 12 Dex, 1d6 force and push 5 ft); stored attack/spell impact creates a 5-ft force burst at the impact point (DC 12 Dex, 1d6 force). If the recovered handbell is rung as the First Motion, its controlled second resonance disrupts the Road Refrains and they have disadvantage on their next attacks. Easy: remove one Refrain. Hard: add one Bandit." },
  { name: "Veyrholt — Bailiffs of the Empty Tithe", members: [["Veyrholt Tithe Bailiff", 3], ["Veyrholt Ledger Swarm", 1]], notes: "Old Tithe Barn teaches that the First Motion can be chosen on purpose. First Toll: clear Stored Motion. If a creature operates a prepared barn gate as the First Motion, the Second Toll makes that gate repeat the movement; a Bailiff in its path makes DC 12 Dex or takes 1d6 bludgeoning and falls prone. If an animal is the First Motion, its route leaves a force-trace along the old tithe lane. Reading a correct animal name still diverts one Bailiff for a round. Easy: 2 Bailiffs, swarm 16 HP. Hard: add a fourth Bailiff on round 3." },
  { name: "Veyrholt — Courtyard Sentinels", members: [["Animated Armor", 2], ["Veyrholt Processional Echo", 1]], notes: "Castle Court reinforces control of the First Motion. First Toll: clear Stored Motion. If a creature crosses a processional lane first, the Second Toll sends a force charge down that same lane (DC 12 Dex, 1d8 force and prone). If the party uses the gate mechanism as the First Motion instead, the repeated mechanism jars the defense and the Processional Echo is incapacitated until the end of its next turn. Bryn's authorization can prevent the Echo from joining at all. Easy: one armor starts at 15 HP. Hard: use full armor HP." },
  { name: "Veyrholt — The Recasting", members: [["Veyrholt Bronze Ram", 1], ["Veyrholt Foundry Refrain", 2]], notes: "Bellfoundry teaches the boss solution. First Toll: clear Stored Motion. If the first meaningful motion is striking a prepared tuned mold or the true foundry bell, the Second Toll reproduces the vibration inside the metal: the mold cracks for 2d8 thunder/bludgeoning to creatures within 5 ft and one Foundry Refrain has disadvantage on attacks until the end of its next turn. If a different movement/impact is stored, resolve a simple force line or 5-ft force burst for 1d6. Easy: one Refrain. Hard: Ram 45 HP and one 5 HP repair." },
  { name: "Veyrholt — Catalyst: The Bell Regent", members: [["The Bell Regent", 1]], notes: "Regent's Belfry is the payoff for the city tradition. At the First Toll, clear Stored Motion. The first meaningful movement/action in the belfry becomes Stored Motion; once stored, everyone acts normally. A creature already adjacent to an intact anchor can use a bonus action to ring/strike it. If that anchor interaction is the First Motion, the Second Toll reproduces the vibration inside the anchor for 14 thunder damage, ignoring resistance. Ward destroyed: remove physical resistance. Command destroyed: remove Commanding Toll. Crown destroyed: AC drops 16 to 14. If the wrong motion is stored, movement becomes a force line (DC 13 Dex, 1d8 force, push 5 ft) and an attack/spell impact becomes a 5-ft force burst (DC 13 Dex, 1d8 force). The Regent uses its own first Bellstaff attack as Stored Motion if the party has not claimed the interval before its turn. Bells can also be attacked normally. Easier: Regent 58 HP / bells 10 HP. Harder: Regent 88 HP / anchors 18 HP." },
];

export const placements = [
  { scene: "bellpost", monster: "Veyrholt Greyhook Scout", name: "Greyhook Scout", x: 1010, y: 335 },
  { scene: "bellpost", monster: "Bandit", name: "Greyhook Bandit 1", x: 920, y: 470 },
  { scene: "bellpost", monster: "Bandit", name: "Greyhook Bandit 2", x: 1040, y: 555 },
  { scene: "bellpost", monster: "Veyrholt Road Refrain", name: "Road Refrain 1", x: 620, y: 390 },
  { scene: "bellpost", monster: "Veyrholt Road Refrain", name: "Road Refrain 2", x: 705, y: 790 },
  { scene: "farms", monster: "Veyrholt Tithe Bailiff", name: "Tithe Bailiff 1", x: 480, y: 570 },
  { scene: "farms", monster: "Veyrholt Tithe Bailiff", name: "Tithe Bailiff 2", x: 610, y: 520 },
  { scene: "farms", monster: "Veyrholt Tithe Bailiff", name: "Tithe Bailiff 3", x: 710, y: 650 },
  { scene: "farms", monster: "Veyrholt Ledger Swarm", name: "Ledger Swarm", x: 585, y: 405 },
  { scene: "gate", monster: "Animated Armor", name: "Court Armor 1", x: 700, y: 425 },
  { scene: "gate", monster: "Animated Armor", name: "Court Armor 2", x: 1015, y: 520 },
  { scene: "gate", monster: "Veyrholt Processional Echo", name: "Processional Echo", x: 845, y: 315 },
  { scene: "foundry", monster: "Veyrholt Bronze Ram", name: "Bronze Ram", x: 645, y: 545 },
  { scene: "foundry", monster: "Veyrholt Foundry Refrain", name: "Foundry Refrain 1", x: 410, y: 705 },
  { scene: "foundry", monster: "Veyrholt Foundry Refrain", name: "Foundry Refrain 2", x: 850, y: 720 },
  { scene: "belfry", monster: "The Bell Regent", name: "The Bell Regent", x: 625, y: 630 },
];

export const discoverables = [
  { scene: "bellpost", name: "Seven-Notch Handbell", asset: "handbell", x: 790, y: 640 },
  { scene: "town", name: "Reeve's Clock Ledger", asset: "ledger", x: 540, y: 430 },
  { scene: "town", name: "Old Tithe Map", asset: "titheMap", x: 585, y: 515 },
  { scene: "farms", name: "Inherited Bell Collar", asset: "titheTag", x: 315, y: 545 },
  { scene: "farms", name: "Tithe Tag VII", asset: "titheTag", x: 655, y: 660 },
  { scene: "farms", name: "Collection Roll", asset: "ledger", x: 715, y: 540 },
  { scene: "gate", name: "Gatewright's Lesson", asset: "mural", x: 430, y: 360 },
  { scene: "halls", name: "Builder's Mural", asset: "mural", x: 565, y: 490 },
  { scene: "halls", name: "Caldris Portrait", asset: "anchorLeaves", x: 890, y: 280 },
  { scene: "halls", name: "Three Door Sketches", asset: "doors", x: 1060, y: 450 },
  { scene: "halls", name: "Anchor Design Leaves", asset: "anchorLeaves", x: 835, y: 665 },
  { scene: "halls", name: "Response Strip VII", asset: "ledger", x: 1030, y: 675 },
  { scene: "halls", name: "Lornwatch Route Strip", asset: "anchorLeaves", x: 1180, y: 725 },
  { scene: "belfry", name: "Veyrholt Catalyst Shard", asset: "fragments", x: 625, y: 530 },
];

export const links = [
  ["Greymere", "bellpost", "Messenger: Bellpost Road", 1180, 760],
  ["bellpost", "town", "Road to Veyrholt", 1130, 180],
  ["town", "bellpost", "West Road to Greymere", 155, 770],
  ["town", "farms", "Sunward Farms", 1115, 780],
  ["farms", "town", "Veyrholt South Gate", 155, 170],
  ["town", "gate", "Castle Ring Road", 890, 260],
  ["town", "halls", "Chapel Undercroft", 325, 690],
  ["farms", "foundry", "Hidden Tithe Culvert", 1060, 1010],
  ["gate", "halls", "Hall of Measures", 1370, 175],
  ["halls", "gate", "Back to the Court", 130, 860],
  ["halls", "town", "Chapel Reliquary Stair", 250, 180],
  ["halls", "foundry", "Pendulum Stair", 1375, 820],
  ["foundry", "halls", "Archive Service Stair", 150, 180],
  ["foundry", "belfry", "Regent's Stair", 1040, 170],
  ["belfry", "foundry", "Return to the Foundry", 170, 1060],
  ["belfry", "town", "Aftermath: Veyrholt", 1110, 1070],
];

export const zoneMarkers = [
  { scene: "belfry", label: "Ward Anchor Bell", x: 355, y: 385, radiusFt: 10, color: "#d49a3a" },
  { scene: "belfry", label: "Command Anchor Bell", x: 905, y: 380, radiusFt: 10, color: "#d49a3a" },
  { scene: "belfry", label: "Crown Anchor Bell", x: 625, y: 905, radiusFt: 10, color: "#d49a3a" },
];

export const notes = [
  {
    title: "[Veyrholt] 00 — Run Sheet",
    body: "DM ONLY. Greymere Catalyst -> Level 2 -> existing Messenger -> Bellpost Road -> Level 3 -> Veyrholt. Town investigation: missing livestock follows an old tithe route. Castle order: Gate/Pens/Court -> Hall/Archive/Banquet -> Bellfoundry -> Regent's Belfry. All new scenes begin inactive and unrevealed. Milestone to Level 4 after the Bell Regent. Never state that Greymere caused Veyrholt; present only the same-night correlation. The current bell mechanic is defined in VEYRHOLT_BELL_REVISION.md and supersedes old Call/Answer and full-round replay text.",
  },
  {
    title: "[Veyrholt] 01 — Clue & Fail-Forward Map",
    body: "Second Motion: Bellpost visibly demonstrates why people freeze -> town shows first bell stop / second bell continue as ordinary habit -> Nessa explains the first meaningful motion is caught -> Barn teaches choosing an object as First Motion -> Court tests controlling it under pressure -> Foundry shows tuned bronze can break itself when its vibration becomes the Second Motion -> Bell Regent anchors use that exact weakness. Old tithe: farm tracks / archive map / Kest-Tamsin; if missed, a sheep follows the route in daylight. Animals alive: witness / collection roll / visible Echo Pens. Castle predates the current crisis: mural / archive baseline / Caldris memory. Lornwatch: route strip / Catalyst backup strip / Mara. A failed roll adds cost or danger, never removes access.",
  },
  {
    title: "[Veyrholt] 02 — NPC Secrets",
    body: "Elian suppressed one same-night clock entry to prevent panic. Bryn concealed a missing scout. Nessa's ancestor helped maintain the anchor bells, and her stolen mold can recast them. Avra has heard the double toll in dreams and knows Caldris's name and role. Tamsin followed Kest and knows the animals live. Kest used the culvert for smuggling but did not awaken the castle. Mara deliberately filed ward records as repairs. Caldris is the Bell Regent: a mortal duty made into a restraint, not the creator of the Hollow.",
  },
  {
    title: "[Veyrholt] 03 — Encounter Mechanics",
    body: "First bell means STOP; second bell means the dangerous six-second interval is over. The Hollow stores only the first meaningful movement/action after the First Toll. At the Second Toll, resolve one simple distorted echo: movement becomes a force path, an attack/spell impact becomes a small force burst, machinery repeats its motion, and tuned bronze reproduces its vibration internally. Only one Stored Motion exists per cycle. Do not replay the whole round or roll the original attack/spell again. The party progressively learns to choose what becomes the First Motion. Bell Regent payoff: position beside an anchor before the First Toll, make ringing/striking it the First Motion, then let the Second Toll crack it from inside.",
  },
  {
    title: "[Veyrholt] 04 — Lasting Canon & Aftermath",
    body: "DM ONLY. Veyrholt's ancestors discovered a recurring six-second instability in the Hollow and synchronized warning bells to it. First toll meant stop; second toll meant continue. Later builders learned tuned bronze creates predictable Second Motions and built that behavior into Castle Veyr's containment system. Modern residents preserved the habit while forgetting the reason. The Catalyst was constructed to impose a stable civic-shaped pattern on something older. Destroying it ends the uncontrolled Second Motions, returns the animals, and leaves the castle finite and unstable. Rewards: Veyrholt Catalyst Shard, 120 gp, Echo-Step Brooch, Wayfarer Writ, Level 4. Unresolved: whether Greymere triggered Veyrholt, who numbered RESPONSE VII, and why Lornwatch's watcher is absent. Next: Lornwatch Abbey. The doorway sketches remain unexplained atmosphere.",
  },
];

export const messengerPages = [
  "The courier pulls a sealed letter from a rain-soaked satchel. The seal has seven small notches.",
  "Veyrholt has always had one strange rule: when the first bell rings, everyone stops until the second. Now travelers who move between those bells are seeing their movement come back at them a few seconds later.",
  "Animals are disappearing from farms around Castle Veyr. Every missing animal was wearing one of the old inherited bells.",
  "The first uncontrolled double toll happened the same night Greymere's Hollow went quiet. I don't know if those events are connected. I do know Veyrholt needs help now.",
];

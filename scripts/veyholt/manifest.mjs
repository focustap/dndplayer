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
  notes: "DM-only Veyrholt creature. See the [Veyrholt] Encounter Mechanics campaign note and docs/campaign/chapters/VEYRHOLT.md.",
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
      "Veyrholt can endure a bad harvest. It cannot endure roads that repeat travelers and a castle that changes its own doors.",
      "The missing livestock looked like theft until the old tithe route appeared under every trail. I need proof before panic turns the town against itself.",
      "The first double toll was recorded the same night your Greymere Hollow fell. That is a correlation, not a verdict—but I will not pretend it is comforting.",
    ],
  },
  {
    key: "bryn", name: "Captain Bryn Halvek", asset: "bryn",
    placements: [{ scene: "town", x: 730, y: 360 }, { scene: "gate", x: 245, y: 780 }],
    pages: [
      "The keep has been predictable for longer than anyone alive. Since the double toll, my patrol reports are repeating themselves before I file them.",
      "The old cadence is: stand, name, purpose, passage. Speak it at the court, and the processional guard may remember you as authorized.",
      "I concealed one scout's disappearance to prevent a rush on the gates. That choice bought order and cost trust.",
    ],
  },
  {
    key: "nessa", name: "Nessa Calder", asset: "nessa",
    placements: [{ scene: "town", x: 935, y: 565 }], type: "BOTH",
    pages: [
      "A bell does not merely ring here. It tells the Hollow when an action begins and when the answer is due.",
      "My missing master mold was taken toward the tithe barn. If it reaches the old foundry, the castle can recast the anchors that once kept it quiet.",
      "Bring me a true sample and I can tell resonance from haunting. Those are different problems, no matter what the chapel says.",
    ],
    shop: [
      { name: "Resonance chalk", description: "Marks one five-foot line so the next Second Motion is easy to track.", priceGp: 5, quantity: 4 },
      { name: "Bellwax", description: "One use; grants advantage on a save against a toll or bell effect.", priceGp: 3, quantity: 6 },
      { name: "Brass earplugs", description: "Useful against noise, but not force created by a replay.", priceGp: 1, quantity: null },
    ],
  },
  {
    key: "avra", name: "Sister Avra Seln", asset: "avra",
    placements: [{ scene: "town", x: 330, y: 655 }],
    pages: [
      "The Last Chime teaches that every duty must end. Veyrholt's old wards have forgotten that mercy.",
      "Caldris Veyr swore: I hold the measure so no answering hand finds purchase. His name and oath may still reach whatever remains.",
      "I dreamed of a door drawn three ways. I do not know what it means, and I will not build doctrine from a nightmare.",
    ],
  },
  {
    key: "tamsin", name: "Tamsin Reed", asset: "tamsin",
    placements: [{ scene: "town", x: 1110, y: 770 }, { scene: "farms", x: 295, y: 790 }],
    pages: [
      "They did not steal the whole flock. Only the animals wearing bells passed down from our grandparents.",
      "I saw my ram twice on the old road—one solid, one a few steps behind. Both turned toward the castle when the second bell sounded.",
      "Kest lied about the culvert, but he was trying to hide smuggling, not this. I followed him far enough to know the animals are still alive.",
    ],
  },
  {
    key: "kest", name: "Kest Rane", asset: "kest",
    placements: [{ scene: "farms", x: 970, y: 705 }],
    pages: [
      "I used the dry tithe culvert for untaxed wool. Then it started breathing warm air and putting my footprints down ahead of me.",
      "I hid the route because confession means prison. The map is under the loose trough-stone. Take it—just do not call me the thing that woke the castle.",
    ],
  },
  {
    key: "mara", name: "Mara Venn", asset: "mara",
    placements: [{ scene: "town", x: 570, y: 540 }, { scene: "halls", x: 220, y: 825 }],
    pages: [
      "The records never say the founders created the anomaly. They say they measured it, enclosed it, and taught it a schedule.",
      "The useful leaves are filed under municipal repairs, not occult matters. Someone wanted the truth to look boring.",
      "Do not confuse an incomplete archive with permission to finish its sentences. Some of these diagrams are observations, not explanations.",
    ],
  },
];

export const monsters = [
  creature({
    name: "Veyrholt Road Refrain", asset: "roadRefrain", maxHp: 9, ac: 12,
    traits: [action("Violence Repeated", "The Refrain records the last weapon attack made within 10 feet. On its next initiative, it repeats that line against the attacker's former space at +4 for 1d6+2 force damage.")],
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
    traits: [action("No Reactions", "The Processional Echo cannot take reactions and always charges in a straight line when possible.")],
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
    actions: [action("Forge Touch", "Melee Attack: +4 to hit, reach 5 ft. Hit: 1d6+2 fire damage.", 4, "1d6+2", "Fire")],
  }),
  creature({
    name: "Veyrholt Greyhook Scout", asset: "roadRefrain", type: "humanoid", maxHp: 18, ac: 13, abilities: { str: 11, dex: 14, con: 12, int: 11, wis: 13, cha: 11 },
    traits: [action("No Multiattack", "This road scout makes only one attack per turn and surrenders when both Greyhook bandits fall.")],
    actions: [action("Shortbow", "Ranged Attack: +4 to hit, range 80/320 ft. Hit: 1d6+2 piercing damage.", 4, "1d6+2", "Piercing")],
  }),
  creature({
    name: "The Bell Regent", asset: "bellRegent", maxHp: 72, ac: 15, tokenSize: 1.5,
    abilities: { str: 16, dex: 12, con: 16, int: 15, wis: 14, cha: 12 }, initiative: { modifier: 1, score: 11 }, savingThrows: { Constitution: 5, Wisdom: 3 },
    resistances: ["Nonmagical Bludgeoning", "Nonmagical Piercing", "Nonmagical Slashing"], languages: ["Common"], passivePerception: 12,
    notes: "DM-only Catalyst. Physical resistance lasts only while two or more anchor bells remain. First bell removes it; second removes Command the Refrain; third lowers AC to 14. Use Record at initiative 20 and Second Motion at initiative 10.",
    traits: [
      action("Three Anchor Bells", "Each bell is AC 13, 14 HP, immune to psychic and poison, resistant to ordinary weapons, and vulnerable to thunder and replayed damage. Replayed damage and the Anchor Hammer deal double damage."),
      action("Toll of Assignment (once at half HP)", "Each creature makes a DC 13 Wisdom save. On a failure, speed becomes 0 until it uses an action to reject its assigned position. Pipp's tuning key or Caldris's oath grants advantage."),
    ],
    actions: [
      { ...action("Multiattack", "The Bell Regent makes two Bellstaff attacks."), kind: "MULTIATTACK", multiattack: { count: 2, options: "Bellstaff", description: "The Bell Regent makes two Bellstaff attacks." } },
      action("Bellstaff", "Melee Attack: +5 to hit, reach 5 ft. Hit: 1d8+3 bludgeoning damage.", 5, "1d8+3", "Bludgeoning"),
      { ...action("Command the Refrain", "Recharge 5–6. Immediately trigger one visible recorded attack or movement."), usage: { kind: "RECHARGE", value: "5–6" } },
    ],
  }),
];

export const encounters = [
  { name: "Veyrholt — Toll-Takers and Road Refrains", members: [["Veyrholt Greyhook Scout", 1], ["Bandit", 2], ["Veyrholt Road Refrain", 2]], notes: "Bellpost Road. Shallow water is difficult terrain; arches grant half cover. Initiative 10 replays the last channel crossing (DC 12 Dex, 1d6 force, push 5 ft). Ringing the handbell suppresses Refrains until initiative 10 next round. Easy: remove one Refrain. Hard: add one Bandit." },
  { name: "Veyrholt — Bailiffs of the Empty Tithe", members: [["Veyrholt Tithe Bailiff", 3], ["Veyrholt Ledger Swarm", 1]], notes: "Old Tithe Barn. Pens are difficult terrain on odd rounds and solid cover on even rounds. At initiative 10, the last operated gate repeats. Reading a correct animal name diverts one Bailiff for a round. Easy: 2 Bailiffs, swarm 16 HP. Hard: add a fourth Bailiff on round 3." },
  { name: "Veyrholt — Courtyard Sentinels", members: [["Animated Armor", 2], ["Veyrholt Processional Echo", 1]], notes: "Castle Court. Initiative 10 charges the last occupied patrol line (DC 12 Dex, 1d8 force and prone). Bryn's token/cadence prevents the Echo joining. Armors stop if returned to plinths at the second toll. Easy: one armor starts at 15 HP. Hard: use full armor HP." },
  { name: "Veyrholt — The Recasting", members: [["Veyrholt Bronze Ram", 1], ["Veyrholt Foundry Refrain", 2]], notes: "Bellfoundry. Two marked pour channels replay on initiative 10 for 2d6 fire, DC 12 Dex half. Drop a mold (AC 12) for 2d8 bludgeoning and cool one route. A true bell, Pipp's tuning key, or Silence disables one Refrain for a round. Easy: one Refrain, 2d4 channels. Hard: Ram 45 HP and one 5 HP repair." },
  { name: "Veyrholt — Catalyst: The Bell Regent", members: [["The Bell Regent", 1]], notes: "Regent's Belfry. Initiative 20 records spaces and recent lines; initiative 10 repeats them. Replayed weapon lines: +4, 1d6+2 force. Spells become 5-ft bursts for 1d6 force, DC 12 Dex half. Movement lines push 5 ft, DC 12 Str negates. Never repeat healing, conditions, slots, or resource costs. Every bell is reachable. Easier 58 HP/10 HP bells; harder 88 HP plus one Foundry Refrain." },
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
  { scene: "belfry", label: "Anchor Bell I", x: 355, y: 385, radiusFt: 10, color: "#d49a3a" },
  { scene: "belfry", label: "Anchor Bell II", x: 905, y: 380, radiusFt: 10, color: "#d49a3a" },
  { scene: "belfry", label: "Anchor Bell III", x: 625, y: 905, radiusFt: 10, color: "#d49a3a" },
];

export const notes = [
  {
    title: "[Veyrholt] 00 — Run Sheet",
    body: "DM ONLY. Greymere Catalyst -> Level 2 -> existing Messenger -> Bellpost Road -> Level 3 -> Veyrholt. Town investigation: missing livestock follows an old tithe route. Castle order: Gate/Pens/Court -> Hall/Archive/Banquet -> Bellfoundry -> Regent's Belfry. All new scenes begin inactive and unrevealed. Milestone to Level 4 after the Bell Regent. Never state that Greymere caused Veyrholt; present only the same-night correlation.",
  },
  {
    title: "[Veyrholt] 01 — Clue & Fail-Forward Map",
    body: "Second Motions: automatic road demonstration / double toll / Gatewright lesson. Bells regulate: road handbell / Nessa / mural. Old tithe: farm tracks / archive map / Kest-Tamsin; if missed, a sheep walks it in daylight. Animals alive: witness / collection roll / visible Echo Pens. Castle predates current pattern: mural / archive baseline / Caldris memory; archive record is automatic. Replays break bells: Arcana DC 12 / foundry diagram / first accidental replay visibly cracks one. Lornwatch: route strip / Catalyst backup strip / Mara. A failed roll adds cost or danger, never removes access.",
  },
  {
    title: "[Veyrholt] 02 — NPC Secrets",
    body: "Elian suppressed one same-night clock entry to prevent panic. Bryn concealed a missing scout. Nessa's ancestor helped maintain the anchor bells, and her stolen mold can recast them. Avra has heard the double toll in dreams and knows Caldris's oath. Tamsin followed Kest and knows the animals live. Kest used the culvert for smuggling but did not awaken the castle. Mara deliberately filed ward records as repairs. Caldris is the Bell Regent: a mortal duty made into a restraint, not the creator of the Hollow.",
  },
  {
    title: "[Veyrholt] 03 — Encounter Mechanics",
    body: "Second Motion is this Hollow's signature. Record at initiative 20; replay at initiative 10. Telegraph every replay with visible positions and lines. Players can move away, aim a recorded line at enemies or bells, or deliberately record a useful action. Never replay healing, conditions, spell slots, or resources. Road: channel replay + handbell suppresses Refrains. Barn: alternating pens + repeating gates. Court: patrol lines. Foundry: moving pour routes. Boss: three bells dismantle resistance, command, then AC. See prepared encounter notes for exact DCs/scaling.",
  },
  {
    title: "[Veyrholt] 04 — Lasting Canon & Aftermath",
    body: "DM ONLY. The Veyrholt Catalyst was constructed to impose a stable, civic-shaped pattern on something older. This reveals Catalysts can be made or installed as restraints; it does not reveal the campaign's final world-scale truth. Destroying it ends forced replays, returns the animals, and makes the castle structurally unstable but finite. Rewards: Veyrholt Catalyst Shard, 120 gp, Echo-Step Brooch, Wayfarer Writ, and Level 4 milestone. Unresolved: whether Greymere triggered Veyrholt, who numbered RESPONSE VII, what is answering, and why Lornwatch's watcher is absent. Next: Lornwatch Abbey. The three inconsistent doorway sketches are atmosphere only; do not explain or name their true significance to players.",
  },
];

export const messengerPages = [
  "A bronze-masked courier waits in Greymere, rain running from a seal marked by seven small notches.",
  "Veyrholt's second bell has begun sounding on its own. The west road returns travelers to their own footprints, sometimes before they make them.",
  "Flocks are vanishing from farms that have stood beside Castle Veyr for generations. Only the animals with inherited bells are taken.",
  "The first double toll came the same night Greymere's Hollow went silent. I cannot tell you what that means. I can tell you the keep has begun to answer.",
];

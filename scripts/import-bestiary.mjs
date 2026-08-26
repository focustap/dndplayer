import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];
const CONDITIONS = new Set(["Blinded", "Charmed", "Deafened", "Exhaustion", "Frightened", "Grappled", "Incapacitated", "Invisible", "Paralyzed", "Petrified", "Poisoned", "Prone", "Restrained", "Stunned", "Unconscious"]);
const DAMAGE_TYPES = new Set(["Acid", "Bludgeoning", "Cold", "Fire", "Force", "Lightning", "Necrotic", "Piercing", "Poison", "Psychic", "Radiant", "Slashing", "Thunder"]);

const clean = (value) => value.replace(/\r/g, "").replace(/\*+/g, "").replace(/\s{2,}/g, " ").trim();
const number = (value) => value === undefined ? null : Number(value);
const splitList = (value) => value && value !== "—" ? value.split(/,\s*/).map(clean).filter(Boolean) : [];

function splitStatBlocks(markdown) {
  const starts = [...markdown.matchAll(/^>##\s+(.+)$/gm)];
  return starts.map((match, index) => {
    const name = clean(match[1]);
    const end = starts[index + 1]?.index ?? markdown.length;
    const full = markdown.slice(match.index, end);
    const statEnd = full.indexOf(`\n## ${name}\n`);
    return { name, block: full.slice(0, statEnd === -1 ? full.length : statEnd) };
  });
}

function quotedLines(block) {
  return block.split("\n").map((line) => line.replace(/^>\s?/, "")).join("\n");
}

function fieldLines(block) {
  const fields = new Map();
  for (const match of block.matchAll(/^- \*\*([^*]+)\*\*\s*(.*)$/gm)) fields.set(clean(match[1]), clean(match[2]));
  return fields;
}

function parseAbilities(block) {
  const rows = [...block.matchAll(/^\|([^\n]+)\|$/gm)].map((match) => match[1].split("|").map((cell) => clean(cell)).filter(Boolean));
  const values = rows.find((row) => row.length === 6 && row.every((cell) => /^-?\d+\s*\(/.test(cell)));
  if (!values) throw new Error("Ability score table is missing or malformed.");
  return Object.fromEntries(ABILITIES.map((ability, index) => [ability, Number(values[index].match(/^-?\d+/)?.[0] ?? 10)]));
}

function parseSizeAndType(block) {
  const match = block.match(/^\*([^\n]+)\*$/m);
  if (!match) throw new Error("Creature size/type line is missing.");
  const [beforeAlignment] = clean(match[1]).split(/,\s*/);
  const sizeMatch = beforeAlignment.match(/^(Tiny|Small|Medium|Large|Huge|Gargantuan)(?:\s+or\s+(Tiny|Small|Medium|Large|Huge|Gargantuan))?\s+(.+)$/);
  if (!sizeMatch) throw new Error("Creature size/type line is malformed.");
  return { size: sizeMatch[2] ? `${sizeMatch[1]} or ${sizeMatch[2]}` : sizeMatch[1], creatureType: sizeMatch[3] };
}

function parseMovement(value) {
  const movement = { walk: 0, fly: 0, swim: 0, climb: 0, burrow: 0, hover: false };
  for (const part of value.split(/,\s*/)) {
    const match = part.match(/^(?:(Walk|Fly|Swim|Climb|Burrow)\s+)?(\d+)\s*ft\.?/i);
    if (!match) continue;
    const key = (match[1] ?? "walk").toLowerCase();
    movement[key] = Number(match[2]);
    if (/hover/i.test(part)) movement.hover = true;
  }
  return movement;
}

function parseBonuses(value) {
  return Object.fromEntries([...value.matchAll(/([A-Za-z ]+?)\s*([+-]\d+)/g)].map((match) => [clean(match[1]), Number(match[2])]));
}

function parseSenses(value) {
  const senses = [];
  let passivePerception = null;
  for (const part of value.split(/,\s*/)) {
    const passive = part.match(/^Passive Perception\s+(\d+)/i);
    if (passive) { passivePerception = Number(passive[1]); continue; }
    const range = part.match(/^(.+?)\s+(\d+)\s*ft\.?/i);
    senses.push(range ? { name: clean(range[1]), range: Number(range[2]), unit: "ft" } : { name: clean(part) });
  }
  return { senses, passivePerception };
}

function parseImmunities(value) {
  const [damagePart = "", conditionPart = ""] = value.split(";");
  const damage = splitList(damagePart).filter((item) => DAMAGE_TYPES.has(item));
  const conditions = [...splitList(damagePart), ...splitList(conditionPart)].filter((item) => CONDITIONS.has(item));
  return { damage, conditions };
}

function parseUsage(name, description) {
  const source = `${name} ${description}`;
  const recharge = source.match(/Recharge\s+([\d–-]+(?:\s*\([^)]*\))?)/i);
  if (recharge) return { kind: "RECHARGE", value: clean(recharge[1]) };
  const perDay = source.match(/(\d+)\s*\/\s*Day(?:\s+each)?/i);
  if (perDay) return { kind: "PER_DAY", uses: Number(perDay[1]), each: /each/i.test(perDay[0]) };
  return null;
}

function parseDamage(description) {
  const components = [];
  for (const match of description.matchAll(/(?:(\d+)\s*)?\(([^)]+)\)\s+(Acid|Bludgeoning|Cold|Fire|Force|Lightning|Necrotic|Piercing|Poison|Psychic|Radiant|Slashing|Thunder)\s+damage/gi)) {
    const dice = clean(match[2]);
    const flatBonus = dice.match(/[+-]\s*(\d+)$/)?.[1];
    components.push({ average: number(match[1]), dice, flatBonus: flatBonus ? Number(flatBonus) : 0, damageType: match[3] });
  }
  return components;
}

function parseEffects(description) {
  return [...description.matchAll(/(?:has|gain(?:s)?) the ([A-Z][a-z]+) condition/gi)].map((match) => match[1]).filter((condition) => CONDITIONS.has(condition));
}

function parseSpells(description) {
  const ability = description.match(/using ([A-Za-z]+) as the spellcasting ability/i)?.[1] ?? null;
  const saveDc = number(description.match(/spell save DC\s+(\d+)/i)?.[1]);
  const attackBonus = number(description.match(/([+-]\d+)\s+to hit with spell attacks/i)?.[1]);
  const spells = [...description.matchAll(/(?:^|\n)(At will|\d+\/day(?: each)?):\s*([^\n]+)/gi)].map((match) => ({ frequency: clean(match[1]), spells: clean(match[2]).split(/,\s*/).map((spell) => clean(spell)) }));
  return { ability, saveDc, attackBonus, spells };
}

function parseMultiattack(description) {
  const match = description.match(/makes? (one|two|three|four|five|six|\d+) (.+?)(?: attacks?|\.)/i);
  if (!match) return { description };
  const amounts = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
  return { count: amounts[match[1].toLowerCase()] ?? Number(match[1]), options: clean(match[2]), description };
}

function parseVariants(description) {
  return [...description.matchAll(/^- \*\*([^*]+?)\.\*\*\s*(.+)$/gm)].map((match) => parseAction(clean(match[1]), clean(match[2])));
}

function parseAction(name, sourceDescription) {
  const description = clean(sourceDescription);
  const mechanics = clean(sourceDescription.split(/\n- \*\*/)[0]);
  const attack = mechanics.match(/(Melee(?:\s+or\s+Ranged)?|Ranged|Spell)\s+Attack Roll:\s*([+-]\d+)/i);
  const attackType = attack ? attack[1].replace(/\s+/g, "_").toUpperCase() : "OTHER";
  const save = mechanics.match(/(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) Saving Throw:\s*DC\s*(\d+)/i);
  const reach = number(mechanics.match(/reach\s+(\d+)\s*ft\.?/i)?.[1]);
  const range = mechanics.match(/range\s+(\d+)(?:\s*\/\s*(\d+))?\s*ft\.?/i);
  const action = { name, description, kind: /^multiattack$/i.test(name) ? "MULTIATTACK" : "ACTION", usage: parseUsage(name, ""), attackType, attackBonus: attack ? Number(attack[2]) : null, reach, range: range ? { normal: Number(range[1]), long: number(range[2]), unit: "ft" } : null, damage: parseDamage(mechanics), save: save ? { ability: save[1].slice(0, 3).toUpperCase(), dc: Number(save[2]) } : null, conditions: parseEffects(mechanics), effects: [], variants: [] };
  if (/spellcasting/i.test(name)) action.spellcasting = parseSpells(sourceDescription);
  if (action.kind === "MULTIATTACK") action.multiattack = parseMultiattack(description);
  action.variants = parseVariants(sourceDescription);
  return action;
}

function parseEntries(section, bulletEntries = false) {
  if (!section) return [];
  const prefix = bulletEntries ? "(?:\\*\\*\\*|- \\*\\*)" : "\\*\\*\\*";
  const expression = new RegExp(`^${prefix}(.+?)\\.\\*{2,3}\\s*`, "gm");
  const matches = [...section.matchAll(expression)];
  return matches.map((match, index) => parseAction(clean(match[1]), section.slice(match.index + match[0].length, matches[index + 1]?.index ?? section.length).trim()));
}

function section(block, title) {
  const heading = new RegExp(`^### ${title}\\s*$`, "m").exec(block);
  if (!heading || heading.index === undefined) return "";
  const start = heading.index + heading[0].length;
  const remainder = block.slice(start);
  const nextHeading = remainder.search(/^### /m);
  return remainder.slice(0, nextHeading === -1 ? remainder.length : nextHeading).trim();
}

export function parseBestiaryMarkdown(markdown) {
  const monsters = splitStatBlocks(markdown).map(({ name, block: rawBlock }) => {
    const block = quotedLines(rawBlock);
    const fields = fieldLines(block);
    const { size, creatureType } = parseSizeAndType(block);
    const hp = fields.get("Hit Points")?.match(/(\d+)(?:\s*\(([^)]+)\))?/);
    const ac = fields.get("Armor Class")?.match(/\d+/)?.[0];
    if (!hp || !ac) throw new Error(`${name}: AC or HP is missing.`);
    const senses = parseSenses(fields.get("Senses") ?? "");
    const immunity = parseImmunities(fields.get("Immunities") ?? "");
    const beforeActions = block.slice(0, block.search(/^### /m));
    const traits = parseEntries(beforeActions);
    const actions = parseEntries(section(block, "Actions"));
    const bonusActions = parseEntries(section(block, "Bonus Actions"));
    const reactions = parseEntries(section(block, "Reactions"));
    const legendarySection = section(block, "Legendary Actions");
    const legendaryUses = number(legendarySection.match(/Legendary Action Uses:\s*(\d+)/i)?.[1]);
    const legendaryActions = parseEntries(legendarySection, true);
    const spellcasting = [...actions, ...bonusActions, ...reactions, ...legendaryActions].filter((action) => action.spellcasting).map((action) => ({ actionName: action.name, ...action.spellcasting }));
    return {
      name, size, creatureType,
      ac: Number(ac), maxHp: Number(hp[1]), hpFormula: hp[2] ? clean(hp[2]) : null,
      movement: parseMovement(fields.get("Speed") ?? "0 ft."),
      initiative: { modifier: number(fields.get("Initiative")?.match(/([+-]?\d+)/)?.[1]), score: number(fields.get("Initiative")?.match(/\((\d+)\)/)?.[1]) },
      abilities: parseAbilities(block),
      savingThrows: parseBonuses(fields.get("Saving Throws") ?? ""), skills: parseBonuses(fields.get("Skills") ?? ""),
      damageVulnerabilities: splitList(fields.get("Damage Vulnerabilities") ?? ""), damageResistances: splitList(fields.get("Damage Resistances") ?? ""), damageImmunities: immunity.damage,
      conditionImmunities: immunity.conditions, senses: senses.senses, passivePerception: senses.passivePerception,
      languages: splitList(fields.get("Languages") ?? ""), traits, actions, bonusActions, reactions, legendaryActions,
      legendaryActionUses: legendaryUses, spellcasting,
    };
  });
  if (new Set(monsters.map((monster) => monster.name)).size !== monsters.length) throw new Error("Duplicate monster names in source.");
  return monsters;
}

function templateRow(monster) {
  return { name: monster.name, creature_size: monster.size, creature_type: monster.creatureType, max_hp: monster.maxHp, hp_formula: monster.hpFormula, ac: monster.ac, speed: monster.movement.walk, movement: monster.movement, initiative: monster.initiative, abilities: monster.abilities, saving_throws: monster.savingThrows, skills: monster.skills, damage_vulnerabilities: monster.damageVulnerabilities, damage_resistances: monster.damageResistances, damage_immunities: monster.damageImmunities, condition_immunities: monster.conditionImmunities, senses: monster.senses, passive_perception: monster.passivePerception, languages: monster.languages, traits: monster.traits, actions: monster.actions, bonus_actions: monster.bonusActions, reactions: monster.reactions, legendary_actions: monster.legendaryActions, legendary_action_uses: monster.legendaryActionUses, spellcasting: monster.spellcasting };
}

function sqlForTemplates(monsters) {
  const rows = monsters.map(templateRow);
  const payload = JSON.stringify(rows).replaceAll("$bestiary$", "$ bestiary $");
  const columns = "name,creature_size,creature_type,max_hp,hp_formula,ac,speed,movement,initiative,abilities,saving_throws,skills,damage_vulnerabilities,damage_resistances,damage_immunities,condition_immunities,senses,passive_perception,languages,traits,actions,bonus_actions,reactions,legendary_actions,legendary_action_uses,spellcasting";
  return `with source_rows as (select * from jsonb_populate_recordset(null::public.monster_templates, $bestiary$${payload}$bestiary$::jsonb)) insert into public.monster_templates (${columns}) select ${columns} from source_rows where not exists (select 1 from public.monster_templates existing where existing.name = source_rows.name);`;
}

async function importTemplates(monsters) {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const accessToken = process.env.WAYFINDER_ACCESS_TOKEN;
  if (!url || !key || !accessToken) throw new Error("Set VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, and WAYFINDER_ACCESS_TOKEN to import. The token must belong to an OWNER or DM of any campaign.");
  const supabase = createClient(url, key, { global: { headers: { Authorization: `Bearer ${accessToken}` } } });
  const { data: existing, error: readError } = await supabase.from("monster_templates").select("name");
  if (readError) throw readError;
  const existingNames = new Set((existing ?? []).map((row) => row.name));
  const rows = monsters.filter((monster) => !existingNames.has(monster.name)).map(templateRow);
  if (!rows.length) return { inserted: 0, skipped: monsters.length };
  const { error: insertError } = await supabase.from("monster_templates").insert(rows);
  if (insertError) throw insertError;
  return { inserted: rows.length, skipped: monsters.length - rows.length };
}

async function main() {
  const [source, ...args] = process.argv.slice(2);
  if (!source) throw new Error("Usage: node scripts/import-bestiary.mjs <bestiary.md> [--out <file>] [--summary] [--exclude <exact name>] [--apply]");
  let monsters = parseBestiaryMarkdown(await readFile(resolve(source), "utf8"));
  const excluded = args.flatMap((value, index) => value === "--exclude" ? [args[index + 1]] : []).filter(Boolean);
  const sourceNames = new Set(monsters.map((monster) => monster.name));
  for (const name of excluded) if (!sourceNames.has(name)) throw new Error(`Cannot exclude '${name}': it is not present exactly in the source.`);
  monsters = monsters.filter((monster) => !excluded.includes(monster.name));
  const outIndex = args.indexOf("--out");
  if (outIndex !== -1) await writeFile(resolve(args[outIndex + 1]), `${JSON.stringify(monsters, null, 2)}\n`);
  if (args.includes("--apply")) {
    if (!monsters.length) throw new Error("Refusing to import an empty source.");
    console.log(JSON.stringify(await importTemplates(monsters), null, 2));
    return;
  }
  const sqlIndex = args.indexOf("--sql");
  if (sqlIndex !== -1) {
    const [start = "0", end = String(monsters.length)] = (args[args.indexOf("--slice") + 1] ?? `0:${monsters.length}`).split(":");
    console.log(sqlForTemplates(monsters.slice(Number(start), Number(end))));
    return;
  }
  if (args.includes("--summary")) console.log(JSON.stringify({ count: monsters.length, names: monsters.map((monster) => monster.name), validation: Object.fromEntries(["Bandit", "Basilisk", "Beholder", "Adult Red Dragon", "Animated Armor"].map((name) => { const monster = monsters.find((item) => item.name === name); return [name, monster ? { hp: monster.maxHp, actions: monster.actions.map((action) => action.name), legendaryActions: monster.legendaryActions.map((action) => action.name) } : null]; })) }, null, 2));
  else if (outIndex === -1) console.log(JSON.stringify(monsters, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error.message); process.exitCode = 1; });

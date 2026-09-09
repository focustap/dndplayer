import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { assets, discoverables, encounters, links, messengerPages, monsters, notes, npcs, partyEntries, placements, scenes, zoneMarkers } from "./veyholt/manifest.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const assetRoot = resolve(repoRoot, "assets/campaign/veyholt");

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name} before applying the Veyrholt import.`);
  return value;
};

const args = process.argv.slice(2);
const campaignIndex = args.indexOf("--campaign-id");
const campaignId = campaignIndex >= 0 ? args[campaignIndex + 1] : "";
const apply = args.includes("--apply");

const assetEntries = () => [
  ...Object.values(assets.maps).map((asset) => asset.file),
  ...Object.values(assets.portraits),
  ...Object.values(assets.monsters),
  ...Object.values(assets.discoverables),
];

async function validate() {
  const missing = [];
  for (const file of assetEntries()) {
    try { await access(resolve(assetRoot, file)); } catch { missing.push(file); }
  }
  const unique = new Set(assetEntries());
  if (missing.length) throw new Error(`Missing Veyrholt assets: ${missing.join(", ")}`);
  return { assets: unique.size, scenes: scenes.length, npcs: npcs.length, monsters: monsters.length, encounters: encounters.length, discoverables: discoverables.length, notes: notes.length };
}

async function main() {
  const summary = await validate();
  if (!apply) {
    console.log(JSON.stringify({ valid: true, ...summary, applyUsage: "node scripts/import-veyholt.mjs --campaign-id <uuid> --apply" }, null, 2));
    return;
  }
  if (!campaignId || !/^[0-9a-f-]{36}$/i.test(campaignId)) throw new Error("Pass a campaign UUID with --campaign-id.");

  const supabaseUrl = required("VITE_SUPABASE_URL");
  const publishableKey = required("VITE_SUPABASE_PUBLISHABLE_KEY");
  const accessToken = required("WAYFINDER_ACCESS_TOKEN");
  const workerUrl = required("VITE_R2_ASSET_WORKER_URL").replace(/\/$/, "");
  const supabase = createClient(supabaseUrl, publishableKey, { global: { headers: { Authorization: `Bearer ${accessToken}` } } });

  const one = async (table, filters, label) => {
    let query = supabase.from(table).select("*");
    for (const [column, value] of Object.entries(filters)) query = query.eq(column, value);
    const { data, error } = await query.limit(2);
    if (error) throw error;
    if ((data ?? []).length > 1) throw new Error(`Refusing ambiguous import: more than one ${label}.`);
    return data?.[0] ?? null;
  };
  const insert = async (table, row) => {
    const { data, error } = await supabase.from(table).insert(row).select("*").single();
    if (error) throw error;
    return data;
  };
  const update = async (table, idColumn, id, row) => {
    const { data, error } = await supabase.from(table).update(row).eq(idColumn, id).select("*").single();
    if (error) throw error;
    return data;
  };

  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error("The access token is invalid or expired.");
  const { data: membership, error: memberError } = await supabase.from("campaign_members").select("role").eq("campaign_id", campaignId).eq("user_id", auth.user.id).maybeSingle();
  if (memberError) throw memberError;
  if (!membership || !["OWNER", "DM"].includes(membership.role)) throw new Error("The access token must belong to an OWNER or DM of the target campaign.");

  const ensureAsset = async (file, category) => {
    const stablePath = `${campaignId}/${category}/veyholt/${file.split("/").at(-1)}`;
    const sign = await fetch(`${workerUrl}/v1/sign`, { method: "POST", headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" }, body: JSON.stringify({ campaignId, path: stablePath }) });
    if (sign.ok) return stablePath;
    if (sign.status !== 404) throw new Error(`Could not verify ${file} in R2 (${sign.status}).`);
    const bytes = await readFile(resolve(assetRoot, file));
    const uploaded = await fetch(`${workerUrl}/v1/upload?campaignId=${encodeURIComponent(campaignId)}&category=${encodeURIComponent(category)}`, { method: "POST", headers: { authorization: `Bearer ${accessToken}`, "content-type": "image/png", "x-file-name": file.split("/").at(-1) }, body: bytes });
    if (!uploaded.ok) throw new Error(`Could not upload ${file} (${uploaded.status}).`);
    return (await uploaded.json()).path;
  };

  const mapRows = new Map();
  const sceneRows = new Map();
  for (const scene of scenes) {
    const asset = assets.maps[scene.asset];
    const mapName = `[Veyrholt] ${scene.name}`;
    let map = await one("maps", { campaign_id: campaignId, name: mapName }, `map named ${mapName}`);
    if (!map) map = await insert("maps", { campaign_id: campaignId, name: mapName, storage_path: await ensureAsset(asset.file, "maps"), width: asset.width, height: asset.height });
    mapRows.set(scene.key, map);
    let row = await one("scenes", { campaign_id: campaignId, name: scene.name }, `scene named ${scene.name}`);
    if (!row) row = await insert("scenes", { campaign_id: campaignId, map_id: map.id, name: scene.name, width: asset.width, height: asset.height, grid_type: scene.gridType, grid_size: scene.gridSize, feet_per_cell: 5, grid_color: "#d9cab0", grid_opacity: scene.gridType === "GRIDLESS" ? 0 : 0.18, grid_line_width: 1, fog_enabled: true, fog_covered: false, active: false, revealed: false, lighting: scene.lighting });
    else if (!row.map_id) row = await update("scenes", "id", row.id, { map_id: map.id, width: asset.width, height: asset.height });
    sceneRows.set(scene.key, row);
  }

  const { data: party, error: partyError } = await supabase.from("characters").select("id,owner_id,name,image_url,image_path,default_token_size,conditions").eq("campaign_id", campaignId);
  if (partyError) throw partyError;
  const expectedParty = new Set(["Pipp Karew", "Gerbo Grumble", "Theldren Eldercrown", "Echo Frost"]);
  const chapterParty = (party ?? []).filter((character) => expectedParty.has(character.name.trim())).sort((a, b) => a.name.trim().localeCompare(b.name.trim()));
  if (chapterParty.length !== 4) throw new Error("The campaign must contain the four locked player characters before Veyrholt can be imported.");
  for (const entry of partyEntries) {
    const scene = sceneRows.get(entry.scene);
    for (const [slot, character] of chapterParty.entries()) {
      const token = await one("tokens", { scene_id: scene.id, type: "PLAYER", reference_id: character.id }, `${character.name.trim()} token in ${scene.name}`);
      if (!token) await insert("tokens", { scene_id: scene.id, reference_id: character.id, owner_user_id: character.owner_id, type: "PLAYER", display_name: character.name.trim(), image_url: character.image_url, image_path: character.image_path, x: entry.x + slot * 75, y: entry.y, size: character.default_token_size ?? 1, visible: true, locked: false, conditions: character.conditions ?? [] });
    }
  }

  const npcRows = new Map();
  for (const npc of npcs) {
    let template = await one("npc_templates", { name: npc.name }, `NPC template named ${npc.name}`);
    if (!template) template = await insert("npc_templates", { name: npc.name, image_path: await ensureAsset(assets.portraits[npc.asset], "npc-templates") });
    npcRows.set(npc.key, template);
    for (const place of npc.placements) {
      const scene = sceneRows.get(place.scene);
      let token = await one("tokens", { scene_id: scene.id, type: "NPC", display_name: npc.name }, `${npc.name} token in ${scene.name}`);
      if (!token) token = await insert("tokens", { scene_id: scene.id, reference_id: template.id, type: "NPC", display_name: npc.name, image_path: template.image_path, x: place.x, y: place.y, size: 1, visible: true, locked: false });
      let interaction = await one("token_interactions", { token_id: token.id }, `interaction for ${npc.name}`);
      const interactionPayload = { campaign_id: campaignId, enabled: true, type: npc.type ?? "DIALOGUE", display_name: npc.name, dialogue_text: npc.pages[0], dialogue_pages: npc.pages };
      if (interaction) interaction = await update("token_interactions", "token_id", token.id, interactionPayload);
      else interaction = await insert("token_interactions", { token_id: token.id, ...interactionPayload });
      if (npc.shop?.length) {
        const { data: itemRows, error } = await supabase.from("npc_shop_items").select("id,name").eq("interaction_id", token.id);
        if (error) throw error;
        const existingByName = new Map((itemRows ?? []).map((item) => [item.name, item]));
        for (const [index, item] of npc.shop.entries()) {
          const itemPayload = { interaction_id: token.id, name: item.name, description: item.description, price_gp: item.priceGp, quantity: item.quantity, sort_order: index };
          const existing = existingByName.get(item.name);
          if (existing) await update("npc_shop_items", "id", existing.id, itemPayload);
          else await insert("npc_shop_items", itemPayload);
        }
      }
    }
  }

  const monsterRows = new Map();
  for (const monster of monsters) {
    const templatePayload = { image_path: await ensureAsset(assets.monsters[monster.asset], "monster-templates"), creature_size: monster.size, creature_type: monster.type, max_hp: monster.maxHp, hp_formula: monster.hpFormula, ac: monster.ac, speed: monster.speed, movement: monster.movement, initiative: monster.initiative, abilities: monster.abilities, saving_throws: monster.savingThrows, skills: monster.skills, damage_vulnerabilities: monster.vulnerabilities, damage_resistances: monster.resistances, damage_immunities: monster.immunities, condition_immunities: monster.conditionImmunities, senses: monster.senses, passive_perception: monster.passivePerception, languages: monster.languages, notes: monster.notes, traits: monster.traits, actions: monster.actions, bonus_actions: monster.bonusActions, reactions: monster.reactions, legendary_actions: monster.legendaryActions, legendary_action_uses: monster.legendaryActionUses, spellcasting: monster.spellcasting, default_token_size: monster.tokenSize };
    let template = await one("monster_templates", { name: monster.name }, `monster template named ${monster.name}`);
    if (!template) template = await insert("monster_templates", { name: monster.name, ...templatePayload });
    else template = await update("monster_templates", "id", template.id, templatePayload);
    monsterRows.set(monster.name, template);
  }
  const existingNeeded = new Set(encounters.flatMap((encounter) => encounter.members.map(([name]) => name)).filter((name) => !monsterRows.has(name)));
  for (const name of existingNeeded) {
    const template = await one("monster_templates", { name }, `required monster template named ${name}`);
    if (!template) throw new Error(`Required existing monster template '${name}' is missing.`);
    monsterRows.set(name, template);
  }

  for (const encounter of encounters) {
    let row = await one("encounters", { campaign_id: campaignId, name: encounter.name }, `encounter named ${encounter.name}`);
    if (!row) row = await insert("encounters", { campaign_id: campaignId, name: encounter.name, notes: encounter.notes });
    else row = await update("encounters", "id", row.id, { notes: encounter.notes });
    const { data: members, error } = await supabase.from("encounter_members").select("monster_template_id").eq("encounter_id", row.id);
    if (error) throw error;
    if (!(members ?? []).length) for (const [name, quantity] of encounter.members) await insert("encounter_members", { encounter_id: row.id, monster_template_id: monsterRows.get(name).id, quantity });
  }

  for (const place of placements) {
    const scene = sceneRows.get(place.scene);
    const template = monsterRows.get(place.monster);
    let instance = await one("monster_instances", { campaign_id: campaignId, custom_name: place.name }, `monster instance named ${place.name}`);
    if (!instance) instance = await insert("monster_instances", { campaign_id: campaignId, template_id: template.id, custom_name: place.name, current_hp: template.max_hp, max_hp: template.max_hp, ac: template.ac, visible: false, notes: "Prepared for Veyrholt; reveal when the encounter begins.", dead: false });
    const token = await one("tokens", { scene_id: scene.id, type: "MONSTER", reference_id: instance.id }, `${place.name} token`);
    if (!token) await insert("tokens", { scene_id: scene.id, reference_id: instance.id, type: "MONSTER", display_name: place.name, image_path: template.image_path, x: place.x, y: place.y, size: template.default_token_size ?? 1, visible: false, locked: false });
  }

  for (const item of discoverables) {
    const scene = sceneRows.get(item.scene);
    const row = await one("scene_discoverables", { campaign_id: campaignId, scene_id: scene.id, name: item.name }, `discoverable named ${item.name}`);
    if (!row) await insert("scene_discoverables", { campaign_id: campaignId, scene_id: scene.id, name: item.name, storage_path: await ensureAsset(assets.discoverables[item.asset], "discoverables"), x: item.x, y: item.y, hidden: true });
  }

  const sceneByRef = async (ref) => sceneRows.get(ref) ?? one("scenes", { campaign_id: campaignId, name: ref }, `existing scene named ${ref}`);
  for (const [fromRef, toRef, label, x, y] of links) {
    const from = await sceneByRef(fromRef);
    const to = await sceneByRef(toRef);
    if (!from || !to) throw new Error(`Cannot create scene link '${label}': source or destination scene is missing.`);
    const row = await one("scene_links", { scene_id: from.id, destination_scene_id: to.id, label }, `scene link ${label}`);
    if (!row) await insert("scene_links", { scene_id: from.id, destination_scene_id: to.id, label, x, y });
  }

  for (const marker of zoneMarkers) {
    const scene = sceneRows.get(marker.scene);
    const row = await one("scene_zone_markers", { campaign_id: campaignId, scene_id: scene.id, label: marker.label }, `zone marker ${marker.label}`);
    if (!row) await insert("scene_zone_markers", { campaign_id: campaignId, scene_id: scene.id, label: marker.label, x: marker.x, y: marker.y, radius_ft: marker.radiusFt, color: marker.color, opacity: 0.24, visible: true });
  }

  for (const note of notes) {
    const row = await one("campaign_notes", { campaign_id: campaignId, title: note.title }, `campaign note ${note.title}`);
    if (!row) await insert("campaign_notes", { campaign_id: campaignId, title: note.title, body: note.body });
    else await update("campaign_notes", "id", row.id, { body: note.body });
  }

  const messenger = await one("tokens", { scene_id: (await sceneByRef("Greymere")).id, type: "NPC", display_name: "Veyrholt Messenger" }, "existing Veyrholt Messenger token");
  if (!messenger) throw new Error("The existing Greymere Veyrholt Messenger token is missing; refusing to create a duplicate.");
  const interaction = await one("token_interactions", { token_id: messenger.id }, "Veyrholt Messenger interaction");
  const payload = { campaign_id: campaignId, enabled: true, type: "DIALOGUE", display_name: "Veyrholt Messenger", dialogue_text: messengerPages[0], dialogue_pages: messengerPages };
  if (interaction) await update("token_interactions", "token_id", messenger.id, payload); else await insert("token_interactions", { token_id: messenger.id, ...payload });

  console.log(JSON.stringify({ imported: true, campaignId, ...summary, preservedActiveScene: true, newScenesRevealed: false, refreshedAuthoredContent: true }, null, 2));
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });

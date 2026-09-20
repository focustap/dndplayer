import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { HOBB, scenes, assets, npcs, monsters, encounters, placements, links, discoverables, messengerPages } from './manifest.mjs';
import { legacy } from './legacy.mjs';

const equal=isDeepStrictEqual;
const unique=(rows,label)=>{if(rows.length>1)throw new Error(`Ambiguous ${label}`);return rows[0];};
export function validateManifest() {
 const keys=new Set(scenes.map(s=>s.key));
 if(keys.size!==scenes.length)throw new Error('Duplicate scene key');
 for(const [from,to,,x,y] of links){if((from!=='Greymere'&&!keys.has(from))||!keys.has(to)&&to!=='Greymere')throw new Error('Invalid link');const s=scenes.find(s=>s.key===from);if(s&&(x<0||y<0||x>s.width||y>s.height))throw new Error(`Link outside ${from}`);}
 const reached=new Set(['Greymere']); for(let i=0;i<scenes.length+1;i++)for(const [from,to]of links)if(reached.has(from))reached.add(to);
 if(scenes.some(s=>!reached.has(s.key)))throw new Error('Unreachable scene');
 for(const s of scenes){const reachable=new Set([s.key]);for(let i=0;i<scenes.length+1;i++)for(const [a,b]of links)if(reachable.has(a))reachable.add(b);if(!reachable.has('Greymere'))throw new Error(`No exit from ${s.key}`);}
 for(const n of npcs)if(!keys.has(n.scene)||n.scene==='town'||!n.pages.length&&n.interactive!==false)throw new Error('Invalid NPC');
 for(const e of encounters)for(const [name,count]of e.members)if(!monsters.some(m=>m.name===name)||count<1)throw new Error('Invalid encounter member');
 for(const p of placements)if(!keys.has(p.scene)||p.scene==='town'||!monsters.some(m=>m.name===p.monster))throw new Error('Invalid monster placement');
 const publicText=JSON.stringify({npcs,links,discoverables,messengerPages});
 if(/DM_SECRET|Catalyst|cosmology|world itself|Bell Regent|Second Motion/.test(publicText))throw new Error('Secret or obsolete content in public payload');
 return {scenes:scenes.length,npcs:npcs.length,encounters:encounters.length,links:links.length,assetRequirements:Object.keys(assets).length};
}

export function buildPlan(snapshot,campaignId,registry,chapter) {
 validateManifest();
 if(!/^[0-9a-f-]{36}$/i.test(campaignId))throw new Error('Campaign UUID required');
 const db=structuredClone(snapshot); const ops=[];
 const campaign=unique(db.campaigns.filter(c=>c.id===campaignId),'campaign');
 if(!campaign)throw new Error('Snapshot does not contain campaign');
 for(const table of ['scenes','maps','characters','campaign_notes','encounters','monster_instances','scene_discoverables','scene_zone_markers','token_interactions','combat_sessions'])if(db[table].some(r=>r.campaign_id!==campaignId))throw new Error(`Foreign campaign in ${table}`);
 if(db.combat_sessions.some(c=>c.active))throw new Error('Do not rewrite during active combat');
 const hobbTokens=db.tokens.filter(t=>t.display_name==='Hobb');
 if(hobbTokens.length){for(const t of hobbTokens){const i=db.token_interactions.find(i=>i.token_id===t.id);if(i?.dialogue_text!==HOBB||!equal(i.dialogue_pages,[HOBB]))throw new Error('Hobb differs from locked canon; no automatic repair');}}
 const pk=t=>t==='token_interactions'?'token_id':'id';
 const insert=(table,row)=>{const value={...(pk(table)==='id'?{id:randomUUID()}:{}),...row};ops.push({kind:'insert',table,key:pk(table),after:value});db[table].push(value);return value;};
 const update=(table,row,patch)=>{const changed=Object.fromEntries(Object.entries(patch).filter(([k,v])=>!equal(row[k],v)));if(!Object.keys(changed).length)return row;ops.push({kind:'update',table,key:pk(table),before:structuredClone(row),after:changed});Object.assign(row,changed);return row;};
 const remove=(table,row)=>{if(table==='scenes'||table==='tokens'&&row.type==='PLAYER')throw new Error('Protected deletion');ops.push({kind:'delete',table,key:pk(table),before:structuredClone(row)});db[table]=db[table].filter(r=>r[pk(table)]!==row[pk(table)]);};
 const get=(table,predicate,label)=>unique(db[table].filter(predicate),label??table);
 const sceneRows=new Map();
 const initialManaged=new Set();
 for(const s of scenes){const row=get('scenes',r=>[s.name,...legacy.scenes[s.key]].includes(r.name),s.name);if(row)initialManaged.add(row.id);sceneRows.set(s.key,row);}
 const greymere=get('scenes',s=>s.name==='Greymere','Greymere');
 if(!greymere)throw new Error('Greymere missing');
 if(db.tokens.some(t=>initialManaged.has(t.scene_id)&&t.type==='PLAYER'&&sceneRows.get('town')?.id===t.scene_id))throw new Error('Overview has player tokens; preserve positions and resolve manually');
 const assetPath=key=>{
  const a=registry[key];if(!a)return null;
  if(!assets[key]||typeof a.path!=='string'||!a.path.startsWith(`${campaignId}/`)||a.path.includes('..')||a.path.includes('?')||!a.verified)throw new Error(`Unverified R2 asset ${key}`);
  return a.path;
 };
 for(const key of Object.keys(registry))assetPath(key);
 for(const s of scenes){
  let row=sceneRows.get(s.key); const path=assetPath(s.key);let map=null;
  if(path){const a=registry[s.key];if(a.width!==s.width||a.height!==s.height)throw new Error(`Wrong dimensions for ${s.key}`);map=get('maps',m=>m.storage_path===path,`${s.key} map`);if(!map)map=insert('maps',{campaign_id:campaignId,name:`[Veyrholt] ${s.name}`,storage_path:path,width:s.width,height:s.height,created_by:campaign.owner_id});else if(map.name.startsWith('[Retired Veyrholt art'))update('maps',map,{name:`[Veyrholt] ${s.name}`});}
  // Missing maps are honest blank scenes, never obsolete art or broken URLs.
  const keepAuthoredMap=!path&&row?.name===s.name;
  const patch={name:s.name,...(keepAuthoredMap?{}:{map_id:map?.id??null,map_url:null}),grid_type:s.grid_type,grid_opacity:s.grid_type==='GRIDLESS'?0:0.18};
  if(row){if(row.active)throw new Error(`Cannot replace active scene ${row.name}`);update('scenes',row,patch);}
  else row=insert('scenes',{campaign_id:campaignId,...patch,width:s.width,height:s.height,grid_size:s.grid_size,feet_per_cell:5,active:false,revealed:false,lighting:s.lighting});
  sceneRows.set(s.key,row);
 }
 const managed=new Set([...sceneRows.values()].map(s=>s.id));
 // Only obsolete chapter art records are labeled archived; asset bytes stay intact.
 for(const map of db.maps)if(map.name.startsWith('[Veyrholt]')&&!db.scenes.some(s=>s.map_id===map.id))update('maps',map,{name:map.name.replace('[Veyrholt]','[Retired Veyrholt art — superseded]')});

 const removeToken=t=>{
  if(db.token_patrols.some(p=>p.token_id===t.id)||db.token_motion_segments.some(p=>p.token_id===t.id)||db.initiative_entries.some(e=>e.token_id===t.id))throw new Error(`Refuse deleting runtime token ${t.display_name}`);
  for(const item of [...db.npc_shop_items].filter(i=>i.interaction_id===t.id))remove('npc_shop_items',item);
  const interaction=get('token_interactions',i=>i.token_id===t.id);if(interaction)remove('token_interactions',interaction);
  remove('tokens',t);
 };
 for(const t of [...db.tokens])if(managed.has(t.scene_id)&&t.type==='MONSTER'&&legacy.placementNames.includes(t.display_name))removeToken(t);
 for(const d of [...db.scene_discoverables])if(managed.has(d.scene_id)&&legacy.discoverableNames.includes(d.name)){
  if(d.discovered_at)throw new Error(`Previously discovered obsolete item ${d.name}; review before retirement`);remove('scene_discoverables',d);
 }
 for(const z of [...db.scene_zone_markers])if(managed.has(z.scene_id)&&legacy.markerLabels.includes(z.label))remove('scene_zone_markers',z);
 for(const e of [...db.encounters])if(legacy.encounterNames.includes(e.name)){for(const member of [...db.encounter_members].filter(m=>m.encounter_id===e.id))remove('encounter_members',member);remove('encounters',e);}
 for(const m of [...db.monster_instances])if(legacy.placementNames.includes(m.custom_name)&&!db.tokens.some(t=>t.reference_id===m.id)&&!db.encounter_members.some(e=>e.monster_instance_id===m.id)&&!db.initiative_entries.some(e=>e.monster_instance_id===m.id))remove('monster_instances',m);
 // Global templates can belong to other campaigns. Retain them explicitly as
 // retired historical definitions rather than changing/deleting shared stats.
 // They are no longer referenced by this chapter's encounters or instances.

 for(const n of npcs){
  let template=get('npc_templates',t=>t.name===n.name,`NPC ${n.name}`);
  if(!template)template=insert('npc_templates',{name:n.name,image_path:n.asset?assetPath(n.asset):null});
  const scene=sceneRows.get(n.scene);
  const candidates=db.tokens.filter(t=>managed.has(t.scene_id)&&t.type==='NPC'&&t.display_name===n.name);
  let token=unique(candidates.filter(t=>t.scene_id===scene.id),`${n.name} destination`)??candidates[0];
  if(token){if(token.scene_id!==scene.id)update('tokens',token,{scene_id:scene.id,x:n.x,y:n.y});if(n.asset&&assetPath(n.asset))update('tokens',token,{image_path:assetPath(n.asset),image_url:null});}
  else token=insert('tokens',{scene_id:scene.id,type:'NPC',reference_id:template.id,display_name:n.name,image_path:template.image_path??null,x:n.x,y:n.y,size:1,visible:true,locked:false});
  for(const duplicate of candidates)if(duplicate.id!==token.id)removeToken(duplicate);
  const payload={campaign_id:campaignId,enabled:n.interactive!==false,type:n.shop?'BOTH':'DIALOGUE',display_name:n.name,dialogue_text:n.pages[0]??'',dialogue_pages:n.pages};
  const interaction=get('token_interactions',i=>i.token_id===token.id);
  if(interaction)update('token_interactions',interaction,payload);else insert('token_interactions',{token_id:token.id,...payload});
  for(const [index,item]of (n.shop??[]).entries()){
   const existing=get('npc_shop_items',i=>i.interaction_id===token.id&&i.name===item.name);
   if(!existing)insert('npc_shop_items',{interaction_id:token.id,...item,sort_order:index});
   else update('npc_shop_items',existing,{description:item.description,price_gp:item.price_gp,sort_order:index}); // preserve sold quantity
  }
  // Remove known obsolete stock only, scoped to retained legacy NPC tokens.
  if(legacy.npcNames.includes(n.name))for(const item of [...db.npc_shop_items].filter(i=>i.interaction_id===token.id))if(['Resonance chalk','Bellwax','Brass earplugs'].includes(item.name))remove('npc_shop_items',item);
 }
 const monsterRows=new Map();
 for(const m of monsters){const {asset,...data}=m;let row=get('monster_templates',t=>t.name===m.name,`monster ${m.name}`);if(!row)row=insert('monster_templates',{...data,image_path:asset?assetPath(asset):null});else if(Object.entries(data).some(([k,v])=>!equal(row[k],v)))throw new Error(`Global template differs: ${m.name}. Review or clone it; do not overwrite another campaign's library.`);monsterRows.set(m.name,row);}
 for(const e of encounters){let row=get('encounters',r=>r.name===e.name);if(!row)row=insert('encounters',{campaign_id:campaignId,name:e.name,notes:e.notes});else update('encounters',row,{notes:e.notes});
  const desired=new Set(e.members.map(([name])=>monsterRows.get(name).id));
  for(const member of [...db.encounter_members].filter(m=>m.encounter_id===row.id))if(!desired.has(member.monster_template_id))remove('encounter_members',member);
  for(const [name,quantity]of e.members){const id=monsterRows.get(name).id;const member=get('encounter_members',m=>m.encounter_id===row.id&&m.monster_template_id===id);if(member)update('encounter_members',member,{quantity});else insert('encounter_members',{encounter_id:row.id,monster_template_id:id,quantity});}
 }
 for(const p of placements){const scene=sceneRows.get(p.scene),template=monsterRows.get(p.monster);let instance=get('monster_instances',m=>m.custom_name===p.name);if(!instance)instance=insert('monster_instances',{campaign_id:campaignId,template_id:template.id,custom_name:p.name,current_hp:template.max_hp,max_hp:template.max_hp,ac:template.ac,visible:false,dead:false,notes:'Prepared Veyrholt opponent; reveal only at encounter trigger.'});
  const asset=monsters.find(m=>m.name===p.monster)?.asset;
  const path=asset?assetPath(asset):null;
  const token=get('tokens',t=>t.scene_id===scene.id&&t.type==='MONSTER'&&t.reference_id===instance.id);if(!token)insert('tokens',{scene_id:scene.id,type:'MONSTER',reference_id:instance.id,display_name:p.name,image_path:path??template.image_path??null,x:p.x,y:p.y,size:1,visible:false,locked:false});else if(path)update('tokens',token,{image_path:path,image_url:null});
 }
 const wantedLinks=new Set();
 for(const d of discoverables){
  const scene=sceneRows.get(d.scene),path=assetPath(d.asset);
  const existing=get('scene_discoverables',r=>r.scene_id===scene.id&&r.name===d.name);
  if(existing){if(path)update('scene_discoverables',existing,{storage_path:path});}
  else if(path)insert('scene_discoverables',{campaign_id:campaignId,scene_id:scene.id,name:d.name,storage_path:path,x:d.x,y:d.y,hidden:d.hidden,created_by:campaign.owner_id});
  // No fake image path: missing bytes remain an explicit requirement.
 }
 for(const [from,to,label,x,y]of links){const a=from==='Greymere'?greymere:sceneRows.get(from),b=to==='Greymere'?greymere:sceneRows.get(to);let row=get('scene_links',l=>l.scene_id===a.id&&l.label===label);
  if(!row&&from==='Greymere')row=get('scene_links',l=>l.scene_id===a.id&&l.label==='Messenger: Bellpost Road');
  if(row)update('scene_links',row,{label,destination_scene_id:b.id,...(from==='Greymere'?{}:{x,y})});else row=insert('scene_links',{scene_id:a.id,destination_scene_id:b.id,label,x,y,created_by:campaign.owner_id});wantedLinks.add(row.id);
 }
 for(const l of [...db.scene_links])if(managed.has(l.scene_id)&&legacy.linkLabels.includes(l.label)&&!wantedLinks.has(l.id))remove('scene_links',l);
 // Notes derive from one chapter. Each heading becomes a usable DM note.
 const sections=chapter.split(/^## /m).slice(1);
 const noteTitles=new Set();
 for(const [index,section]of sections.entries()){const newline=section.indexOf('\n');const title=`[Veyrholt] ${String(index).padStart(2,'0')} — ${section.slice(0,newline).trim()}`;const body='DM ONLY\n\n'+section.slice(newline+1).trim();noteTitles.add(title);const note=get('campaign_notes',n=>n.title===title);if(note)update('campaign_notes',note,{body});else insert('campaign_notes',{campaign_id:campaignId,title,body,created_by:campaign.owner_id});}
 for(const n of [...db.campaign_notes])if(legacy.noteTitles.includes(n.title)&&!noteTitles.has(n.title))remove('campaign_notes',n);
 const messenger=get('tokens',t=>t.scene_id===greymere.id&&t.display_name==='Veyrholt Messenger'&&t.type==='NPC','existing Messenger');
 if(!messenger)throw new Error('Existing Messenger missing; refusing duplicate');
 const mi=get('token_interactions',i=>i.token_id===messenger.id);if(!mi)throw new Error('Messenger interaction missing');update('token_interactions',mi,{dialogue_text:messengerPages[0],dialogue_pages:messengerPages});

 // Protected invariants are checked locally AND in the generated transaction.
 for(const t of snapshot.tokens.filter(t=>t.type==='PLAYER'||!initialManaged.has(t.scene_id)))if(!equal(t,db.tokens.find(r=>r.id===t.id)))throw new Error(`Protected token changed: ${t.display_name}`);
 for(const s of snapshot.scenes){const after=db.scenes.find(r=>r.id===s.id);if(!after||s.active!==after.active||s.revealed!==after.revealed)throw new Error('Scene activation/reveal changed');if(!initialManaged.has(s.id)&&!equal(s,after))throw new Error('Unrelated scene changed');}
 for(const l of db.scene_links)if(!db.scenes.some(s=>s.id===l.scene_id)||!db.scenes.some(s=>s.id===l.destination_scene_id))throw new Error('Dangling link');
 for(const i of db.token_interactions)if(!db.tokens.some(t=>t.id===i.token_id))throw new Error('Dangling interaction');
 for(const i of db.npc_shop_items)if(!db.token_interactions.some(t=>t.token_id===i.interaction_id))throw new Error('Dangling shop item');
 return {campaignId,ownerId:campaign.owner_id,managedSceneIds:[...managed],messengerId:messenger.id,ops,after:db,missingAssets:Object.keys(assets).filter(k=>!registry[k]).map(k=>assets[k])};
}

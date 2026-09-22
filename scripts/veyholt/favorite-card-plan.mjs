// Focused upgrade for already-authored live Veyrholt scenes. Unlike the full
// chapter importer, this never rebuilds deleted optional rooms or replaces maps.
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual as equal } from 'node:util';
import { scenes, npcs, monsters, encounters, discoverables, assets } from './manifest.mjs';

const aliases = {
 town:['Veyrholt City Overview'], inn:['Veyrholt - The Gilded Lamb'],
 arcana:["Veyrholt - Morrow's Arcana"], graveyard:['Veyrholt - The Lucky Graveyard'],
 civic:[], grand:['Veyrholt - Grand Room'], final:['Veyrholt - Final Table'],
 market:["Veyrholt - Stranger's Market"],
};
export function buildFavoriteCardPlan(snapshot,campaignId,registry,chapter) {
 const db=structuredClone(snapshot),ops=[];
 const campaign=db.campaigns.find(c=>c.id===campaignId);
 if(!campaign)throw new Error('Campaign missing');
 if(db.combat_sessions.some(c=>c.active))throw new Error('Do not rewrite during active combat');
 const unique=(rows,label)=>{if(rows.length!==1)throw new Error(`Expected one ${label}; found ${rows.length}`);return rows[0];};
 const sceneRows=Object.fromEntries(Object.entries(aliases).map(([key,names])=>[key,unique(db.scenes.filter(s=>[scenes.find(s=>s.key===key).name,...names].includes(s.name)),key)]));
 if(Object.values(sceneRows).some(s=>s.active))throw new Error('Do not rewrite an active Veyrholt scene');
 const managed=new Set(Object.values(sceneRows).map(s=>s.id));
 const insert=(table,row)=>{const value={id:randomUUID(),...row};db[table].push(value);ops.push({kind:'insert',table,key:'id',after:value});return value;};
 const update=(table,row,patch)=>{const after=Object.fromEntries(Object.entries(patch).filter(([k,v])=>!equal(row[k],v)));if(!Object.keys(after).length)return;ops.push({kind:'update',table,key:table==='token_interactions'?'token_id':'id',before:structuredClone(row),after});Object.assign(row,after);};
 const remove=(table,row)=>{ops.push({kind:'delete',table,key:'id',before:structuredClone(row)});db[table]=db[table].filter(r=>r.id!==row.id);};
 const asset=key=>{const a=registry[key];if(!a)return null;if(!assets[key]||!a.verified||!a.path?.startsWith(`${campaignId}/`)||a.path.includes('..')||a.path.includes('?'))throw new Error(`Unverified R2 asset ${key}`);return a.path;};
 for(const n of npcs.filter(n=>['Cira Vale','Pell Aster','Ysabet Morrow','Kest Rane','Yara Flint','Deacon Olyss','Reeve Elian Morrow','Lady Ilyra Veyr','Sister Avra Seln','The Dealer'].includes(n.name))){
  const allowedScenes=n.name==='The Dealer'?[sceneRows.grand.id,sceneRows.final.id]:[sceneRows[n.scene].id];
  const token=unique(db.tokens.filter(t=>allowedScenes.includes(t.scene_id)&&t.type==='NPC'&&t.display_name===n.name),n.name);
  const interaction=unique(db.token_interactions.filter(i=>i.token_id===token.id),`${n.name} dialogue`);
  update('token_interactions',interaction,{dialogue_text:n.pages[0],dialogue_pages:n.pages});
 }
 for(const d of discoverables){
  const path=asset(d.asset);if(!path)throw new Error(`Required clue image missing: ${d.asset}`);
  const scene=sceneRows[d.scene];const found=db.scene_discoverables.filter(r=>r.scene_id===scene.id&&r.name===d.name);
  if(found.length>1)throw new Error('Duplicate clue');
  const values={name:d.name,x:d.x,y:d.y,hidden:d.hidden,storage_path:path};
  if(found[0])update('scene_discoverables',found[0],{hidden:d.hidden,storage_path:path});
  else insert('scene_discoverables',{campaign_id:campaignId,scene_id:scene.id,...values,created_by:campaign.owner_id});
 }
 const finalDefinition=encounters.find(e=>e.key==='final');
 const finalEncounter=unique(db.encounters.filter(r=>r.name===finalDefinition.name),'Final Table encounter');
 update('encounters',finalEncounter,{notes:finalDefinition.notes});
 const jester=monsters.find(m=>m.name==='Veyrholt — Jester');const {asset:assetKey,...definition}=jester;
 let template=db.monster_templates.find(m=>m.name===jester.name);
 if(template&&Object.entries(definition).some(([k,v])=>!equal(template[k],v)))throw new Error('Existing shared Jester template differs; review first');
 if(!template)template=insert('monster_templates',{...definition,image_path:asset(assetKey)});
 for(const [key,oldEncounter,oldMonster] of [['graveyard','Veyrholt — Graveyard Dogs (optional)','Veyrholt — Graveyard Dog'],['grand','Veyrholt — Disputed Collection','Veyrholt — Claim Usher']]){
  const scene=sceneRows[key];const e=encounters.find(e=>e.key===key);
  let encounter=db.encounters.find(r=>r.name===e.name||r.name===oldEncounter);
  if(encounter)update('encounters',encounter,{name:e.name,notes:e.notes});
  else encounter=insert('encounters',{campaign_id:campaignId,name:e.name,notes:e.notes});
  for(const member of [...db.encounter_members].filter(m=>m.encounter_id===encounter.id&&m.monster_template_id!==template.id))remove('encounter_members',member);
  const member=db.encounter_members.find(m=>m.encounter_id===encounter.id&&m.monster_template_id===template.id);
  if(member)update('encounter_members',member,{quantity:3});else insert('encounter_members',{encounter_id:encounter.id,monster_template_id:template.id,quantity:3});
  const oldTemplate=db.monster_templates.find(m=>m.name===oldMonster);
  const candidates=db.tokens.filter(t=>t.scene_id===scene.id&&t.type==='MONSTER'&&db.monster_instances.some(i=>i.id===t.reference_id&&i.template_id===oldTemplate?.id));
  for(const token of candidates){
   if(db.initiative_entries.some(i=>i.token_id===token.id)||db.token_patrols.some(p=>p.token_id===token.id)||db.token_motion_segments.some(m=>m.token_id===token.id))throw new Error('Old monster has runtime state; review before replacement');
   remove('tokens',token);
   const instance=db.monster_instances.find(i=>i.id===token.reference_id);
   if(instance&&!db.tokens.some(t=>t.reference_id===instance.id)&&!db.encounter_members.some(m=>m.monster_instance_id===instance.id)&&!db.initiative_entries.some(i=>i.monster_instance_id===instance.id))remove('monster_instances',instance);
  }
  for(let index=0;index<3;index++){
   const name=`[Veyrholt] ${key} — Jester ${index+1}`;
   let instance=db.monster_instances.find(i=>i.custom_name===name);
   if(!instance)instance=insert('monster_instances',{campaign_id:campaignId,template_id:template.id,custom_name:name,current_hp:14,max_hp:14,ac:12,visible:false,dead:false,notes:'Independent Jester cultist; reveal at encounter trigger.'});
   const token=db.tokens.find(t=>t.scene_id===scene.id&&t.reference_id===instance.id&&t.type==='MONSTER');
   if(token){if(asset('jester'))update('tokens',token,{image_path:asset('jester'),image_url:null});}
   else insert('tokens',{scene_id:scene.id,type:'MONSTER',reference_id:instance.id,display_name:name,image_path:asset('jester'),image_url:null,x:candidates[index]?.x??450+index*100,y:candidates[index]?.y??450+index*90,size:1,visible:false,locked:false});
  }
 }
 const entry=unique(db.scene_links.filter(l=>l.scene_id===sceneRows.town.id&&l.destination_scene_id===sceneRows.grand.id),'circus entrance');
 update('scene_links',entry,{label:'Circus entrance: State his favorite card.'});
 const interiorIds=new Set(['grand','final'].map(k=>sceneRows[k].id));
 // Exact known city service shortcuts only; unknown topology blocks instead of being deleted.
 for(const l of db.scene_links.filter(l=>managed.has(l.scene_id)&&!interiorIds.has(l.scene_id)&&interiorIds.has(l.destination_scene_id)&&l.id!==entry.id))throw new Error(`Unexpected circus bypass: ${l.label}. Review topology.`);
 for(const [a,b,label,x,y] of [['grand','final','The Final Table — after the Jesters',1250,800],['final','grand','Return to the circus',220,960]]){
  const found=db.scene_links.filter(l=>l.scene_id===sceneRows[a].id&&l.destination_scene_id===sceneRows[b].id);
  if(found.length)update('scene_links',unique(found,'direct Final Table link'),{label});
  else insert('scene_links',{scene_id:sceneRows[a].id,destination_scene_id:sceneRows[b].id,label,x,y,created_by:campaign.owner_id});
 }
 for(const [index,section] of chapter.split(/^## /m).slice(1).entries()){
  const newline=section.indexOf('\n'),title=`[Veyrholt] ${String(index).padStart(2,'0')} — ${section.slice(0,newline).trim()}`,body='DM ONLY\n\n'+section.slice(newline+1).trim();
  const note=db.campaign_notes.find(n=>n.title===title);
  if(note)update('campaign_notes',note,{body});else insert('campaign_notes',{campaign_id:campaignId,title,body,created_by:campaign.owner_id});
 }
 return {campaignId,ownerId:campaign.owner_id,managedSceneIds:[...managed],ops,after:db,missingAssets:asset('jester')?[]:[assets.jester]};
}

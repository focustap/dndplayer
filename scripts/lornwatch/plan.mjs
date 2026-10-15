import { createHash } from 'node:crypto';
import { scenes, links, npcs, monsters, encounters, placements, documents, assets } from './manifest.mjs';

// Stable campaign-scoped IDs let retries add only missing content. Existing rows,
// including sold stock, HP, visibility, notes and map edits, are never rewritten.
export function chapterId(campaignId,key) {
  const h=createHash('sha256').update(`wayfinder:lornwatch:v1:${campaignId}:${key}`).digest('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
}
export function validateManifest() {
  const keys=new Set(scenes.map(s=>s.key));
  if(keys.size!==scenes.length)throw new Error('Duplicate scene');
  for(const [from,to,,x,y] of links)if(!keys.has(from)||!keys.has(to)||from===to||x<0||x>1536||y<0||y>1024)throw new Error('Invalid link');
  for(const start of keys){const reached=new Set([start]);for(let i=0;i<keys.size;i++)for(const [a,b] of links)if(reached.has(a))reached.add(b);if(reached.size!==keys.size)throw new Error(`Unreachable scene from ${start}`);}
  for(const n of npcs)if(!keys.has(n.scene)||'pages'in n||'dialogue'in n||'dialogue_text'in n)throw new Error('NPC dialogue forbidden');
  for(const n of npcs)for(const item of n.shop??[])if(!Number.isInteger(item.price_gp)||item.price_gp<1)throw new Error('Lornwatch prices must be whole gold amounts of at least 1 gp');
  for(const e of encounters)for(const [key,count]of e.members)if(!monsters.some(m=>m.key===key)||count<1)throw new Error('Invalid encounter');
  for(const d of documents)if(d.name.length>160||!keys.has(d.scene))throw new Error('Invalid document');
  if(/Catalyst|The Witness|cosmology|world inside|mother misses|Mother, I finally/i.test(JSON.stringify({npcs,documents,monsters})))throw new Error('Secret in shared payload');
  return {scenes:scenes.length,npcs:npcs.length,links:links.length,encounters:encounters.length,documents:documents.length};
}
export function buildPlan(snapshot,campaignId,registry={},chapter='',runSheet='',expansion='') {
  validateManifest();
  if(!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(campaignId))throw new Error('Campaign UUID required');
  const db=structuredClone(snapshot),ops=[];
  const campaign=db.campaigns.filter(r=>r.id===campaignId);
  if(campaign.length!==1)throw new Error('One campaign required');
  const ownerId=campaign[0].owner_id;
  if(!db.campaign_members.some(m=>m.campaign_id===campaignId&&m.user_id===ownerId&&['OWNER','DM'].includes(m.role)))throw new Error('Owner/DM membership required');
  if(db.combat_sessions.some(r=>r.active))throw new Error('Refusing installation during active combat');
  for(const rows of Object.values(db))for(const row of rows)if(row.campaign_id&&row.campaign_id!==campaignId)throw new Error('Foreign campaign row');
  const add=(table,key,data,identity=[])=>{
    const pk=table==='token_interactions'?'token_id':'id';
    const id=pk==='token_id'?data.token_id:chapterId(campaignId,`${table}:${key}`);
    const matches=db[table].filter(r=>r[pk]===id);
    if(matches.length>1)throw new Error(`Duplicate ${table} ID`);
    if(matches[0]){for(const field of identity)if(matches[0][field]!==data[field])throw new Error(`Identity conflict ${table}:${key}`);return matches[0];}
    if(['scenes','encounters','npc_templates','monster_templates'].includes(table)&&db[table].some(r=>r.name===data.name))throw new Error(`Unmanaged name collision: ${data.name}`);
    const row={[pk]:id,...(table==='tokens'?{rotation:0,conditions:[],owner_user_id:null,image_url:null}:{}),...data};db[table].push(row);ops.push({kind:'insert',table,key:pk,after:row});return row;
  };
  const asset=key=>{
    const row=registry[key];if(!row)return null;
    if(!assets[key]||row.verified!==true||typeof row.path!=='string'||!row.path.startsWith(`${campaignId}/`)||/[?\\]|\.\./.test(row.path)||row.path.endsWith('/'))throw new Error(`Unverified R2 asset: ${key}`);
    return row.path;
  };
  for(const key of Object.keys(registry))asset(key);
  const sceneRows=new Map();
  for(const s of scenes){
    const path=asset(s.key);let map=null;
    if(path){
      const a=registry[s.key];if(a.width!==s.width||a.height!==s.height)throw new Error(`Wrong map dimensions: ${s.key}`);
      const installed=db.scenes.find(r=>r.id===chapterId(campaignId,`scenes:${s.key}`));
      const nativeMap=installed?.map_id?db.maps.find(r=>r.id===installed.map_id):null;
      if(nativeMap){if(nativeMap.campaign_id!==campaignId||nativeMap.storage_path!==path)throw new Error(`Existing map differs: ${s.key}`);map=nativeMap;}
      else map=add('maps',s.key,{campaign_id:campaignId,name:`[Lornwatch] ${s.name}`,storage_path:path,width:s.width,height:s.height,created_by:ownerId},['campaign_id','storage_path']);
    }
    const {key,...data}=s;
    const row=add('scenes',key,{campaign_id:campaignId,...data,map_id:map?.id??null,map_url:null,active:false,revealed:false,grid_opacity:s.grid_type==='SQUARE'?0.15:0,grid_color:'#ffffff'},['campaign_id']);
    if(row.active&&ops.length)throw new Error('Chapter scene active; resnapshot after play');
    sceneRows.set(key,row);
  }
  for(const [index,n]of npcs.entries()){
    const template=add('npc_templates',n.key,{name:`Lornwatch — ${n.name}`,image_path:asset(n.key)},['name']);
    const token=add('tokens',`npc:${index}`,{scene_id:sceneRows.get(n.scene).id,type:'NPC',reference_id:template.id,display_name:n.label??n.name,image_path:asset(n.key),x:n.x,y:n.y,size:n.size??1,visible:!n.hidden,locked:false},['scene_id','type','reference_id']);
    // No interaction whatsoever for ordinary NPCs. Shops cannot open a dialogue tab.
    if(n.shop){add('token_interactions',`npc:${index}`,{token_id:token.id,campaign_id:campaignId,enabled:true,type:'SHOP',display_name:n.name,dialogue_text:'',dialogue_pages:[]},['campaign_id','type']);
      for(const [j,item]of n.shop.entries())add('npc_shop_items',`${index}:${j}`,{interaction_id:token.id,...item,sort_order:j},['interaction_id','name']);}
  }
  const templates=new Map();
  for(const m of monsters){const {key,...data}=m;templates.set(key,add('monster_templates',key,{...data,image_path:asset(key)},['name']));}
  for(const e of encounters){const row=add('encounters',e.key,{campaign_id:campaignId,name:e.name,notes:e.notes},['campaign_id','name']);for(const [key,quantity]of e.members)add('encounter_members',`${e.key}:${e.memberKeys?.[key]??key}`,{encounter_id:row.id,monster_template_id:templates.get(key).id,quantity},['encounter_id','monster_template_id']);}
  for(const [i,p]of placements.entries()){
    const t=templates.get(p.monster);
    const instance=add('monster_instances',p.instanceKey??String(i),{campaign_id:campaignId,template_id:t.id,custom_name:p.label?`Lornwatch — ${p.label}`:t.name,current_hp:t.max_hp,max_hp:t.max_hp,ac:t.ac,visible:p.visible??false,dead:false,notes:''},['campaign_id','template_id']);
    add('tokens',`monster:${i}`,{scene_id:sceneRows.get(p.scene).id,type:'MONSTER',reference_id:instance.id,display_name:p.label??t.name.replace('Lornwatch — ',''),image_path:asset(p.monster),x:p.x,y:p.y,size:p.size,visible:p.visible??false,locked:false},['scene_id','type','reference_id']);
  }
  for(const [i,[from,to,label,x,y]]of links.entries())add('scene_links',String(i),{scene_id:sceneRows.get(from).id,destination_scene_id:sceneRows.get(to).id,label,x,y,created_by:ownerId},['scene_id','destination_scene_id']);
  // Only attach to an exact known earlier scene; never create a substitute
  // Veyrholt campaign/scene or overwrite its artwork, flags or played state.
  const departures=db.scenes.filter(s=>s.campaign_id===campaignId&&s.name==='Veyrholt - Final Table');
  if(departures.length>1)throw new Error('Ambiguous Veyrholt Final Table; choose departure manually.');
  if(departures.length){
    const departure=departures[0],crossing=sceneRows.get('crossing');
    add('scene_links','glass-road:departure',{scene_id:departure.id,destination_scene_id:crossing.id,label:'Glass Road — after the Dealer',x:(departure.width??1536)*.5,y:(departure.height??1024)*.93,created_by:ownerId},['scene_id','destination_scene_id']);
    add('scene_links','glass-road:return',{scene_id:crossing.id,destination_scene_id:departure.id,label:'West road — Veyrholt',x:90,y:340,created_by:ownerId},['scene_id','destination_scene_id']);
  }
  for(const d of documents){
    const path=asset(d.key);if(!path)continue;
    const authored=db.scene_discoverables.filter(r=>r.scene_id===sceneRows.get(d.scene).id&&r.name===d.name);
    if(authored.length>1)throw new Error(`Ambiguous discoverable: ${d.key}`);
    if(authored.length){if(authored[0].campaign_id!==campaignId||authored[0].storage_path!==path)throw new Error(`Existing discoverable differs: ${d.key}`);continue;}
    add('scene_discoverables',d.key,{campaign_id:campaignId,scene_id:sceneRows.get(d.scene).id,name:d.name,storage_path:path,x:d.x,y:d.y,hidden:d.hidden??false,created_by:ownerId},['campaign_id','scene_id']);
  }
  for(const [i,section]of chapter.split(/^## /m).slice(1).entries()){
    const newline=section.indexOf('\n');add('campaign_notes',`chapter:${i}`,{campaign_id:campaignId,title:`[Lornwatch] ${section.slice(0,newline).trim()}`,body:`DM ONLY\n\n${section.slice(newline+1).trim()}`,created_by:ownerId},['campaign_id']);
  }
  if(runSheet)add('campaign_notes','run-sheet',{campaign_id:campaignId,title:'[Lornwatch] START HERE — session run sheet',body:`DM ONLY\n\n${runSheet}`,created_by:ownerId},['campaign_id']);
  if(expansion)add('campaign_notes','expansion-v1',{campaign_id:campaignId,title:'[Lornwatch] Glass Road, populated town and service stairs — DM reference',body:`DM ONLY\n\n${expansion}`,created_by:ownerId},['campaign_id']);
  const installedPath=key=>{
    if(sceneRows.has(key))return db.maps.find(m=>m.id===sceneRows.get(key).map_id)?.storage_path;
    if(npcs.some(n=>n.key===key))return db.npc_templates.find(n=>n.id===chapterId(campaignId,`npc_templates:${key}`))?.image_path;
    if(monsters.some(m=>m.key===key))return db.monster_templates.find(m=>m.id===chapterId(campaignId,`monster_templates:${key}`))?.image_path;
    const d=documents.find(d=>d.key===key);return d?db.scene_discoverables.find(r=>r.scene_id===sceneRows.get(d.scene).id&&r.name===d.name)?.storage_path:null;
  };
  return {campaignId,ownerId,ops,after:db,travelConnection:departures.length?'ATTACHED_TO_EXISTING_FINAL_TABLE':'VEYRHOLT_SCENE_NOT_PRESENT',missingAssets:Object.keys(assets).filter(k=>!registry[k]&&!installedPath(k)?.startsWith(`${campaignId}/`)).map(k=>({key:k,file:assets[k]})),managedSceneIds:[...sceneRows.values()].map(s=>s.id)};
}

// Explicit optional exception for the retired destination, private notes only.
// Keep every surrounding Dealer rule, result, note edit and player record intact.
export function updatePrivateTravelHook(plan) {
  const titles=['[Veyrholt] 05 — House Veyr sequence','[Veyrholt] 07 — Final Table — runnable boss rules'];
  for(const title of titles){
    const matches=plan.after.campaign_notes.filter(n=>n.title===title);
    if(matches.length>1)throw new Error(`Ambiguous travel hook: ${title}`);
    const note=matches[0];if(!note?.body.includes('Lornwatch Abbey'))continue;
    const body=note.body.replaceAll('missing visitor from Lornwatch Abbey','missing civic surveyor Sera Pell from Lornwatch town')
      .replaceAll('missing observer at **Lornwatch Abbey**','missing civic surveyor Sera Pell at **Lornwatch town**')
      .replace('A surveyor left there for Veyrholt and never arrived.','The intended recipient has stopped answering civic reports; rumors of petty arrests also point toward the town.');
    if(body.includes('Lornwatch Abbey'))throw new Error('Unrecognized private hook wording; review manually.');
    plan.ops.push({kind:'update',table:'campaign_notes',key:'id',before:structuredClone(note),after:{body}});note.body=body;
  }
  return plan;
}

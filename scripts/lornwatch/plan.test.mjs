import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPlan, validateManifest, chapterId, updatePrivateTravelHook } from './plan.mjs';
import { previewCampaignId as campaignId, emptySnapshot } from './preview.mjs';
import { scenes, documents, assets, npcs } from './manifest.mjs';
import { snapshotSql, transactionSql } from '../veyholt/sql.mjs';
const chapter=readFileSync(new URL('../../docs/campaign/chapters/LORNWATCH.md',import.meta.url),'utf8');
const sheet=readFileSync(new URL('../../docs/campaign/chapters/LORNWATCH_RUN_SHEET.md',import.meta.url),'utf8');
const expansion=readFileSync(new URL('../../docs/campaign/chapters/LORNWATCH_EXPANSION.md',import.meta.url),'utf8');
const plan=(db=emptySnapshot(),registry={})=>buildPlan(db,campaignId,registry,chapter,sheet,expansion);
// Test-only asset keys; never exported as an install registry.
const registry=Object.fromEntries(Object.keys(assets).map(key=>[key,{path:`${campaignId}/fixtures/${key}.png`,verified:true,width:1536,height:1024}]));
test('ten native scenes are connected in both directions; all encounters and documents validate',()=>assert.deepEqual(validateManifest(),{scenes:10,npcs:46,links:22,encounters:4,documents:13}));

test('SQL preservation checks retain exact PostgreSQL numeric coordinates from the original snapshot bytes',()=>{
  const raw=JSON.stringify(emptySnapshot()).replace('"tokens":[]','"tokens":[{"id":"old-token","x":531.081427069591949546797705831078056}]');
  const snapshot=JSON.parse(raw),p=plan(snapshot),sql=transactionSql(p,snapshot,raw);
  assert.ok(sql.includes('531.081427069591949546797705831078056'));
  assert.ok(sql.includes('jsonb_each('));
  assert.ok(snapshotSql(campaignId).endsWith('::text as snapshot_json;'));
  assert.throws(()=>transactionSql(p,snapshot,'{}'),/Raw snapshot does not match/);
});
test('installation only inserts; preserves all existing chapters, characters and runtime data byte for byte',()=>{
  const db=emptySnapshot();
  db.scenes.push({id:'earlier-scene',campaign_id:campaignId,name:'Greymere',active:true,revealed:true,map_url:'existing-art'});
  db.characters.push({id:'hero',campaign_id:campaignId,current_hp:3,level:4});
  db.tokens.push({id:'player',scene_id:'earlier-scene',type:'PLAYER',x:123,y:456,conditions:['Prone']});
  db.token_interactions.push({token_id:'earlier-npc',dialogue_text:'Existing chapter remains intact'});
  db.fog_regions.push({id:'fog',scene_id:'earlier-scene',points:[1,2,3]});
  const p=plan(db,registry);
  assert.ok(p.ops.every(o=>o.kind==='insert'));
  for(const [table,rows]of Object.entries(db))for(const row of rows)assert.deepEqual(p.after[table].find(r=>(row.id?r.id===row.id:r.user_id===row.user_id&&r.token_id===row.token_id)),row);
  assert.ok(p.ops.filter(o=>o.table==='scenes').every(o=>!o.after.active&&!o.after.revealed));
});
test('repeat does not reset HP, stock, discovery/reveal or DM-authored edits',()=>{
  const db=plan(emptySnapshot(),registry).after;
  db.monster_instances[0].current_hp=1;db.monster_instances[0].dead=true;
  db.npc_shop_items[0].quantity=0;db.tokens[0].x=27;db.scene_discoverables[0].hidden=true;db.scene_discoverables[0].discovered_at='after-session';
  db.scenes[0].map_url='user-edited';db.campaign_notes[0].body='DM revised';
  assert.deepEqual(plan(db,registry).ops,[]);
});

test('browser-authored maps and evidence are recognized without creating duplicates on a registry rerun',()=>{
  const db=plan(emptySnapshot(),registry).after;
  for(const [i,map]of db.maps.entries()){
    const old=map.id;map.id=`native-map-${i}`;db.scenes.find(s=>s.map_id===old).map_id=map.id;
  }
  for(const [i,d]of db.scene_discoverables.entries())d.id=`native-evidence-${i}`;
  assert.deepEqual(plan(db,registry).ops,[]);
  assert.deepEqual(plan(db).missingAssets,[]);
  const conflict=structuredClone(db);conflict.scene_discoverables[0].storage_path=`${campaignId}/different.png`;
  assert.throws(()=>plan(conflict,registry),/Existing discoverable differs/);
});
test('no dialogue rows for ordinary NPCs; shop interactions have zero spoken text',()=>{
  const p=plan();assert.equal(p.after.token_interactions.length,7);
  for(const i of p.after.token_interactions){assert.equal(i.type,'SHOP');assert.equal(i.dialogue_text,'');assert.deepEqual(i.dialogue_pages,[]);}
});

test('every Lornwatch shop uses whole gold prices with a minimum of 1 gp',()=>{
  const stock=plan().after.npc_shop_items;
  assert.equal(stock.length,41);
  assert.ok(stock.every(item=>Number.isInteger(item.price_gp)&&item.price_gp>=1));
  assert.equal(stock.find(item=>item.name==='Private room').price_gp,2);
  assert.equal(stock.find(item=>item.name==='Hearthstone').price_gp,5);
});

test('four square vendors have real, stocked SHOP rows and no ordinary resident can open a dialogue',()=>{
  const db=plan().after;
  for(const name of ['Lina Sedge','Bram Nettles','Tessa Bloom','Daro Flint']){
    const token=db.tokens.find(t=>t.display_name===name);
    assert.equal(token.scene_id,chapterId(campaignId,'scenes:square'));
    const shop=db.token_interactions.find(i=>i.token_id===token.id);
    assert.equal(shop.enabled,true);assert.equal(shop.type,'SHOP');assert.deepEqual(shop.dialogue_pages,[]);assert.equal(shop.dialogue_text,'');
    const stock=db.npc_shop_items.filter(i=>i.interaction_id===token.id);
    assert.ok(stock.length>=4);assert.ok(stock.every(i=>i.price_gp>0&&i.quantity>0));
  }
  assert.equal(db.npc_shop_items.length,41);
  for(const n of npcs.filter(n=>!n.shop)){
    const i=npcs.indexOf(n),id=chapterId(campaignId,`tokens:npc:${i}`);
    assert.ok(!db.token_interactions.some(t=>t.token_id===id));
  }
});

test('clean scene names retain stable IDs and useful navigation labels',()=>{
  const db=plan().after;
  assert.deepEqual(db.scenes.map(s=>s.name),['Lornwatch - Sunpetal Square','Lornwatch - The Golden Finch Inn','Lornwatch - Honeycrust Bakery','Lornwatch - Bramble & Brass',"Lornwatch - Ada Rook's Cottage",'Lornwatch - Courthouse','Lornwatch - Holding Cells','Lornwatch - Lower Chamber','Lornwatch - Mossjaw Cavern','Glass Road - The Broken Crossing']);
  for(const s of scenes)assert.equal(db.scenes.find(r=>r.name===s.name).id,chapterId(campaignId,`scenes:${s.key}`));
  assert.ok(db.scene_links.every(l=>typeof l.label==='string'&&l.label.length>0));
});

test('Mira sells overnight stays, food, drinks and a DM-managed five-gold Hearthstone',()=>{
  const db=plan().after,token=db.tokens.find(t=>t.display_name==='Mira Fen');
  assert.equal(db.token_interactions.find(i=>i.token_id===token.id).type,'SHOP');
  const stock=db.npc_shop_items.filter(i=>i.interaction_id===token.id);
  for(const name of ['Bed','Private room','Supper','Tea','Ale (mug)','Hearthstone'])assert.ok(stock.some(i=>i.name===name&&i.quantity>0));
  const stone=stock.find(i=>i.name==='Hearthstone');assert.equal(stone.price_gp,5);
  assert.match(stone.description,/DM records the destination inn/);assert.match(stone.description,/purchasing does not teleport/);
});

test('Broken Crossing has four mundane robbers, three visible starting threats, travelers and a horse',()=>{
  const db=plan().after,id=chapterId(campaignId,'scenes:crossing');
  const actors=db.tokens.filter(t=>t.scene_id===id),enemies=actors.filter(t=>t.type==='MONSTER');
  assert.equal(actors.length,7);assert.equal(enemies.length,4);assert.equal(enemies.filter(t=>t.visible).length,3);
  assert.deepEqual(actors.filter(t=>t.type==='NPC').map(t=>t.display_name),['Elsi Marr','Tavin Holt','Bracken']);
  const encounter=db.encounters.find(e=>e.name.endsWith('The Broken Crossing'));
  const members=db.encounter_members.filter(m=>m.encounter_id===encounter.id);
  assert.equal(members.reduce((n,m)=>n+m.quantity,0),4);
  assert.match(encounter.notes,/Do not auto-start combat/);assert.match(encounter.notes,/south ford ten minutes\/no roll/);
  const publicRoad=JSON.stringify([actors,...documents.filter(d=>d.scene==='crossing')]);
  assert.doesNotMatch(publicRoad,/VII|Hollow|Catalyst|Ilan|Dealer/i);
  const roadLinks=db.scene_links.filter(l=>l.scene_id===id);
  assert.equal(roadLinks.length,2);assert.ok(roadLinks.every(l=>l.destination_scene_id===chapterId(campaignId,'scenes:square')));
});

test('travel attaches additively to the exact existing Veyrholt scene and never creates a replacement',()=>{
  const db=emptySnapshot(),departure={id:'existing-final-table',campaign_id:campaignId,name:'Veyrholt - Final Table',width:2000,height:1500,map_url:'user-art',active:false,revealed:true};
  db.scenes.push(departure);
  const p=plan(db),road=chapterId(campaignId,'scenes:crossing');
  assert.equal(p.travelConnection,'ATTACHED_TO_EXISTING_FINAL_TABLE');
  assert.deepEqual(p.after.scenes.find(s=>s.id===departure.id),departure);
  assert.ok(p.ops.every(o=>o.kind==='insert'));
  assert.ok(p.after.scene_links.some(l=>l.scene_id===departure.id&&l.destination_scene_id===road));
  assert.ok(p.after.scene_links.some(l=>l.scene_id===road&&l.destination_scene_id===departure.id));
  assert.deepEqual(plan(p.after).ops,[]);
  const isolated=plan();assert.equal(isolated.travelConnection,'VEYRHOLT_SCENE_NOT_PRESENT');
  assert.ok(!isolated.after.scenes.some(s=>s.name.startsWith('Veyrholt')));
  db.scenes.push({...departure,id:'ambiguous'});assert.throws(()=>plan(db),/Ambiguous Veyrholt/);
});

test('expansion appends placements without reassigning original chapter token identities',()=>{
  const db=plan().after;
  const original=[['Mira Fen','inn'],['Pippa Bell','bakery'],['Oren Bramble','store'],['Ada Rook','cottage'],['Judge Ilan Rook','court'],['Sera Pell','court'],['Jory Reed','square'],['Nell Reed','square'],['Lornwatch Guard','square'],['Lornwatch Guard','square'],['Martha Bell','cells'],['Jory Reed','cells'],['Nell Reed','inn'],['Ada Rook','square']];
  original.forEach(([name,scene],i)=>{const token=db.tokens.find(t=>t.id===chapterId(campaignId,`tokens:npc:${i}`));assert.equal(token.display_name,name);assert.equal(token.scene_id,chapterId(campaignId,`scenes:${scene}`));});
  ['Ilan Rook','Dark sphere','Owlbear','Owlbear cub','Court guard','Court guard'].forEach((name,i)=>assert.equal(db.tokens.find(t=>t.id===chapterId(campaignId,`tokens:monster:${i}`)).display_name,name));
  const oldLink=db.scene_links.find(l=>l.id===chapterId(campaignId,'scene_links:16'));
  assert.equal(oldLink.scene_id,chapterId(campaignId,'scenes:court'));assert.equal(oldLink.destination_scene_id,chapterId(campaignId,'scenes:basement'));
  assert.deepEqual([oldLink.x,oldLink.y],[1260,625]);
  assert.equal(assets.court,'maps/court-accessible.png');
});
test('Ada story and boss secrets only occur in private notes; final art starts hidden',()=>{
  const p=plan(emptySnapshot(),registry);
  const publicTables=['tokens','npc_templates','monster_templates','token_interactions','npc_shop_items','scene_discoverables','scenes'];
  const shared=JSON.stringify(publicTables.map(t=>p.after[t]));
  assert.doesNotMatch(shared,/The Witness|Catalyst|Mother, I finally|mother misses|world inside|DM_SECRET/i);
  for(const key of ['finale','vii'])assert.equal(p.after.scene_discoverables.find(d=>d.id===chapterId(campaignId,`scene_discoverables:${key}`)).hidden,true);
  assert.match(JSON.stringify(p.after.campaign_notes),/If you see him, tell him his mother misses him/);
  assert.ok(!p.after.monster_templates.some(m=>m.notes));
});
test('missing assets stay explicit and no storage paths are fabricated',()=>{
  const p=plan();assert.equal(p.after.maps.length,0);assert.equal(p.after.scene_discoverables.length,0);assert.equal(p.missingAssets.length,Object.keys(assets).length);
  assert.throws(()=>plan(emptySnapshot(),{square:{path:'https://fake.invalid/map.png',verified:true}}),/Unverified/);
  assert.throws(()=>plan(emptySnapshot(),{square:{path:`${campaignId}/maps/a.png`,verified:true,width:1,height:2}}),/dimensions/);
});
test('active combat, foreign data, missing membership and unmanaged name collisions fail closed',()=>{
  const active=emptySnapshot();active.combat_sessions.push({campaign_id:campaignId,active:true});assert.throws(()=>plan(active),/active combat/);
  const foreign=emptySnapshot();foreign.characters.push({campaign_id:'another'});assert.throws(()=>plan(foreign),/Foreign/);
  const member=emptySnapshot();member.campaign_members=[];assert.throws(()=>plan(member),/membership/);
  const collision=emptySnapshot();collision.scenes.push({id:'foreign-id',campaign_id:campaignId,name:scenes[0].name});assert.throws(()=>plan(collision),/collision/);
});
test('SQL retains native RLS, stale-row protection, protected state checks and one atomic transaction',()=>{
  const db=emptySnapshot(),sql=transactionSql(plan(db,registry),db);
  assert.match(sql,/set local role authenticated/);assert.match(sql,/Protected row changed/);assert.match(sql,/Combat is active/);assert.match(sql,/pg_advisory_xact_lock/);
  assert.doesNotMatch(sql,/disable row level|truncate|service_role/i);
  assert.ok(sql.startsWith('begin;')&&sql.trimEnd().endsWith('commit;'));
});
test('boss has independent targets with no damage immunity trap, cub absent from combat roster',()=>{
  const p=plan(),boss=p.after.encounters.find(e=>e.name.includes('basement'));
  assert.equal(p.after.encounter_members.filter(m=>m.encounter_id===boss.id).length,2);
  const sphere=p.after.monster_templates.find(t=>t.name.endsWith('Dark sphere'));assert.equal(sphere.ac,13);assert.equal(sphere.max_hp,60);assert.deepEqual(sphere.damage_immunities,['Poison','Psychic']);
  const cub=p.after.monster_templates.find(t=>t.name.endsWith('cub'));assert.ok(!p.after.encounter_members.some(e=>e.monster_template_id===cub.id));
  assert.ok(documents.filter(d=>d.text).every(d=>!d.text.includes('VII')||d.key==='vii'));
  const finales=documents.filter(d=>['finale','vii'].includes(d.key));
  for(const d of finales)for(const t of p.after.tokens.filter(t=>t.scene_id===chapterId(campaignId,'scenes:basement')))assert.ok(Math.hypot(d.x-t.x,d.y-t.y)>64*.36*t.size+15,'Finale markers must not be blocked by boss token hit areas');
});
test('optional hook update touches only two exact private notes and leaves Dealer content intact',()=>{
  const db=emptySnapshot();db.campaign_notes.push({id:'hook',campaign_id:campaignId,title:'[Veyrholt] 07 — Final Table — runnable boss rules',body:'KEEP DEALER RULES. A missing observer at **Lornwatch Abbey**. A surveyor left there for Veyrholt and never arrived. KEEP RESULTS.'});
  db.campaign_notes.push({id:'other',campaign_id:campaignId,title:'User notes',body:'Lornwatch Abbey — historical idea'});
  const p=updatePrivateTravelHook(plan(db));const changes=p.ops.filter(o=>o.kind==='update');assert.equal(changes.length,1);assert.equal(changes[0].before.id,'hook');assert.match(changes[0].after.body,/KEEP DEALER RULES/);assert.match(changes[0].after.body,/KEEP RESULTS/);assert.doesNotMatch(changes[0].after.body,/Abbey/);assert.equal(p.after.campaign_notes.find(n=>n.id==='other').body,db.campaign_notes[1].body);
  assert.deepEqual(updatePrivateTravelHook(buildPlan(p.after,campaignId,{},chapter,sheet,expansion)).ops,[]);
});

test('travel/rescue/roleplay guidance is installed as a private campaign note, never token dialogue',()=>{
  const db=plan().after,note=db.campaign_notes.find(n=>n.id===chapterId(campaignId,'campaign_notes:expansion-v1'));
  assert.ok(note.body.startsWith('DM ONLY'));
  assert.match(note.body,/Rusk is blustering/);assert.match(note.body,/Two distinct sensible actions/i);
  assert.doesNotMatch(JSON.stringify(db.token_interactions),/Rusk|conspiracy|Hollow|DC12/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPlan, validateManifest, chapterId, updatePrivateTravelHook } from './plan.mjs';
import { previewCampaignId as campaignId, emptySnapshot } from './preview.mjs';
import { scenes, documents, assets } from './manifest.mjs';
import { transactionSql } from '../veyholt/sql.mjs';
const chapter=readFileSync(new URL('../../docs/campaign/chapters/LORNWATCH.md',import.meta.url),'utf8');
const sheet=readFileSync(new URL('../../docs/campaign/chapters/LORNWATCH_RUN_SHEET.md',import.meta.url),'utf8');
const plan=(db=emptySnapshot(),registry={})=>buildPlan(db,campaignId,registry,chapter,sheet);
// Test-only asset keys; never exported as an install registry.
const registry=Object.fromEntries(Object.keys(assets).map(key=>[key,{path:`${campaignId}/fixtures/${key}.png`,verified:true,width:1536,height:1024}]));
test('nine native scenes are connected in both directions; all encounters and documents validate',()=>assert.deepEqual(validateManifest(),{scenes:9,npcs:14,links:19,encounters:3,documents:11}));
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
test('no dialogue rows for ordinary NPCs; shop interactions have zero spoken text',()=>{
  const p=plan();assert.equal(p.after.token_interactions.length,3);
  for(const i of p.after.token_interactions){assert.equal(i.type,'SHOP');assert.equal(i.dialogue_text,'');assert.deepEqual(i.dialogue_pages,[]);}
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
});
test('optional hook update touches only two exact private notes and leaves Dealer content intact',()=>{
  const db=emptySnapshot();db.campaign_notes.push({id:'hook',campaign_id:campaignId,title:'[Veyrholt] 07 — Final Table — runnable boss rules',body:'KEEP DEALER RULES. A missing observer at **Lornwatch Abbey**. A surveyor left there for Veyrholt and never arrived. KEEP RESULTS.'});
  db.campaign_notes.push({id:'other',campaign_id:campaignId,title:'User notes',body:'Lornwatch Abbey — historical idea'});
  const p=updatePrivateTravelHook(plan(db));const changes=p.ops.filter(o=>o.kind==='update');assert.equal(changes.length,1);assert.equal(changes[0].before.id,'hook');assert.match(changes[0].after.body,/KEEP DEALER RULES/);assert.match(changes[0].after.body,/KEEP RESULTS/);assert.doesNotMatch(changes[0].after.body,/Abbey/);assert.equal(p.after.campaign_notes.find(n=>n.id==='other').body,db.campaign_notes[1].body);
  assert.deepEqual(updatePrivateTravelHook(buildPlan(p.after,campaignId,{},chapter,sheet)).ops,[]);
});

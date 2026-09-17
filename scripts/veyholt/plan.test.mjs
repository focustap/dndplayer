import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { buildPlan, validateManifest } from './plan.mjs';
import { HOBB, scenes } from './manifest.mjs';
import { legacy } from './legacy.mjs';
import { transactionSql } from './sql.mjs';

const campaignId='00000000-0000-4000-8000-000000000001';
const ownerId='00000000-0000-4000-8000-000000000002';
const chapter=readFileSync(new URL('../../docs/campaign/chapters/VEYRHOLT.md',import.meta.url),'utf8');
function fixture(){
 const db=Object.fromEntries(['campaigns','campaign_members','scenes','maps','characters','campaign_notes','encounters','monster_instances','scene_discoverables','scene_zone_markers','token_interactions','combat_sessions','tokens','scene_links','scene_overlays','fog_regions','token_patrols','token_motion_segments','encounter_members','npc_shop_items','initiative_entries','monster_templates','npc_templates'].map(k=>[k,[]]));
 db.campaigns=[{id:campaignId,owner_id:ownerId}];
 const grey={id:randomUUID(),campaign_id:campaignId,name:'Greymere',active:false,revealed:true};
 db.scenes=[grey,{id:randomUUID(),campaign_id:campaignId,name:'The Threshhold',active:true,revealed:true},...scenes.map((s,i)=>({id:randomUUID(),campaign_id:campaignId,name:legacy.scenes[s.key][0],width:s.width,height:s.height,map_id:null,map_url:null,grid_type:s.grid_type,grid_opacity:0.18,active:false,revealed:i%2===0}))];
 for(const name of ['Hobb','Veyrholt Messenger']){const t={id:randomUUID(),scene_id:grey.id,type:'NPC',display_name:name,x:123,y:456,visible:name==='Hobb'};db.tokens.push(t);db.token_interactions.push({token_id:t.id,campaign_id:campaignId,dialogue_text:name==='Hobb'?HOBB:'Old appeal',dialogue_pages:[name==='Hobb'?HOBB:'Old appeal']});}
 db.tokens.push({id:randomUUID(),scene_id:db.scenes.find(s=>s.name===legacy.scenes.road[0]).id,type:'PLAYER',display_name:'Player',x:333,y:444,conditions:['Prone']});
 db.characters.push({id:randomUUID(),campaign_id:campaignId,name:'Player',current_hp:3});
 return db;
}
test('every scene is reachable and escapable, public payloads contain no secrets',()=>assert.equal(validateManifest().scenes,12));
test('rewrite preserves all player tokens, unrelated scenes and Hobb exactly',()=>{const before=fixture(),plan=buildPlan(before,campaignId,{},chapter);assert.deepEqual(plan.after.characters,before.characters);for(const t of before.tokens)assert.deepEqual(plan.after.tokens.find(r=>r.id===t.id),t);assert.deepEqual(plan.after.token_interactions.find(i=>i.dialogue_text===HOBB),before.token_interactions[0]);for(const s of before.scenes){const a=plan.after.scenes.find(r=>r.id===s.id);assert.equal(a.active,s.active);assert.equal(a.revealed,s.revealed);}assert.ok(!plan.ops.some(o=>o.kind==='delete'&&['scenes','characters'].includes(o.table)));});
test('second run is a no-op and does not restock purchased items or reset HP',()=>{const first=buildPlan(fixture(),campaignId,{},chapter);first.after.npc_shop_items[0].quantity=0;first.after.monster_instances[0].current_hp=1;const second=buildPlan(first.after,campaignId,{},chapter);assert.deepEqual(second.ops,[]);});
test('ambiguous scene names and active combat fail before mutations',()=>{const db=fixture();db.scenes.push({...db.scenes[2],id:randomUUID()});assert.throws(()=>buildPlan(db,campaignId,{},chapter),/Ambiguous/);const combat=fixture();combat.combat_sessions.push({campaign_id:campaignId,active:true});assert.throws(()=>buildPlan(combat,campaignId,{},chapter),/active combat/);});
test('obsolete cleanup uses exact names in managed scenes only',()=>{const db=fixture();const road=db.scenes.find(s=>s.name===legacy.scenes.road[0]);const grey=db.scenes[0];const name=legacy.discoverableNames[0];db.scene_discoverables=[{id:randomUUID(),campaign_id:campaignId,scene_id:road.id,name,discovered_at:null},{id:randomUUID(),campaign_id:campaignId,scene_id:grey.id,name,discovered_at:null},{id:randomUUID(),campaign_id:campaignId,scene_id:road.id,name:'User-authored keepsake',discovered_at:null}];const plan=buildPlan(db,campaignId,{},chapter);assert.deepEqual(plan.after.scene_discoverables,db.scene_discoverables.slice(1));});
test('unverified assets fail; missing assets never create fake references',()=>{const db=fixture();assert.throws(()=>buildPlan(db,campaignId,{town:{path:'https://fake.invalid/map.png',verified:true}},chapter),/Unverified/);const plan=buildPlan(db,campaignId,{},chapter);assert.equal(plan.after.maps.length,0);assert.ok(plan.missingAssets.includes('maps/final-table.png'));});
test('transaction is atomic, uses RLS, checks protected rows and scene flags',()=>{const db=fixture();const sql=transactionSql(buildPlan(db,campaignId,{},chapter),db);assert.match(sql,/^begin;/);assert.match(sql,/set local role authenticated/);assert.match(sql,/Stale row/);assert.match(sql,/Protected row changed/);assert.match(sql,/Scene active\/reveal state changed/);assert.ok(sql.trimEnd().endsWith('commit;'));assert.doesNotMatch(sql,/disable row level security|truncate|service_role/i);});

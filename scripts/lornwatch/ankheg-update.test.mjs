import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAnkhegUpdate,retiredMossjawEncounter} from './ankheg-update.mjs';
import {buildPlan,chapterId} from './plan.mjs';
import {emptySnapshot,previewCampaignId as campaignId} from './preview.mjs';
import {assets} from './manifest.mjs';
const registry=Object.fromEntries(Object.keys(assets).map(key=>[key,{path:`${campaignId}/fixtures/${key}.png`,verified:true,width:1536,height:1024}]));
const art=Object.fromEntries(['cave','ankheg','livestock'].map(k=>[k,registry[k].path]));
const id=k=>chapterId(campaignId,k);
function legacy(){
  const db=buildPlan(emptySnapshot(),campaignId,registry).after;
  db.monster_instances=db.monster_instances.filter(i=>!i.custom_name.includes('Ankheg'));
  for(const [i,key]of ['owlbear','cub'].entries()){
    const t={id:id(`monster_templates:${key}`),name:key,max_hp:i?10:59,ac:i?11:13};db.monster_templates.push(t);
    const inst={id:id(`monster_instances:${i+2}`),campaign_id:campaignId,template_id:t.id,current_hp:t.max_hp,max_hp:t.max_hp,dead:false,conditions:[],notes:'',damage_dice_overrides:{}};db.monster_instances.push(inst);
    Object.assign(db.tokens.find(t=>t.id===id(`tokens:monster:${i+2}`)),{reference_id:inst.id,display_name:key,visible:false,size:i?.6:2});
  }
  const e=db.encounters.find(e=>e.id===id('encounters:cave'));Object.assign(e,retiredMossjawEncounter);
  Object.assign(db.encounter_members.find(m=>m.encounter_id===e.id),{monster_template_id:id('monster_templates:owlbear'),quantity:1});
  db.scene_discoverables.find(d=>d.name==='Livestock notice').storage_path=`${campaignId}/old-notice.png`;
  return db;
}
test('replacement reuses scene, encounter and token IDs, preserves coordinates, original creatures, shops and discoveries',()=>{
  const before=legacy(),second=before.tokens.find(t=>t.id===id('tokens:monster:3'));
  second.x=1392.4956768865425;second.y=171.43033596467652;
  const notice=before.scene_discoverables.find(d=>d.name==='Livestock notice');notice.discovered_at='already-discovered';notice.hidden=true;
  const p=buildAnkhegUpdate(before,campaignId,art);
  assert.equal(p.retired.length,2);
  for(const table of ['scenes','maps','characters','npc_shop_items','token_interactions','scene_links','combat_sessions','initiative_entries'])assert.deepEqual(p.after[table],before[table]);
  for(const old of before.monster_instances)assert.deepEqual(p.after.monster_instances.find(i=>i.id===old.id),old);
  const tokens=p.after.tokens.filter(t=>t.scene_id===id('scenes:cave'));assert.equal(tokens.length,2);assert.deepEqual(tokens.map(t=>t.visible),[true,false]);assert.ok(tokens.every(t=>t.size===2&&Number.isFinite(t.rotation)));
  assert.deepEqual([tokens[1].x,tokens[1].y],[second.x,second.y]);assert.notEqual(tokens[0].reference_id,tokens[1].reference_id);
  const instances=tokens.map(t=>p.after.monster_instances.find(i=>i.id===t.reference_id));assert.deepEqual(instances.map(i=>[i.current_hp,i.max_hp,i.ac]),[[39,39,14],[39,39,14]]);
  const d=p.after.scene_discoverables.find(d=>d.id===notice.id);assert.equal(d.discovered_at,'already-discovered');assert.equal(d.hidden,true);
  assert.equal(p.after.encounter_members.find(m=>m.encounter_id===id('encounters:cave')).quantity,2);
  instances[0].current_hp=7;tokens[1].visible=true;tokens[1].x=777;
  assert.deepEqual(buildAnkhegUpdate(p.after,campaignId,art).ops,[]);
});
test('played HP, initiative history, combat, altered composition and private-note conflicts stop the update',()=>{
  const hp=legacy();hp.monster_instances.find(i=>i.template_id===id('monster_templates:cub')).current_hp=3;assert.throws(()=>buildAnkhegUpdate(hp,campaignId,art),/played\/edited/);
  const combat=legacy();combat.combat_sessions.push({scene_id:id('scenes:cave'),active:false});assert.throws(()=>buildAnkhegUpdate(combat,campaignId,art),/combat history/);
  const initiative=legacy();initiative.initiative_entries.push({token_id:id('tokens:monster:2')});assert.throws(()=>buildAnkhegUpdate(initiative,campaignId,art),/initiative history/);
  const edited=legacy();edited.encounters.find(e=>e.id===id('encounters:cave')).notes='DM recorded a played outcome';assert.throws(()=>buildAnkhegUpdate(edited,campaignId,art),/Retired encounter was edited/);
  const note=legacy();note.campaign_notes.push({id:'custom',campaign_id:campaignId,title:'DM modified',body:'played outcome'});assert.throws(()=>buildAnkhegUpdate(note,campaignId,art,[{id:'custom',beforeBody:'old preparation',afterBody:'new quest'}]),/DM note changed/);
  assert.throws(()=>buildAnkhegUpdate(legacy(),campaignId,{...art,ankheg:'https://fake.invalid/image'}),/R2/);
});
test('native Ankheg actions expose both Bite damage components, grapple, save, recharge and burrow',()=>{
  const t=legacy().monster_templates.find(t=>t.id===id('monster_templates:ankheg'));
  assert.equal(t.movement.burrow,10);assert.equal(t.movement.walk,30);
  const [bite,spray]=t.actions;assert.equal(bite.attackBonus,5);assert.deepEqual(bite.damage.map(d=>d.dice),['2d6+3','1d6']);assert.ok(bite.conditions.includes('Grappled'));
  assert.deepEqual(spray.save,{ability:'DEX',dc:13});assert.deepEqual(spray.usage,{kind:'RECHARGE',value:'6'});assert.equal(spray.damage[0].dice,'3d6');assert.match(spray.description,/half on success/);
});

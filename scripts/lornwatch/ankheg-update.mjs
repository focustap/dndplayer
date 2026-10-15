// Explicit, opt-in replacement of the retired Mossjaw preparation. Unlike the
// additive installer this command may update only the listed encounter fields.
import {chapterId} from './plan.mjs';
import {monsters,encounters} from './manifest.mjs';

export const retiredMossjawEncounter={name:'[Lornwatch] Mossjaw nesting ground',notes:'DM ONLY. Optional, no Hollow connection. One adult, cub noncombatant. Starts only if cornered/attacked/nest threatened. Food + two practical efforts can relocate; DC13 Handling buys calm, failure warning charge/retreat. Retreat to cub bloodied, no pursuit. Stream difficult, boulders cover. Easy45HP one attack, hard65HP.40gp for ending livestock losses by any route; satchel12gp,potion,brooch8gp. Do not add cub to initiative.'};

export function buildAnkhegUpdate(snapshot,campaignId,assets,notes=[]) {
  const db=structuredClone(snapshot),ops=[];
  const only=(table,predicate,label)=>{const rows=db[table].filter(predicate);if(rows.length!==1)throw Error(`Expected one ${label}`);return rows[0];};
  const campaign=only('campaigns',r=>r.id===campaignId,'campaign');
  if(!db.campaign_members.some(r=>r.campaign_id===campaignId&&r.user_id===campaign.owner_id&&['OWNER','DM'].includes(r.role)))throw Error('DM membership required');
  if(db.combat_sessions.some(r=>r.active))throw Error('Refusing update during active combat');
  const cave=only('scenes',r=>r.id===chapterId(campaignId,'scenes:cave')&&r.campaign_id===campaignId,'Mossjaw scene');
  if(db.combat_sessions.some(r=>r.scene_id===cave.id))throw Error('Mossjaw has combat history; review played outcomes manually');
  const path=key=>{const p=assets[key];if(typeof p!=='string'||!p.startsWith(`${campaignId}/`)||/[?\\]|\.\./.test(p))throw Error(`Verified R2 ${key} path required`);return p;};
  const template=only('monster_templates',r=>r.id===chapterId(campaignId,'monster_templates:ankheg'),'staged Ankheg template');
  const expected=monsters.find(m=>m.key==='ankheg');
  if(template.max_hp!==39||template.ac!==14||template.image_path!==path('ankheg')||JSON.stringify(template.actions)!==JSON.stringify(expected.actions)){
    // JSONB object key ordering differs from authored JS; compare by content.
    const canonical=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
    if(template.max_hp!==39||template.ac!==14||template.image_path!==path('ankheg')||canonical(template.actions)!==canonical(expected.actions))throw Error('Staged template differs; inspect before applying');
  }
  const map=only('maps',r=>r.id===cave.map_id,'uploaded cave map');
  if(map.storage_path!==path('cave')||map.width!==1536||map.height!==1024)throw Error('Replacement map not installed/verified');
  const update=(table,row,after)=>{
    if(Object.entries(after).every(([k,v])=>JSON.stringify(row[k])===JSON.stringify(v)))return;
    ops.push({kind:'update',table,key:'id',before:structuredClone(row),after});Object.assign(row,after);
  };
  const oldTemplates=['owlbear','cub'].map(k=>chapterId(campaignId,`monster_templates:${k}`));
  const retired=[];
  for(let i=0;i<2;i++){
    const token=only('tokens',r=>r.id===chapterId(campaignId,`tokens:monster:${i+2}`)&&r.scene_id===cave.id&&r.type==='MONSTER',`cave token ${i+1}`);
    if(db.initiative_entries.some(r=>r.token_id===token.id))throw Error('Cave token has initiative history');
    const newId=chapterId(campaignId,`monster_instances:ankheg:${i+1}`);
    if(token.reference_id!==newId){
      const old=only('monster_instances',r=>r.id===token.reference_id&&r.campaign_id===campaignId,'retired creature');
      if(old.template_id!==oldTemplates[i]||old.current_hp!==old.max_hp||old.dead||old.conditions?.length||old.notes||Object.keys(old.damage_dice_overrides??{}).length||old.hp_formula_override)throw Error('Retired creature has played/edited state; preserve and review manually');
      retired.push({token:token.id,oldInstance:old.id,x:token.x,y:token.y,visible:token.visible,size:token.size});
    }
    let instance=db.monster_instances.find(r=>r.id===newId);
    if(!instance){instance={id:newId,campaign_id:campaignId,template_id:template.id,custom_name:`Lornwatch — Ankheg ${i+1}`,current_hp:39,max_hp:39,ac:14,visible:i===0,dead:false,notes:''};db.monster_instances.push(instance);ops.push({kind:'insert',table:'monster_instances',key:'id',after:instance});}
    else if(instance.campaign_id!==campaignId||instance.template_id!==template.id)throw Error('Ankheg instance identity conflict');
    // Once installed, retries must preserve HP, visibility, position and DM edits.
    if(token.reference_id!==newId)update('tokens',token,{reference_id:newId,display_name:`Ankheg ${i+1}`,size:2,rotation:Number.isFinite(token.rotation)?token.rotation:0,image_path:path('ankheg'),image_url:null,visible:i===0});
  }
  const encounter=only('encounters',r=>r.id===chapterId(campaignId,'encounters:cave')&&r.campaign_id===campaignId,'existing Mossjaw encounter');
  const spec=encounters.find(e=>e.key==='cave');
  const member=only('encounter_members',r=>r.encounter_id===encounter.id,'Mossjaw composition');
  if(![oldTemplates[0],template.id].includes(member.monster_template_id))throw Error('Encounter composition was edited; review');
  if(member.monster_template_id!==template.id){
    if(member.quantity!==1||encounter.name!==retiredMossjawEncounter.name||encounter.notes!==retiredMossjawEncounter.notes)throw Error('Retired encounter was edited; preserve and review manually');
    update('encounters',encounter,{name:spec.name,notes:spec.notes});
    update('encounter_members',member,{monster_template_id:template.id,monster_instance_id:null,quantity:2});
  }
  const notice=only('scene_discoverables',r=>r.campaign_id===campaignId&&r.scene_id===chapterId(campaignId,'scenes:store')&&r.name==='Livestock notice','existing livestock notice');
  update('scene_discoverables',notice,{storage_path:path('livestock')});
  for(const {id,beforeBody,afterBody} of notes){
    const row=only('campaign_notes',r=>r.id===id&&r.campaign_id===campaignId,'private quest note');
    if(row.body===afterBody)continue;
    if(!row.body.includes(beforeBody))throw Error(`DM note changed; review ${row.title}`);
    update('campaign_notes',row,{body:row.body.replace(beforeBody,afterBody)});
  }
  return {campaignId,ownerId:campaign.owner_id,ops,after:db,retired};
}

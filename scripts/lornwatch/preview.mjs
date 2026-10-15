// Local fixture for the real Wayfinder scene builder. No database or credentials.
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { buildPlan, chapterId } from './plan.mjs';
import { scenes, npcs, placements, documents } from './manifest.mjs';
export const previewCampaignId='00000000-0000-4000-8000-000000000027';
export function emptySnapshot(campaignId=previewCampaignId) {
  const db=Object.fromEntries(['campaigns','campaign_members','scenes','maps','characters','campaign_notes','encounters','monster_instances','scene_discoverables','scene_zone_markers','token_interactions','combat_sessions','tokens','scene_links','scene_overlays','fog_regions','token_patrols','token_motion_segments','encounter_members','npc_shop_items','initiative_entries','monster_templates','npc_templates'].map(t=>[t,[]]));
  const owner='00000000-0000-4000-8000-000000000002';
  db.campaigns.push({id:campaignId,owner_id:owner});db.campaign_members.push({campaign_id:campaignId,user_id:owner,role:'OWNER'});return db;
}
async function main(){
  const chapter=await readFile(new URL('../../docs/campaign/chapters/LORNWATCH.md',import.meta.url),'utf8');
  const sheet=await readFile(new URL('../../docs/campaign/chapters/LORNWATCH_RUN_SHEET.md',import.meta.url),'utf8');
  const db=buildPlan(emptySnapshot(),previewCampaignId,{},chapter,sheet).after;
  const local=async(file)=>{try{await access(new URL(`../../outputs/lornwatch/${file}`,import.meta.url));return `/__lornwatch/${file}`;}catch{return null;}};
  for(const s of scenes){const row=db.scenes.find(r=>r.id===chapterId(previewCampaignId,`scenes:${s.key}`));row.map_url=await local(`maps/${s.key}.png`);}
  for(const [i,n]of npcs.entries()){const row=db.tokens.find(t=>t.id===chapterId(previewCampaignId,`tokens:npc:${i}`));row.image_url=await local(`portraits/${n.key}.png`);}
  for(const [i,p]of placements.entries()){const row=db.tokens.find(t=>t.id===chapterId(previewCampaignId,`tokens:monster:${i}`));row.image_url=await local(`tokens/${p.monster}.png`);}
  for(const m of db.monster_instances){const template=db.monster_templates.find(t=>t.id===m.template_id);m.monster_templates={...template,image_path:null};}
  for(const d of documents){const url=await local(`discoverables/${d.key}.png`);if(url)db.scene_discoverables.push({id:chapterId(previewCampaignId,`scene_discoverables:${d.key}`),campaign_id:previewCampaignId,scene_id:chapterId(previewCampaignId,`scenes:${d.scene}`),name:d.name,x:d.x,y:d.y,hidden:d.hidden??false,image_url:url,discovered_at:null,storage_path:null});}
  // Notes never enter browser fixture. Consult the private files separately.
  db.campaign_notes=[];
  await mkdir(new URL('../../outputs/lornwatch/',import.meta.url),{recursive:true});
  await writeFile(new URL('../../outputs/lornwatch/preview.json',import.meta.url),JSON.stringify(db,null,2));
  console.log(`Preview ready: /campaign/demo/scene/${chapterId(previewCampaignId,'scenes:square')}/builder`);
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/preview.mjs'))await main();

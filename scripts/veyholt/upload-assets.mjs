// Upload real files through the existing authenticated Wayfinder Worker.
// Never uses direct R2 credentials or Supabase Storage.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename, resolve } from 'node:path';
import { assets, scenes } from './manifest.mjs';

const args=process.argv.slice(2);
const flag=name=>{const i=args.indexOf(name);return i<0?null:args[i+1];};
async function main(){
 const campaignId=flag('--campaign-id'),key=flag('--key'),file=flag('--file'),out=flag('--registry');
 if(!/^[0-9a-f-]{36}$/i.test(campaignId)||!assets[key]||!file||!out)throw new Error('Use --campaign-id UUID --key town --file path.png --registry private-registry.json');
 const token=process.env.WAYFINDER_ACCESS_TOKEN;
 if(!token)throw new Error('Set WAYFINDER_ACCESS_TOKEN to the existing DM access token; never commit it.');
 const worker=(process.env.VITE_ASSET_API_URL||process.env.VITE_R2_ASSET_WORKER_URL||'https://wayfinder-assets.wayfinder-assets.workers.dev').replace(/\/$/,'');
 const bytes=await readFile(resolve(file));
 if(bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw new Error('Supply PNG bytes; do not disguise another file format.');
 const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
 const scene=scenes.find(s=>s.key===key);
 if(scene&&(width!==scene.width||height!==scene.height))throw new Error(`Expected ${scene.width}×${scene.height} for ${key}; update the plan deliberately before resizing scenes.`);
 const sha256=createHash('sha256').update(bytes).digest('hex');
 let registry={};try{registry=JSON.parse(await readFile(resolve(out),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
 const headers={authorization:`Bearer ${token}`};
 if(registry[key]?.sha256===sha256){const response=await fetch(`${worker}/v1/sign`,{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({campaignId,path:registry[key].path})});if(response.ok){console.log(`${key}: existing R2 asset verified; no upload.`);return;}if(response.status!==404)throw new Error(`Asset verification failed (${response.status}).`);}
 const category=scene?'maps':assets[key].startsWith('discoverables/')?'discoverables':['scout','bandit','graveyardDog','usher','hound','jester'].includes(key)?'monster-templates':'npc-templates';
 const response=await fetch(`${worker}/v1/upload?${new URLSearchParams({campaignId,category})}`,{method:'POST',headers:{...headers,'content-type':'image/png','x-file-name':basename(assets[key])},body:bytes});
 if(!response.ok)throw new Error(`Worker upload failed (${response.status}).`);
 const result=await response.json();
 if(typeof result.path!=='string'||!result.path.startsWith(`${campaignId}/`))throw new Error('Unexpected asset reference returned by Worker');
 registry[key]={path:result.path,width,height,sha256,verified:true};
 await writeFile(resolve(out),JSON.stringify(registry,null,2)+'\n');
 console.log(`${key}: uploaded to R2; reference saved in private registry.`);
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});

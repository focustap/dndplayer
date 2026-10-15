import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { assets, scenes } from './manifest.mjs';
const rows=[];
for(const [key,file]of Object.entries(assets)){
  let bytes;try{bytes=await readFile(new URL(`../../outputs/lornwatch/${file}`,import.meta.url));}catch(error){if(error.code!=='ENOENT')throw error;rows.push({key,file,status:'MISSING'});continue;}
  if(bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw new Error(`Not PNG: ${file}`);
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20),scene=scenes.find(s=>s.key===key);
  if(scene&&(width!==scene.width||height!==scene.height))throw new Error(`Wrong map dimensions: ${file}`);
  rows.push({key,file,status:'LOCAL_READY_R2_PENDING',width,height,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
await writeFile(new URL('../../docs/campaign/chapters/LORNWATCH_ASSETS.json',import.meta.url),JSON.stringify({root:'outputs/lornwatch',note:'Local generated artwork; these are file paths, not R2 keys. No live campaign installation is implied.',assets:rows},null,2)+'\n');
console.log(`${rows.filter(r=>r.status!=='MISSING').length}/${rows.length} assets ready locally`);

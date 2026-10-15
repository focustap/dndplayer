import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildPlan, validateManifest } from './lornwatch/plan.mjs';
import { snapshotSql, transactionSql } from './veyholt/sql.mjs';

async function main(){
  const args=process.argv.slice(2),value=flag=>{const i=args.indexOf(flag);return i<0?null:args[i+1];};
  if(args.includes('--apply'))throw new Error('No automatic apply. Review rollback-only SQL and obtain explicit live installation approval.');
  const campaignId=value('--campaign-id');
  if(args.includes('--snapshot-sql')){console.log(snapshotSql(campaignId));return;}
  if(!value('--snapshot')){if(value('--sql')||value('--plan'))throw new Error('A fresh --snapshot is required');console.log(JSON.stringify(validateManifest(),null,2));return;}
  const snapshot=JSON.parse(await readFile(resolve(value('--snapshot')),'utf8'));
  const registry=value('--assets')?JSON.parse(await readFile(resolve(value('--assets')),'utf8')):{};
  const chapter=await readFile(new URL('../docs/campaign/chapters/LORNWATCH.md',import.meta.url),'utf8');
  const runSheet=await readFile(new URL('../docs/campaign/chapters/LORNWATCH_RUN_SHEET.md',import.meta.url),'utf8');
  const plan=buildPlan(snapshot,campaignId,registry,chapter,runSheet);
  if(value('--plan'))await writeFile(resolve(value('--plan')),JSON.stringify(plan,null,2));
  if(value('--sql'))await writeFile(resolve(value('--sql')),transactionSql(plan,snapshot).replace(/commit;\s*$/,'rollback;\n-- Review and explicitly approve before changing this rollback to commit.\n'));
  console.log(JSON.stringify({operations:plan.ops.length,byTable:Object.fromEntries([...new Set(plan.ops.map(o=>o.table))].map(t=>[t,plan.ops.filter(o=>o.table===t).length])),missingAssets:plan.missingAssets},null,2));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { buildPlan, validateManifest } from './veyholt/plan.mjs';
import { snapshotSql, transactionSql } from './veyholt/sql.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
async function main(){
 const args=process.argv.slice(2);const flag=name=>{const i=args.indexOf(name);return i<0?null:args[i+1];};
 const campaignId=flag('--campaign-id');
 if(args.includes('--snapshot-sql')){console.log(snapshotSql(campaignId));return;}
 if(!flag('--snapshot')){if(args.includes('--apply')||flag('--sql'))throw new Error('--snapshot is required before any write');console.log(JSON.stringify({valid:true,...validateManifest()},null,2));return;}
 const snapshot=JSON.parse(await readFile(resolve(flag('--snapshot')),'utf8'));
 const registry=flag('--assets')?JSON.parse(await readFile(resolve(flag('--assets')),'utf8')):{};
 const chapter=await readFile(resolve(root,'docs/campaign/chapters/VEYRHOLT.md'),'utf8');
 const plan=buildPlan(snapshot,campaignId,registry,chapter);
 const summary={valid:true,...validateManifest(),operations:plan.ops.length,byTable:Object.fromEntries([...new Set(plan.ops.map(o=>o.table))].map(t=>[t,plan.ops.filter(o=>o.table===t).length])),missingAssets:plan.missingAssets};
 if(flag('--plan'))await writeFile(resolve(flag('--plan')),JSON.stringify(plan,null,2));
 const sql=transactionSql(plan,snapshot);
 if(flag('--sql'))await writeFile(resolve(flag('--sql')),sql);
 if(args.includes('--apply')){
  if(!process.env.WAYFINDER_DATABASE_URL)throw new Error('Set WAYFINDER_DATABASE_URL for psql, or execute the reviewed --sql output through the Supabase connector. Never commit credentials.');
  const result=spawnSync('psql',['--no-psqlrc','--set','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',env:{...process.env,PGDATABASE:process.env.WAYFINDER_DATABASE_URL}});
  if(result.status!==0)throw new Error(result.error?.message??result.stderr??'Transaction failed');
  summary.applied=true;
 }
 console.log(JSON.stringify(summary,null,2));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});

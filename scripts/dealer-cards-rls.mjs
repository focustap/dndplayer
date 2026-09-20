// Produce a rollback-only integration test for a trusted Supabase SQL connection.
// Reads a private campaign snapshot to select real role identities; writes no credentials.
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID, webcrypto } from 'node:crypto';
import ts from 'typescript';
if (!globalThis.crypto) globalThis.crypto = webcrypto;
const [snapshotPath, outputPath] = process.argv.slice(2);
if (!snapshotPath || !outputPath) throw new Error('Usage: node scripts/dealer-cards-rls.mjs PRIVATE_SNAPSHOT OUTPUT_SQL');
const db = JSON.parse(readFileSync(snapshotPath, 'utf8'));
const campaign = db.campaigns[0], player = db.campaign_members.find(m=>m.role==='PLAYER');
const scene = db.scenes.find(s=>!s.active && !db.combat_sessions.some(c=>c.active&&c.scene_id===s.id));
if (!player || !scene) throw new Error('Needs an existing player role and inactive scene.');
const compiled = ts.transpileModule(readFileSync(new URL('../src/domain/dealerCards.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {newDealerDeck,reduceDealerDeck} = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const deck = reduceDealerDeck(newDealerDeck(),{type:'deal',holders:[{id:'dealer',name:'The Dealer',ownerId:null,tokenId:null},{id:'player',name:'QA holder',ownerId:player.user_id,tokenId:null}]});
const literal=value=>`'${String(value).replaceAll("'","''")}'`;
const combat=randomUUID(), state=literal(JSON.stringify(deck));
const identity=id=>`select set_config('request.jwt.claim.sub',${literal(id)},true); select set_config('request.jwt.claim.role','authenticated',true); set local role authenticated;`;
writeFileSync(outputPath,`begin;
create temporary table card_test_stats as select
 (select jsonb_agg(to_jsonb(c) order by id) from public.characters c) characters,
 (select jsonb_agg(to_jsonb(m) order by id) from public.monster_instances m) monsters;
${identity(campaign.owner_id)}
insert into public.combat_sessions(id,campaign_id,scene_id) values('${combat}','${campaign.id}','${scene.id}');
select public.save_combat_cards('${combat}',0,${state}::jsonb);
do $$ begin
 if not exists(select 1 from public.combat_card_decks where combat_session_id='${combat}' and version=1) then raise exception 'DM save failed'; end if;
 begin
  perform public.save_combat_cards('${combat}',0,${state}::jsonb);
  raise exception 'STALE WRITE ACCEPTED';
 exception when others then
  if sqlerrm not like '%Cards changed in another session%' then raise; end if;
 end;
 if exists(select 1 from public.combat_card_presentations where combat_session_id='${combat}' and (state ? 'draw' or state ? 'queue' or state ? 'preview' or state ? 'charges')) then raise exception 'Private state leaked'; end if;
end $$;
reset role;
create temporary table card_test_time as select updated_at from public.combat_card_presentations where combat_session_id='${combat}';
${identity(campaign.owner_id)}
select public.save_combat_cards('${combat}',1,${state}::jsonb);
reset role;
do $$ begin
 if (select updated_at from public.combat_card_presentations where combat_session_id='${combat}') <> (select updated_at from card_test_time) then raise exception 'Unrelated save restarted animation'; end if;
end $$;
${identity(player.user_id)}
do $$ declare affected integer; begin
 if exists(select 1 from public.combat_card_decks where combat_session_id='${combat}') then raise exception 'PLAYER READ PRIVATE DECK'; end if;
 if not exists(select 1 from public.combat_card_presentations where combat_session_id='${combat}' and state->'active'->'player' is not null) then raise exception 'Player cannot read exposed cards'; end if;
 update public.combat_card_presentations set version=99 where combat_session_id='${combat}';
 get diagnostics affected=row_count; if affected<>0 then raise exception 'PLAYER UPDATED PRESENTATION'; end if;
 begin
  perform public.save_combat_cards('${combat}',2,${state}::jsonb);
  raise exception 'PLAYER RPC ACCEPTED';
 exception when others then
  if sqlerrm not like '%DM permission required%' then raise; end if;
 end;
 begin
  insert into public.combat_card_decks values('${combat}','${campaign.id}',99,${state}::jsonb,now());
  raise exception 'PLAYER INSERT ACCEPTED';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
${identity(randomUUID())}
do $$ begin
 if exists(select 1 from public.combat_card_presentations where combat_session_id='${combat}') then raise exception 'OUTSIDER READ CARDS'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
 begin
  perform public.save_combat_cards('${combat}',2,${state}::jsonb);
  raise exception 'ANON RPC ACCEPTED';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
do $$ begin
 if (select characters from card_test_stats) is distinct from (select jsonb_agg(to_jsonb(c) order by id) from public.characters c)
 or (select monsters from card_test_stats) is distinct from (select jsonb_agg(to_jsonb(m) order by id) from public.monster_instances m)
 then raise exception 'Creature stats changed'; end if;
end $$;
select 'PASS: DM save, stale conflict, projection, stable replay timestamp, player read-only, outsider/anon denial, unchanged stats. All test writes rolled back.' as result;
rollback;
`);
console.log('Rollback-only card RLS test written.');

// Reviewable, atomic DML. No schema changes or policy bypasses are installed.
const uuid=value=>{if(!/^[0-9a-f-]{36}$/i.test(value))throw new Error('Invalid UUID');return `'${value}'`;};
const literal=value=>"'"+String(value).replaceAll("'","''")+"'";
export function snapshotSql(campaignId) {
 const c=uuid(campaignId),scene=`scene_id in (select id from public.scenes where campaign_id=${c})`;
 const scopes={campaigns:`id=${c}`,campaign_members:`campaign_id=${c}`,scenes:`campaign_id=${c}`,maps:`campaign_id=${c}`,characters:`campaign_id=${c}`,campaign_notes:`campaign_id=${c}`,encounters:`campaign_id=${c}`,monster_instances:`campaign_id=${c}`,scene_discoverables:`campaign_id=${c}`,scene_zone_markers:`campaign_id=${c}`,token_interactions:`campaign_id=${c}`,combat_sessions:`campaign_id=${c}`,tokens:scene,scene_links:scene,scene_overlays:scene,fog_regions:scene,token_patrols:scene,token_motion_segments:scene,encounter_members:`encounter_id in (select id from public.encounters where campaign_id=${c})`,npc_shop_items:`interaction_id in (select token_id from public.token_interactions where campaign_id=${c})`,initiative_entries:`combat_session_id in (select id from public.combat_sessions where campaign_id=${c})`,monster_templates:'true',npc_templates:'true'};
 return `select jsonb_build_object(${Object.entries(scopes).map(([t,w])=>`${literal(t)},(select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) from public.${t} r where ${w})`).join(',')}) as snapshot;`;
}

export function transactionSql(plan,snapshot) {
 const tables=['maps','scenes','npc_templates','monster_templates','tokens','token_interactions','npc_shop_items','monster_instances','encounters','encounter_members','scene_links','scene_discoverables','scene_zone_markers','campaign_notes'];
 for(const op of plan.ops)if(!tables.includes(op.table))throw new Error('Unexpected table');
 const touched=new Set(plan.ops.filter(o=>o.before).map(o=>`${o.table}:${o.before[o.key]}`));
 // Compare EVERY untouched original row after applying; no broad delete can hide
 // behind counts. Campaign members use their composite primary key.
 const checks=[];
 for(const [table,rows]of Object.entries(snapshot))for(const row of rows){const key=table==='token_interactions'||table==='token_motion_segments'?'token_id':table==='campaign_members'?'user_id':'id';if(!touched.has(`${table}:${row[key]}`))checks.push({table,key,row});}
 const flags=snapshot.scenes.map(({id,active,revealed})=>({id,active,revealed}));
 const payload=literal(JSON.stringify(plan.ops));
 return `begin;
set local lock_timeout = '5s';
set local statement_timeout = '90s';
-- Authenticated role and existing owner identity: ordinary RLS still applies.
select set_config('request.jwt.claim.sub', ${uuid(plan.ownerId)}, true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
do $veyholt$
declare op jsonb; actual jsonb; cols text; setters text; affected integer; checkrow jsonb;
begin
 if not exists (select 1 from public.campaign_members where campaign_id=${uuid(plan.campaignId)} and user_id=auth.uid() and role in ('OWNER','DM')) then raise exception 'DM membership required'; end if;
 if exists (select 1 from public.combat_sessions where campaign_id=${uuid(plan.campaignId)} and active) then raise exception 'Combat is active'; end if;
 -- Serialize importers for this campaign. Concurrent edited rows are rejected below.
 perform pg_advisory_xact_lock(hashtext(${uuid(plan.campaignId)}));
 for op in select value from jsonb_array_elements(${payload}::jsonb) loop
  if op->>'table' not in (${tables.map(literal).join(',')}) or op->>'key' not in ('id','token_id') then raise exception 'Unexpected operation'; end if;
  if op->>'kind' <> 'insert' then
   execute format('select to_jsonb(t) from public.%I t where %I=$1::uuid for update',op->>'table',op->>'key') into actual using op->'before'->>(op->>'key');
   if actual is null or not ((actual - 'updated_at') @> ((op->'before') - 'updated_at')) then raise exception 'Stale row in %; resnapshot before applying',op->>'table'; end if;
  end if;
  if op->>'kind'='delete' then
   if op->>'table'='scenes' or (op->>'table'='tokens' and actual->>'type'='PLAYER') then raise exception 'Protected deletion'; end if;
   execute format('delete from public.%I where %I=$1::uuid',op->>'table',op->>'key') using op->'before'->>(op->>'key');
  elsif op->>'kind'='insert' then
   select string_agg(format('%I',key),',' order by key) into cols from jsonb_object_keys(op->'after') key;
   execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I,$1)',op->>'table',cols,cols,op->>'table') using op->'after';
  elsif op->>'kind'='update' then
   select string_agg(format('%I=r.%I',key,key),',' order by key) into setters from jsonb_object_keys(op->'after') key;
   execute format('update public.%I t set %s from jsonb_populate_record(null::public.%I,$1) r where t.%I=$2::uuid',op->>'table',setters,op->>'table',op->>'key') using op->'after',op->'before'->>(op->>'key');
  else raise exception 'Unknown operation'; end if;
  get diagnostics affected = row_count;
  if affected<>1 then raise exception 'Expected one affected row in %, got %',op->>'table',affected; end if;
 end loop;
 for checkrow in select value from jsonb_array_elements(${literal(JSON.stringify(checks))}::jsonb) loop
  if checkrow->>'table'='campaign_members' then
   select to_jsonb(t) into actual from public.campaign_members t where campaign_id=${uuid(plan.campaignId)} and user_id=(checkrow->'row'->>'user_id')::uuid;
  else
   execute format('select to_jsonb(t) from public.%I t where %I=$1::uuid',checkrow->>'table',checkrow->>'key') into actual using checkrow->'row'->>(checkrow->>'key');
  end if;
  if actual is distinct from checkrow->'row' then raise exception 'Protected row changed in %',checkrow->>'table'; end if;
 end loop;
 for checkrow in select value from jsonb_array_elements(${literal(JSON.stringify(flags))}::jsonb) loop
  if not exists(select 1 from public.scenes s where s.id=(checkrow->>'id')::uuid and s.active=(checkrow->>'active')::boolean and s.revealed=(checkrow->>'revealed')::boolean) then raise exception 'Scene active/reveal state changed'; end if;
 end loop;
end $veyholt$;
commit;
`;
}

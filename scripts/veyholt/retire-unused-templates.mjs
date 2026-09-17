import { legacy } from './legacy.mjs';
// Run ONLY through the trusted database admin connection after the chapter
// transaction. No assets are deleted. FKs plus parent-row locks protect races.
// Shared templates still referenced anywhere are left untouched.
export const retireUnusedTemplatesSql = `begin;
set local lock_timeout='5s';
do $retire$
declare t record;
begin
 if not exists(select 1 from pg_roles where rolname=current_user and (rolsuper or rolbypassrls)) then
  raise exception 'Template retirement requires an admin role with full cross-campaign visibility';
 end if;
 for t in select id from public.monster_templates where name in (${legacy.monsterNames.map(n=>"'"+n.replaceAll("'","''")+"'").join(',')}) for update loop
  if not exists(select 1 from public.monster_instances where template_id=t.id)
   and not exists(select 1 from public.encounter_members where monster_template_id=t.id)
   and not exists(select 1 from public.tokens where reference_id=t.id) then
   delete from public.monster_templates where id=t.id;
  end if;
 end loop;
end $retire$;
commit;`;

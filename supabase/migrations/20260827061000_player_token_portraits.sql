-- Keep placed monster/NPC token portraits self-contained so players do not
-- need access to the DM-only template libraries to render them.

-- Backfill every placed NPC token from its source template.
update public.tokens t
set image_path = nt.image_path,
    image_url = case when nt.image_path is not null then null else nt.image_url end,
    updated_at = now()
from public.npc_templates nt
where t.type = 'NPC'
  and t.reference_id = nt.id
  and (
    t.image_path is distinct from nt.image_path
    or (
      nt.image_path is not null
      and t.image_url is not null
    )
  );

-- Backfill every placed monster token through its monster instance.
update public.tokens t
set image_path = mt.image_path,
    image_url = case when mt.image_path is not null then null else mt.image_url end,
    updated_at = now()
from public.monster_instances mi
join public.monster_templates mt on mt.id = mi.template_id
where t.type = 'MONSTER'
  and t.reference_id = mi.id
  and (
    t.image_path is distinct from mt.image_path
    or (
      mt.image_path is not null
      and t.image_url is not null
    )
  );

-- Signed URLs are temporary and should never be treated as permanent template data.
update public.npc_templates
set image_url = null,
    updated_at = now()
where image_path is not null
  and image_url is not null;

update public.monster_templates
set image_url = null,
    updated_at = now()
where image_path is not null
  and image_url is not null;

create or replace function private.sync_npc_template_portrait_to_tokens()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.image_path is distinct from old.image_path
     or new.image_url is distinct from old.image_url then
    update public.tokens
    set image_path = new.image_path,
        image_url = case when new.image_path is not null then null else new.image_url end,
        updated_at = now()
    where type = 'NPC'
      and reference_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_npc_template_portrait_tokens on public.npc_templates;
create trigger sync_npc_template_portrait_tokens
after update of image_path,image_url on public.npc_templates
for each row execute function private.sync_npc_template_portrait_to_tokens();

create or replace function private.sync_monster_template_portrait_to_tokens()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.image_path is distinct from old.image_path
     or new.image_url is distinct from old.image_url then
    update public.tokens t
    set image_path = new.image_path,
        image_url = case when new.image_path is not null then null else new.image_url end,
        updated_at = now()
    from public.monster_instances mi
    where t.type = 'MONSTER'
      and t.reference_id = mi.id
      and mi.template_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_monster_template_portrait_tokens on public.monster_templates;
create trigger sync_monster_template_portrait_tokens
after update of image_path,image_url on public.monster_templates
for each row execute function private.sync_monster_template_portrait_to_tokens();

revoke execute on function private.sync_npc_template_portrait_to_tokens() from public,anon,authenticated;
revoke execute on function private.sync_monster_template_portrait_to_tokens() from public,anon,authenticated;

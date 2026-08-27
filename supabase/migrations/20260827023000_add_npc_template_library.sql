create table if not exists public.npc_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  image_url text,
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.npc_templates enable row level security;

drop policy if exists npc_templates_dm_library on public.npc_templates;
create policy npc_templates_dm_library
on public.npc_templates
for all to authenticated
using ((select private.has_any_campaign_dm_role()))
with check ((select private.has_any_campaign_dm_role()));

grant select, insert, update, delete on public.npc_templates to authenticated;
revoke all on public.npc_templates from anon;

create or replace function public.place_npc_token(
  p_scene_id uuid,
  p_template_id uuid,
  p_x numeric,
  p_y numeric
)
returns public.tokens
language plpgsql
security definer
set search_path=''
as $$
declare
  v_campaign_id uuid;
  v_template public.npc_templates;
  v_token public.tokens;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  select campaign_id into v_campaign_id
  from public.scenes
  where id = p_scene_id;

  if v_campaign_id is null
     or not (select private.has_campaign_role(v_campaign_id,array['OWNER','DM'])) then
    raise exception 'DM permission required';
  end if;

  select * into v_template
  from public.npc_templates
  where id = p_template_id;

  if v_template.id is null then
    raise exception 'NPC template not found';
  end if;

  insert into public.tokens(
    scene_id,reference_id,owner_user_id,type,display_name,image_url,image_path,
    x,y,size,rotation,visible,locked,conditions
  ) values (
    p_scene_id,v_template.id,null,'NPC',v_template.name,
    v_template.image_url,v_template.image_path,
    p_x,p_y,1,0,true,false,'{}'
  )
  returning * into v_token;

  return v_token;
end $$;

revoke all on function public.place_npc_token(uuid,uuid,numeric,numeric) from public,anon;
grant execute on function public.place_npc_token(uuid,uuid,numeric,numeric) to authenticated;

-- Keep global NPC portraits DM-readable in the library. Once placed, the
-- existing visible-token clause makes that portrait readable to players.
drop policy if exists campaign_assets_allowed_select on storage.objects;
create policy campaign_assets_allowed_select on storage.objects
for select to authenticated
using (
  bucket_id='campaign-assets' and (
    exists(
      select 1 from public.campaign_members cm
      where cm.campaign_id=(storage.foldername(storage.objects.name))[1]::uuid
        and cm.user_id=(select auth.uid())
        and cm.role in ('OWNER','DM')
    )
    or exists(
      select 1 from public.monster_templates mt
      where mt.image_path=storage.objects.name
        and (select private.has_any_campaign_dm_role())
    )
    or exists(
      select 1 from public.npc_templates nt
      where nt.image_path=storage.objects.name
        and (select private.has_any_campaign_dm_role())
    )
    or exists(
      select 1 from public.maps m
      join public.scenes s on s.map_id=m.id
      where m.storage_path=storage.objects.name
        and s.active
        and (select private.is_campaign_member(s.campaign_id))
    )
    or exists(
      select 1 from public.scene_overlays o
      join public.scenes s on s.id=o.scene_id
      where o.storage_path=storage.objects.name
        and o.visible
        and s.active
        and (select private.is_campaign_member(s.campaign_id))
    )
    or exists(
      select 1 from public.characters c
      where c.image_path=storage.objects.name
        and (select private.is_campaign_member(c.campaign_id))
    )
    or exists(
      select 1 from public.tokens t
      join public.scenes s on s.id=t.scene_id
      where t.image_path=storage.objects.name
        and t.visible
        and s.active
        and (select private.is_campaign_member(s.campaign_id))
    )
  )
);

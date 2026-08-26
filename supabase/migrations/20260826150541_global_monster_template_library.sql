-- Templates retain their IDs and are converted in place. Existing campaign
-- instances and encounter members continue referencing the same template rows.
drop trigger if exists sync_monster_templates on public.monster_templates;
drop policy if exists monster_templates_dm_all on public.monster_templates;
drop index if exists public.monster_templates_campaign_id_idx;

-- Placement remains authorized by the scene's campaign; the template itself is
-- now library data and may be selected from any campaign.
create or replace function public.place_monster_token(
  p_scene_id uuid,
  p_template_id uuid,
  p_x numeric,
  p_y numeric
)
returns public.tokens
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign_id uuid;
  v_template public.monster_templates;
  v_instance public.monster_instances;
  v_token public.tokens;
  v_name text;
  v_count integer;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select campaign_id into v_campaign_id from public.scenes where id = p_scene_id;
  if v_campaign_id is null or not (select private.has_campaign_role(v_campaign_id, array['OWNER', 'DM'])) then
    raise exception 'DM permission required';
  end if;
  select * into v_template from public.monster_templates where id = p_template_id;
  if v_template.id is null then raise exception 'Monster template not found'; end if;
  select count(*) into v_count from public.monster_instances where campaign_id = v_campaign_id and template_id = p_template_id;
  v_name := case when v_count = 0 then v_template.name else v_template.name || ' ' || (v_count + 1)::text end;
  insert into public.monster_instances (
    campaign_id, template_id, custom_name, current_hp, max_hp, ac, conditions, visible, notes, dead
  ) values (
    v_campaign_id, v_template.id, v_name, v_template.max_hp, v_template.max_hp,
    v_template.ac, '{}', true, '', false
  ) returning * into v_instance;
  insert into public.tokens (
    scene_id, reference_id, owner_user_id, type, display_name, image_url, image_path,
    x, y, size, rotation, visible, locked, conditions
  ) values (
    p_scene_id, v_instance.id, null, 'MONSTER', v_instance.custom_name,
    v_template.image_url, v_template.image_path, p_x, p_y, 1, 0, true, false, '{}'
  ) returning * into v_token;
  return v_token;
end;
$$;

alter table public.monster_templates drop column campaign_id;

-- The helper lives in the unexposed schema and checks the signed-in user,
-- allowing a global DM library without granting any player template access.
create or replace function private.has_any_campaign_dm_role()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.campaign_members cm
    where cm.user_id = (select auth.uid())
      and cm.role in ('OWNER', 'DM')
  )
$$;

revoke all on function private.has_any_campaign_dm_role() from public, anon, authenticated;
grant execute on function private.has_any_campaign_dm_role() to authenticated;

create policy monster_templates_dm_library
on public.monster_templates
for all to authenticated
using ((select private.has_any_campaign_dm_role()))
with check ((select private.has_any_campaign_dm_role()));

-- Global template edits are library-wide; they are not campaign state and do
-- not emit campaign sync rows. A normal reload reflects library changes.

-- Global template portraits are available to DMs only. Visible placed-token
-- images remain separately available to authorized campaign members.
drop policy if exists campaign_assets_allowed_select on storage.objects;
create policy campaign_assets_allowed_select on storage.objects
for select to authenticated
using (
  bucket_id = 'campaign-assets' and (
    exists(select 1 from public.campaign_members cm where cm.campaign_id = (storage.foldername(storage.objects.name))[1]::uuid and cm.user_id = (select auth.uid()) and cm.role in ('OWNER','DM'))
    or exists(select 1 from public.monster_templates mt where mt.image_path = storage.objects.name and (select private.has_any_campaign_dm_role()))
    or exists(select 1 from public.maps m join public.scenes s on s.map_id = m.id where m.storage_path = storage.objects.name and s.active and (select private.is_campaign_member(s.campaign_id)))
    or exists(select 1 from public.scene_overlays o join public.scenes s on s.id = o.scene_id where o.storage_path = storage.objects.name and o.visible and s.active and (select private.is_campaign_member(s.campaign_id)))
    or exists(select 1 from public.characters c where c.image_path = storage.objects.name and (select private.is_campaign_member(c.campaign_id)))
    or exists(select 1 from public.tokens t join public.scenes s on s.id = t.scene_id where t.image_path = storage.objects.name and t.visible and s.active and (select private.is_campaign_member(s.campaign_id)))
  )
);



-- Persist storage paths separately from signed display URLs so image-backed
-- characters, templates, and tokens remain usable after a signed URL expires.
alter table public.characters add column if not exists image_path text;
alter table public.monster_templates add column if not exists image_path text;
alter table public.tokens add column if not exists image_path text;

drop view if exists public.characters_public;
create view public.characters_public with (security_invoker = true) as
select id, campaign_id, owner_id, name, image_url, image_path, current_hp, max_hp,
  ac, speed, passive_perception, passive_investigation, passive_insight,
  conditions, created_at, updated_at
from public.characters;

-- Placement stays server-authorized: a DM may place a character in a scene in
-- its campaign and the character's assigned user becomes the token owner.
create or replace function public.place_character_token(
  p_scene_id uuid,
  p_character_id uuid,
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
  v_character public.characters;
  v_token public.tokens;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select campaign_id into v_campaign_id from public.scenes where id = p_scene_id;
  if v_campaign_id is null or not (select private.has_campaign_role(v_campaign_id, array['OWNER', 'DM'])) then
    raise exception 'DM permission required';
  end if;
  select * into v_character from public.characters where id = p_character_id and campaign_id = v_campaign_id;
  if v_character.id is null then raise exception 'Character not found in this campaign'; end if;
  insert into public.tokens (
    scene_id, reference_id, owner_user_id, type, display_name, image_url, image_path,
    x, y, size, rotation, visible, locked, conditions
  ) values (
    p_scene_id, v_character.id, v_character.owner_id, 'PLAYER', v_character.name,
    v_character.image_url, v_character.image_path, p_x, p_y, 1, 0, true, false,
    v_character.conditions
  ) returning * into v_token;
  return v_token;
end;
$$;

-- A placed monster gets independent state while inheriting its template image
-- as the token's initial image. The token can still be overridden later.
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
  select * into v_template from public.monster_templates where id = p_template_id and campaign_id = v_campaign_id;
  if v_template.id is null then raise exception 'Monster template not found in this campaign'; end if;
  select count(*) into v_count from public.monster_instances where template_id = p_template_id;
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

revoke execute on function public.place_character_token(uuid, uuid, numeric, numeric) from public, anon;
revoke execute on function public.place_monster_token(uuid, uuid, numeric, numeric) from public, anon;
grant execute on function public.place_character_token(uuid, uuid, numeric, numeric) to authenticated;
grant execute on function public.place_monster_token(uuid, uuid, numeric, numeric) to authenticated;

-- Visible character and token images are safe for campaign members; unplaced
-- template assets remain DM-only. Existing map/overlay access remains intact.
drop policy if exists campaign_assets_allowed_select on storage.objects;
create policy campaign_assets_allowed_select on storage.objects
for select to authenticated
using (
  bucket_id = 'campaign-assets' and (
    exists(select 1 from public.campaign_members cm where cm.campaign_id = (storage.foldername(storage.objects.name))[1]::uuid and cm.user_id = (select auth.uid()) and cm.role in ('OWNER','DM'))
    or exists(select 1 from public.maps m join public.scenes s on s.map_id = m.id where m.storage_path = storage.objects.name and s.active and (select private.is_campaign_member(s.campaign_id)))
    or exists(select 1 from public.scene_overlays o join public.scenes s on s.id = o.scene_id where o.storage_path = storage.objects.name and o.visible and s.active and (select private.is_campaign_member(s.campaign_id)))
    or exists(select 1 from public.characters c where c.image_path = storage.objects.name and (select private.is_campaign_member(c.campaign_id)))
    or exists(select 1 from public.tokens t join public.scenes s on s.id = t.scene_id where t.image_path = storage.objects.name and t.visible and s.active and (select private.is_campaign_member(s.campaign_id)))
  )
);

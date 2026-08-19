-- Dedicated scene-prep state. Existing live scenes stay visible to players.
alter table public.scenes
  add column revealed boolean not null default true,
  add column map_x numeric not null default 0,
  add column map_y numeric not null default 0,
  add column map_scale numeric not null default 1 check (map_scale between 0.1 and 4),
  add column grid_offset_x numeric not null default 0,
  add column grid_offset_y numeric not null default 0,
  add column lighting text not null default 'BRIGHT' check (lighting in ('BRIGHT','DIM','DARK')),
  add column player_camera_x numeric,
  add column player_camera_y numeric,
  add column player_camera_zoom numeric not null default 1 check (player_camera_zoom between 0.25 and 3);

-- A player can only read the currently live scene after the DM reveals it.
drop policy if exists scenes_member_active_select on public.scenes;
create policy scenes_member_active_revealed_select on public.scenes for select to authenticated
using ((select private.has_campaign_role(campaign_id,array['OWNER','DM'])) or (active and revealed and (select private.is_campaign_member(campaign_id))));

drop policy if exists maps_member_active_select on public.maps;
create policy maps_member_active_revealed_select on public.maps for select to authenticated
using ((select private.has_campaign_role(campaign_id,array['OWNER','DM'])) or exists(select 1 from public.scenes s where s.map_id=maps.id and s.active and s.revealed and (select private.is_campaign_member(s.campaign_id))));

drop policy if exists overlays_member_visible_select on public.scene_overlays;
create policy overlays_member_visible_active_revealed_select on public.scene_overlays for select to authenticated
using (exists(select 1 from public.scenes s where s.id=scene_id and ((select private.has_campaign_role(s.campaign_id,array['OWNER','DM'])) or (visible and s.active and s.revealed and (select private.is_campaign_member(s.campaign_id))))));

drop policy if exists tokens_member_visible_select on public.tokens;
create policy tokens_member_visible_active_revealed_select on public.tokens for select to authenticated
using (exists(select 1 from public.scenes s where s.id=scene_id and ((select private.has_campaign_role(s.campaign_id,array['OWNER','DM'])) or (tokens.visible and s.active and s.revealed and (select private.is_campaign_member(s.campaign_id))))));

drop policy if exists fog_member_select on public.fog_regions;
create policy fog_member_active_revealed_select on public.fog_regions for select to authenticated
using (exists(select 1 from public.scenes s where s.id=scene_id and ((select private.has_campaign_role(s.campaign_id,array['OWNER','DM'])) or (s.active and s.revealed and (select private.is_campaign_member(s.campaign_id))))));

-- Switch the live scene atomically so player clients never observe a gap with no active scene.
create or replace function public.make_scene_live(p_scene_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_campaign_id uuid;
begin
  select campaign_id into v_campaign_id from public.scenes where id=p_scene_id for update;
  if v_campaign_id is null then raise exception 'Scene not found'; end if;
  if not (select private.has_campaign_role(v_campaign_id,array['OWNER','DM'])) then raise exception 'DM permission required'; end if;
  update public.scenes set active=false,updated_at=now() where campaign_id=v_campaign_id and active;
  update public.scenes set active=true,updated_at=now() where id=p_scene_id;
end $$;
revoke all on function public.make_scene_live(uuid) from public;
grant execute on function public.make_scene_live(uuid) to authenticated;

-- Scene changes use the existing campaign realtime stream.
drop trigger if exists sync_scenes on public.scenes;
create trigger sync_scenes after insert or update or delete on public.scenes for each row execute function private.emit_campaign_sync();

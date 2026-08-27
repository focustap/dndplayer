-- `NEW`/`OLD` are generic records in trigger functions.  Some synced tables
-- (notably token_motion_segments and token_interactions) use token_id as
-- their primary key rather than an id column, so access them through JSONB.
create or replace function private.emit_scene_sync()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_row jsonb;
  v_scene_id uuid;
  v_campaign_id uuid;
  v_entity_id uuid;
begin
  v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_scene_id := nullif(v_row ->> 'scene_id', '')::uuid;
  v_entity_id := coalesce(
    nullif(v_row ->> 'id', '')::uuid,
    nullif(v_row ->> 'token_id', '')::uuid
  );

  select campaign_id into v_campaign_id from public.scenes where id = v_scene_id;
  if v_campaign_id is null then
    raise exception 'Unable to resolve campaign for % sync event', tg_table_name;
  end if;

  insert into public.sync_events(campaign_id,event_type,entity_id)
  values(v_campaign_id,tg_table_name,v_entity_id);
  return coalesce(new,old);
end $$;

-- token_interactions is also keyed by token_id.  Keep campaign-scoped sync
-- equally safe so enabling an NPC interaction cannot fail for the same reason.
create or replace function private.emit_campaign_sync()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_row jsonb;
  v_campaign_id uuid;
  v_entity_id uuid;
begin
  v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_campaign_id := nullif(v_row ->> 'campaign_id', '')::uuid;
  v_entity_id := coalesce(
    nullif(v_row ->> 'id', '')::uuid,
    nullif(v_row ->> 'token_id', '')::uuid
  );

  if v_campaign_id is null then
    raise exception 'Unable to resolve campaign for % sync event', tg_table_name;
  end if;

  insert into public.sync_events(campaign_id,event_type,entity_id)
  values(v_campaign_id,tg_table_name,v_entity_id);
  return coalesce(new,old);
end $$;

-- Recreate the checkpoint RPC here as a drift-safe repair.  The original
-- migration remains the source migration; this ensures installations that
-- skipped it receive the required function when this repair is deployed.
create or replace function public.checkpoint_token_patrol(
  p_patrol_id uuid,
  p_x numeric,
  p_y numeric,
  p_current_waypoint integer,
  p_direction smallint,
  p_active boolean
)
returns public.token_patrols
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_patrol public.token_patrols;
  v_token public.tokens;
  v_campaign_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;
  if p_direction not in (-1, 1) or p_current_waypoint < 0 then
    raise exception 'Invalid patrol checkpoint';
  end if;

  select * into v_patrol from public.token_patrols where id = p_patrol_id for update;
  if v_patrol.id is null then
    raise exception 'Patrol not found';
  end if;

  select t.* into v_token
  from public.tokens t
  where t.id = v_patrol.token_id and t.scene_id = v_patrol.scene_id
  for update of t;
  if v_token.id is null or v_token.type not in ('MONSTER', 'NPC') then
    raise exception 'Patrol token is invalid';
  end if;

  select campaign_id into v_campaign_id from public.scenes where id = v_patrol.scene_id;
  if not (select private.has_campaign_role(v_campaign_id, array['OWNER', 'DM'])) then
    raise exception 'DM permission required';
  end if;

  -- Token and patrol checkpoint state are written in one transaction, so a
  -- sync event can never observe a half-completed checkpoint.
  update public.tokens set x = p_x, y = p_y, updated_at = now() where id = v_token.id;
  update public.token_patrols
  set current_waypoint = p_current_waypoint,
      direction = p_direction,
      active = p_active,
      updated_at = now()
  where id = v_patrol.id
  returning * into v_patrol;
  return v_patrol;
end $$;

revoke all on function public.checkpoint_token_patrol(uuid,numeric,numeric,integer,smallint,boolean) from public,anon;
grant execute on function public.checkpoint_token_patrol(uuid,numeric,numeric,integer,smallint,boolean) to authenticated;

-- Reassert the segment starter with an explicit authenticated OWNER/DM check.
-- Its single upsert creates exactly one active, server-timestamped segment.
create or replace function public.start_token_motion_segment(
  p_patrol_id uuid,
  p_from_x numeric,
  p_from_y numeric,
  p_to_x numeric,
  p_to_y numeric,
  p_duration_ms integer
)
returns public.token_motion_segments
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_patrol public.token_patrols;
  v_token public.tokens;
  v_segment public.token_motion_segments;
  v_campaign_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;
  if p_duration_ms <= 0 then
    raise exception 'Motion segment duration must be positive';
  end if;

  select * into v_patrol from public.token_patrols where id = p_patrol_id for update;
  if v_patrol.id is null or not v_patrol.active then
    raise exception 'Active patrol not found';
  end if;
  select t.* into v_token
  from public.tokens t
  where t.id = v_patrol.token_id and t.scene_id = v_patrol.scene_id
  for update of t;
  select campaign_id into v_campaign_id from public.scenes where id = v_patrol.scene_id;
  if v_token.id is null
    or v_token.type not in ('MONSTER', 'NPC')
    or not (select private.has_campaign_role(v_campaign_id, array['OWNER', 'DM'])) then
    raise exception 'DM permission required';
  end if;

  insert into public.token_motion_segments(
    token_id,scene_id,from_x,from_y,to_x,to_y,started_at,duration_ms,revision,active
  ) values (
    v_token.id,v_patrol.scene_id,p_from_x,p_from_y,p_to_x,p_to_y,now(),p_duration_ms,
    coalesce((select revision + 1 from public.token_motion_segments where token_id = v_token.id), 1),true
  ) on conflict (token_id) do update set
    from_x = excluded.from_x,
    from_y = excluded.from_y,
    to_x = excluded.to_x,
    to_y = excluded.to_y,
    started_at = excluded.started_at,
    duration_ms = excluded.duration_ms,
    revision = public.token_motion_segments.revision + 1,
    active = true,
    updated_at = now()
  returning * into v_segment;
  return v_segment;
end $$;

revoke all on function public.start_token_motion_segment(uuid,numeric,numeric,numeric,numeric,integer) from public,anon;
grant execute on function public.start_token_motion_segment(uuid,numeric,numeric,numeric,numeric,integer) to authenticated;

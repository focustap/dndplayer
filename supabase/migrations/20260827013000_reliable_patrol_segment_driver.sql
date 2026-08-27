-- Make patrol segment progression idempotent so it does not depend on a
-- fragile client-side Presence leader. Multiple DM tabs may safely call these
-- functions; row locks and revision checks ensure only one transition wins.

create or replace function public.ensure_token_patrol_segment(p_patrol_id uuid)
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
  v_target jsonb;
  v_target_x numeric;
  v_target_y numeric;
  v_duration_ms integer;
  v_count integer;
  v_revision bigint;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  select * into v_patrol
  from public.token_patrols
  where id = p_patrol_id
  for update;

  if v_patrol.id is null or not v_patrol.active then
    raise exception 'Active patrol not found';
  end if;

  v_count := jsonb_array_length(v_patrol.waypoints);
  if v_count < 2 then
    raise exception 'Patrol needs at least two waypoints';
  end if;

  select t.* into v_token
  from public.tokens t
  where t.id = v_patrol.token_id and t.scene_id = v_patrol.scene_id
  for update of t;

  select campaign_id into v_campaign_id
  from public.scenes
  where id = v_patrol.scene_id;

  if v_token.id is null
     or v_token.type not in ('MONSTER','NPC')
     or not (select private.has_campaign_role(v_campaign_id,array['OWNER','DM'])) then
    raise exception 'DM permission required';
  end if;

  -- Lock the existing row whether active or inactive. A second DM tab waits
  -- here and then receives the segment created by the first tab.
  select * into v_segment
  from public.token_motion_segments
  where token_id = v_token.id
  for update;

  if v_segment.token_id is not null and v_segment.active then
    return v_segment;
  end if;

  v_target := v_patrol.waypoints -> least(v_patrol.current_waypoint, v_count - 1);
  v_target_x := (v_target ->> 'x')::numeric;
  v_target_y := (v_target ->> 'y')::numeric;
  v_duration_ms := greatest(
    1,
    round(
      sqrt(
        power(v_target_x - v_token.x, 2) +
        power(v_target_y - v_token.y, 2)
      ) / v_patrol.speed * 1000
    )::integer
  );
  v_revision := coalesce(v_segment.revision + 1, 1);

  insert into public.token_motion_segments(
    token_id,scene_id,from_x,from_y,to_x,to_y,
    started_at,duration_ms,revision,active,updated_at
  ) values (
    v_token.id,v_patrol.scene_id,v_token.x,v_token.y,v_target_x,v_target_y,
    now(),v_duration_ms,v_revision,true,now()
  )
  on conflict (token_id) do update set
    scene_id = excluded.scene_id,
    from_x = excluded.from_x,
    from_y = excluded.from_y,
    to_x = excluded.to_x,
    to_y = excluded.to_y,
    started_at = excluded.started_at,
    duration_ms = excluded.duration_ms,
    revision = excluded.revision,
    active = true,
    updated_at = now()
  returning * into v_segment;

  return v_segment;
end $$;

create or replace function public.complete_token_patrol_segment(
  p_patrol_id uuid,
  p_expected_revision bigint
)
returns public.token_patrols
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_patrol public.token_patrols;
  v_token public.tokens;
  v_segment public.token_motion_segments;
  v_campaign_id uuid;
  v_count integer;
  v_next integer;
  v_direction smallint;
  v_active boolean;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  select * into v_patrol
  from public.token_patrols
  where id = p_patrol_id
  for update;

  if v_patrol.id is null then
    raise exception 'Patrol not found';
  end if;

  select t.* into v_token
  from public.tokens t
  where t.id = v_patrol.token_id and t.scene_id = v_patrol.scene_id
  for update of t;

  select campaign_id into v_campaign_id
  from public.scenes
  where id = v_patrol.scene_id;

  if v_token.id is null
     or v_token.type not in ('MONSTER','NPC')
     or not (select private.has_campaign_role(v_campaign_id,array['OWNER','DM'])) then
    raise exception 'DM permission required';
  end if;

  select * into v_segment
  from public.token_motion_segments
  where token_id = v_token.id
  for update;

  -- Another tab already completed/replaced this segment. Treat that as a
  -- successful no-op instead of advancing twice.
  if v_segment.token_id is null
     or not v_segment.active
     or v_segment.revision <> p_expected_revision then
    return v_patrol;
  end if;

  update public.token_motion_segments
  set active = false, updated_at = now()
  where token_id = v_token.id
    and active
    and revision = p_expected_revision;

  update public.tokens
  set x = v_segment.to_x,
      y = v_segment.to_y,
      updated_at = now()
  where id = v_token.id;

  v_count := jsonb_array_length(v_patrol.waypoints);
  v_direction := v_patrol.direction;
  v_next := v_patrol.current_waypoint + v_direction;
  v_active := v_patrol.active;

  if v_next >= v_count or v_next < 0 then
    if v_patrol.mode = 'LOOP' then
      v_next := case when v_direction = 1 then 0 else v_count - 1 end;
    elsif v_patrol.mode = 'PING_PONG' then
      v_direction := case when v_direction = 1 then -1 else 1 end;
      v_next := v_patrol.current_waypoint + v_direction;
    else
      v_next := v_patrol.current_waypoint;
      v_active := false;
    end if;
  end if;

  update public.token_patrols
  set current_waypoint = v_next,
      direction = v_direction,
      active = v_active,
      updated_at = now()
  where id = v_patrol.id
  returning * into v_patrol;

  return v_patrol;
end $$;

revoke all on function public.ensure_token_patrol_segment(uuid) from public,anon;
revoke all on function public.complete_token_patrol_segment(uuid,bigint) from public,anon;
grant execute on function public.ensure_token_patrol_segment(uuid) to authenticated;
grant execute on function public.complete_token_patrol_segment(uuid,bigint) to authenticated;

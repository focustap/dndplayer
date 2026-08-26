create or replace function public.checkpoint_token_patrol(
  p_patrol_id uuid,
  p_x numeric,
  p_y numeric,
  p_current_waypoint integer,
  p_direction smallint,
  p_active boolean
)
returns public.token_patrols
language plpgsql security invoker set search_path=''
as $$
declare
  v_patrol public.token_patrols;
  v_token public.tokens;
  v_campaign_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_direction not in (-1,1) or p_current_waypoint < 0 then raise exception 'Invalid patrol checkpoint'; end if;

  select * into v_patrol from public.token_patrols where id=p_patrol_id for update;
  if v_patrol.id is null then raise exception 'Patrol not found'; end if;
  select t.* into v_token
  from public.tokens t
  where t.id=v_patrol.token_id and t.scene_id=v_patrol.scene_id
  for update of t;
  if v_token.id is null or v_token.type not in ('MONSTER','NPC') then raise exception 'Patrol token is invalid'; end if;
  select campaign_id into v_campaign_id from public.scenes where id=v_patrol.scene_id;
  if not (select private.has_campaign_role(v_campaign_id,array['OWNER','DM'])) then raise exception 'DM permission required'; end if;

  update public.tokens set x=p_x,y=p_y,updated_at=now() where id=v_token.id;
  update public.token_patrols
  set current_waypoint=p_current_waypoint,direction=p_direction,active=p_active,updated_at=now()
  where id=v_patrol.id
  returning * into v_patrol;
  return v_patrol;
end $$;

revoke all on function public.checkpoint_token_patrol(uuid,numeric,numeric,integer,smallint,boolean) from public,anon;
grant execute on function public.checkpoint_token_patrol(uuid,numeric,numeric,integer,smallint,boolean) to authenticated;

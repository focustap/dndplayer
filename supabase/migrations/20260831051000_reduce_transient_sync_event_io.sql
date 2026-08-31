-- Reduce database IO from transient patrol/token movement.
-- Motion segments are already distributed over the dedicated Realtime
-- broadcast path, so they do not need a permanent sync_events history.

drop trigger if exists sync_token_motion_segments on public.token_motion_segments;

create or replace function private.emit_token_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_scene_id uuid;
  v_campaign_id uuid;
begin
  if tg_op = 'UPDATE'
     and (to_jsonb(new) - array['x','y','updated_at'])
       = (to_jsonb(old) - array['x','y','updated_at']) then
    return new;
  end if;

  v_scene_id := coalesce(new.scene_id, old.scene_id);
  select campaign_id into v_campaign_id
  from public.scenes
  where id = v_scene_id;

  insert into public.sync_events(campaign_id, event_type, entity_id)
  values (v_campaign_id, tg_table_name, coalesce(new.id, old.id));

  return coalesce(new, old);
end
$$;

drop trigger if exists sync_tokens on public.tokens;
create trigger sync_tokens
after insert or update or delete on public.tokens
for each row execute function private.emit_token_sync();

create or replace function private.emit_token_patrol_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_scene_id uuid;
  v_campaign_id uuid;
begin
  if tg_op = 'UPDATE'
     and (to_jsonb(new) - array['current_waypoint','direction','updated_at'])
       = (to_jsonb(old) - array['current_waypoint','direction','updated_at']) then
    return new;
  end if;

  v_scene_id := coalesce(new.scene_id, old.scene_id);
  select campaign_id into v_campaign_id
  from public.scenes
  where id = v_scene_id;

  insert into public.sync_events(campaign_id, event_type, entity_id)
  values (v_campaign_id, tg_table_name, coalesce(new.id, old.id));

  return coalesce(new, old);
end
$$;

drop trigger if exists sync_token_patrols on public.token_patrols;
create trigger sync_token_patrols
after insert or update or delete on public.token_patrols
for each row execute function private.emit_token_patrol_sync();

truncate table public.sync_events restart identity;

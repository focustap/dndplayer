create table public.token_patrols (
  id uuid primary key default gen_random_uuid(),
  token_id uuid not null unique references public.tokens(id) on delete cascade,
  scene_id uuid not null references public.scenes(id) on delete cascade,
  mode text not null default 'LOOP' check (mode in ('LOOP','PING_PONG','ONCE')),
  active boolean not null default false,
  speed numeric not null default 105 check (speed > 0 and speed <= 1000),
  waypoint_pause_ms integer not null default 600 check (waypoint_pause_ms >= 0 and waypoint_pause_ms <= 60000),
  pause_during_combat boolean not null default true,
  current_waypoint integer not null default 0 check (current_waypoint >= 0),
  direction smallint not null default 1 check (direction in (-1,1)),
  waypoints jsonb not null default '[]'::jsonb check (jsonb_typeof(waypoints) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index token_patrols_scene_id_idx on public.token_patrols(scene_id);
alter table public.token_patrols enable row level security;
revoke all on public.token_patrols from anon, authenticated;
grant select, insert, update, delete on public.token_patrols to authenticated;

create policy token_patrols_dm_all on public.token_patrols for all to authenticated
using (exists(
  select 1 from public.tokens t join public.scenes s on s.id=t.scene_id
  where t.id=token_id and t.scene_id=token_patrols.scene_id
    and (select private.has_campaign_role(s.campaign_id,array['OWNER','DM']))
))
with check (exists(
  select 1 from public.tokens t join public.scenes s on s.id=t.scene_id
  where t.id=token_id and t.scene_id=token_patrols.scene_id
    and t.type in ('MONSTER','NPC')
    and (select private.has_campaign_role(s.campaign_id,array['OWNER','DM']))
));

create or replace function private.set_token_patrol_updated_at()
returns trigger language plpgsql security invoker set search_path=''
as $$ begin new.updated_at=now(); return new; end $$;

create trigger set_token_patrols_updated_at before update on public.token_patrols
for each row execute function private.set_token_patrol_updated_at();
create trigger sync_token_patrols after insert or update or delete on public.token_patrols
for each row execute function private.emit_scene_sync();

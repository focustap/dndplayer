-- Signature combat animations plus persistent floor-zone markers.

alter table public.tabletop_animation_events
  drop constraint if exists tabletop_animation_events_preset_check;

alter table public.tabletop_animation_events
  add constraint tabletop_animation_events_preset_check
  check (preset in ('MELEE','RANGED','SPELL','SNEAK_ATTACK','SMITE','DRUID','WIZARD'));

alter table public.tabletop_animation_events
  add column if not exists color text;

create table if not exists public.scene_zone_markers (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  scene_id uuid not null references public.scenes(id) on delete cascade,
  label text not null default 'Effect',
  x numeric not null default 0,
  y numeric not null default 0,
  radius_ft numeric not null default 15 check (radius_ft > 0 and radius_ft <= 300),
  color text not null default '#6b5cff',
  opacity numeric not null default .28 check (opacity >= .05 and opacity <= .9),
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists scene_zone_markers_scene_idx
on public.scene_zone_markers(scene_id,created_at);

alter table public.scene_zone_markers enable row level security;

drop policy if exists scene_zone_markers_select on public.scene_zone_markers;
create policy scene_zone_markers_select
on public.scene_zone_markers
for select to authenticated
using (
  (select private.has_campaign_role(campaign_id,array['OWNER','DM']))
  or (
    visible
    and (select private.is_campaign_member(campaign_id))
    and exists (
      select 1 from public.scenes s
      where s.id=scene_id and s.campaign_id=campaign_id and s.active and s.revealed
    )
  )
);

drop policy if exists scene_zone_markers_dm_insert on public.scene_zone_markers;
create policy scene_zone_markers_dm_insert
on public.scene_zone_markers
for insert to authenticated
with check (
  (select private.has_campaign_role(campaign_id,array['OWNER','DM']))
  and exists(select 1 from public.scenes s where s.id=scene_id and s.campaign_id=campaign_id)
);

drop policy if exists scene_zone_markers_dm_update on public.scene_zone_markers;
create policy scene_zone_markers_dm_update
on public.scene_zone_markers
for update to authenticated
using ((select private.has_campaign_role(campaign_id,array['OWNER','DM'])))
with check ((select private.has_campaign_role(campaign_id,array['OWNER','DM'])));

drop policy if exists scene_zone_markers_dm_delete on public.scene_zone_markers;
create policy scene_zone_markers_dm_delete
on public.scene_zone_markers
for delete to authenticated
using ((select private.has_campaign_role(campaign_id,array['OWNER','DM'])));

grant select,insert,update,delete on public.scene_zone_markers to authenticated;

drop trigger if exists sync_scene_zone_markers on public.scene_zone_markers;
create trigger sync_scene_zone_markers
after insert or update or delete on public.scene_zone_markers
for each row execute function private.emit_campaign_sync();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='scene_zone_markers'
  ) then
    alter publication supabase_realtime add table public.scene_zone_markers;
  end if;
end $$;

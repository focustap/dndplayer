create table public.scene_discoverables (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  scene_id uuid not null references public.scenes(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  storage_path text not null,
  x numeric not null,
  y numeric not null,
  hidden boolean not null default true,
  discovered_at timestamptz,
  discovered_by uuid references public.profiles(id) on delete set null,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index scene_discoverables_scene_idx on public.scene_discoverables(scene_id);
create index scene_discoverables_campaign_discovered_idx on public.scene_discoverables(campaign_id, discovered_at) where discovered_at is not null;
alter table public.scene_discoverables enable row level security;
revoke all on public.scene_discoverables from anon, authenticated;
grant select, insert, update, delete on public.scene_discoverables to authenticated;

create policy scene_discoverables_select on public.scene_discoverables for select to authenticated
using (
  (select private.has_campaign_role(campaign_id,array['OWNER','DM']))
  or ((select private.is_campaign_member(campaign_id)) and (
    discovered_at is not null
    or (not hidden and exists(select 1 from public.scenes s where s.id=scene_id and s.active and s.revealed))
  ))
);
create policy scene_discoverables_dm_insert on public.scene_discoverables for insert to authenticated
with check (created_by=(select auth.uid()) and (select private.has_campaign_role(campaign_id,array['OWNER','DM'])) and exists(select 1 from public.scenes s where s.id=scene_id and s.campaign_id=scene_discoverables.campaign_id));
create policy scene_discoverables_dm_update on public.scene_discoverables for update to authenticated
using ((select private.has_campaign_role(campaign_id,array['OWNER','DM'])))
with check ((select private.has_campaign_role(campaign_id,array['OWNER','DM'])) and exists(select 1 from public.scenes s where s.id=scene_id and s.campaign_id=scene_discoverables.campaign_id));
create policy scene_discoverables_dm_delete on public.scene_discoverables for delete to authenticated
using ((select private.has_campaign_role(campaign_id,array['OWNER','DM'])));

-- Atomic first-discovery gate. The row lock means only one concurrent click can
-- transition the item and emit its transient global reveal event.
create table public.tabletop_discovery_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  discoverable_id uuid not null references public.scene_discoverables(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.tabletop_discovery_events enable row level security;
revoke all on public.tabletop_discovery_events from anon, authenticated;
grant select on public.tabletop_discovery_events to authenticated;
create policy tabletop_discovery_events_member_select on public.tabletop_discovery_events for select to authenticated using ((select private.is_campaign_member(campaign_id)));

create or replace function public.discover_scene_discoverable(p_discoverable_id uuid)
returns public.scene_discoverables language plpgsql security definer set search_path=''
as $$
declare v_item public.scene_discoverables;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select * into v_item from public.scene_discoverables where id=p_discoverable_id for update;
  if v_item.id is null then raise exception 'Discoverable not found'; end if;
  if not (select private.is_campaign_member(v_item.campaign_id)) then raise exception 'Campaign membership required'; end if;
  if v_item.discovered_at is not null then return v_item; end if;
  if v_item.hidden or not exists(select 1 from public.scenes s where s.id=v_item.scene_id and s.campaign_id=v_item.campaign_id and s.active and s.revealed) then raise exception 'This discoverable is not available'; end if;
  update public.scene_discoverables set discovered_at=now(), discovered_by=(select auth.uid()), updated_at=now() where id=v_item.id returning * into v_item;
  insert into public.tabletop_discovery_events(campaign_id,discoverable_id) values(v_item.campaign_id,v_item.id);
  return v_item;
end $$;
revoke all on function public.discover_scene_discoverable(uuid) from public,anon;
grant execute on function public.discover_scene_discoverable(uuid) to authenticated;

create trigger sync_scene_discoverables after insert or update or delete on public.scene_discoverables for each row execute function private.emit_campaign_sync();

drop policy if exists campaign_assets_allowed_select on storage.objects;
create policy campaign_assets_allowed_select on storage.objects for select to authenticated using (
  bucket_id='campaign-assets' and (
    exists(select 1 from public.campaign_members cm where cm.campaign_id=(storage.foldername(storage.objects.name))[1]::uuid and cm.user_id=(select auth.uid()) and cm.role in ('OWNER','DM'))
    or exists(select 1 from public.monster_templates mt where mt.image_path=storage.objects.name and (select private.has_any_campaign_dm_role()))
    or exists(select 1 from public.maps m join public.scenes s on s.map_id=m.id where m.storage_path=storage.objects.name and s.active and (select private.is_campaign_member(s.campaign_id)))
    or exists(select 1 from public.scene_overlays o join public.scenes s on s.id=o.scene_id where o.storage_path=storage.objects.name and o.visible and s.active and (select private.is_campaign_member(s.campaign_id)))
    or exists(select 1 from public.characters c where c.image_path=storage.objects.name and (select private.is_campaign_member(c.campaign_id)))
    or exists(select 1 from public.tokens t join public.scenes s on s.id=t.scene_id where t.image_path=storage.objects.name and t.visible and s.active and (select private.is_campaign_member(s.campaign_id)))
    or exists(select 1 from public.scene_discoverables d where d.storage_path=storage.objects.name and d.discovered_at is not null and (select private.is_campaign_member(d.campaign_id)))
  )
);

do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='tabletop_discovery_events') then
    alter publication supabase_realtime add table public.tabletop_discovery_events;
  end if;
end $$;

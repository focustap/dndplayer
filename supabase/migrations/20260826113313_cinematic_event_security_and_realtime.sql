-- Visual-only events are delivered solely through Realtime INSERTs. The
-- tabletop never selects this table on load, preventing old events replaying
-- for users who join a campaign after an effect has completed.
alter table public.tabletop_cinematic_events
  add column campaign_id uuid references public.campaigns(id) on delete cascade,
  add column name text,
  add column duration integer,
  add column steps jsonb not null default '[]'::jsonb,
  add column created_by uuid default auth.uid() references public.profiles(id) on delete restrict,
  add column created_at timestamptz not null default now();

alter table public.tabletop_cinematic_events
  alter column campaign_id set not null,
  alter column name set not null,
  alter column duration set not null,
  alter column created_by set not null,
  add constraint tabletop_cinematic_events_name_check check (char_length(name) between 1 and 120),
  add constraint tabletop_cinematic_events_duration_check check (duration between 100 and 30000),
  add constraint tabletop_cinematic_events_steps_check check (jsonb_typeof(steps) = 'array');

create index tabletop_cinematic_events_campaign_created_idx
  on public.tabletop_cinematic_events(campaign_id, created_at desc);

alter table public.tabletop_cinematic_events enable row level security;

create policy tabletop_cinematic_events_member_select
on public.tabletop_cinematic_events
for select to authenticated
using ((select private.is_campaign_member(campaign_id)));

create policy tabletop_cinematic_events_dm_insert
on public.tabletop_cinematic_events
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.campaign_members cm
    where cm.campaign_id = tabletop_cinematic_events.campaign_id
      and cm.user_id = (select auth.uid())
      and cm.role in ('OWNER', 'DM')
  )
);

revoke all on public.tabletop_cinematic_events from anon, authenticated;
grant select, insert on public.tabletop_cinematic_events to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tabletop_cinematic_events'
  ) then
    alter publication supabase_realtime add table public.tabletop_cinematic_events;
  end if;
end $$;

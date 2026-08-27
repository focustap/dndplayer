-- Live campaign music library + synchronized playback state.
create table public.campaign_audio_tracks (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  name text not null,
  storage_path text not null unique,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint campaign_audio_tracks_name_check check (char_length(name) between 1 and 160)
);

create index campaign_audio_tracks_campaign_name_idx
  on public.campaign_audio_tracks(campaign_id, name);

create table public.campaign_audio_state (
  campaign_id uuid primary key references public.campaigns(id) on delete cascade,
  track_id uuid references public.campaign_audio_tracks(id) on delete set null,
  playing boolean not null default false,
  loop boolean not null default true,
  position_ms bigint not null default 0,
  started_at timestamptz,
  revision bigint not null default 0,
  updated_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  constraint campaign_audio_state_position_check check (position_ms >= 0)
);

alter table public.campaign_audio_tracks enable row level security;
alter table public.campaign_audio_state enable row level security;

create policy campaign_audio_tracks_member_select
on public.campaign_audio_tracks
for select to authenticated
using ((select private.is_campaign_member(campaign_id)));

create policy campaign_audio_tracks_dm_insert
on public.campaign_audio_tracks
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.campaign_members cm
    where cm.campaign_id = campaign_audio_tracks.campaign_id
      and cm.user_id = (select auth.uid())
      and cm.role in ('OWNER', 'DM')
  )
);

create policy campaign_audio_tracks_dm_update
on public.campaign_audio_tracks
for update to authenticated
using (
  exists (
    select 1 from public.campaign_members cm
    where cm.campaign_id = campaign_audio_tracks.campaign_id
      and cm.user_id = (select auth.uid())
      and cm.role in ('OWNER', 'DM')
  )
)
with check (
  exists (
    select 1 from public.campaign_members cm
    where cm.campaign_id = campaign_audio_tracks.campaign_id
      and cm.user_id = (select auth.uid())
      and cm.role in ('OWNER', 'DM')
  )
);

create policy campaign_audio_tracks_dm_delete
on public.campaign_audio_tracks
for delete to authenticated
using (
  exists (
    select 1 from public.campaign_members cm
    where cm.campaign_id = campaign_audio_tracks.campaign_id
      and cm.user_id = (select auth.uid())
      and cm.role in ('OWNER', 'DM')
  )
);

create policy campaign_audio_state_member_select
on public.campaign_audio_state
for select to authenticated
using ((select private.is_campaign_member(campaign_id)));

revoke all on public.campaign_audio_tracks from anon, authenticated;
revoke all on public.campaign_audio_state from anon, authenticated;
grant select, insert, update, delete on public.campaign_audio_tracks to authenticated;
grant select on public.campaign_audio_state to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'campaign-audio',
  'campaign-audio',
  false,
  52428800,
  array['audio/mpeg','audio/mp3']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy campaign_audio_member_select
on storage.objects
for select to authenticated
using (
  bucket_id = 'campaign-audio'
  and (select private.is_campaign_member(((storage.foldername(storage.objects.name))[1])::uuid))
);

create policy campaign_audio_dm_insert
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'campaign-audio'
  and exists (
    select 1 from public.campaign_members cm
    where cm.campaign_id = ((storage.foldername(storage.objects.name))[1])::uuid
      and cm.user_id = (select auth.uid())
      and cm.role in ('OWNER', 'DM')
  )
);

create policy campaign_audio_dm_update
on storage.objects
for update to authenticated
using (
  bucket_id = 'campaign-audio'
  and exists (
    select 1 from public.campaign_members cm
    where cm.campaign_id = ((storage.foldername(storage.objects.name))[1])::uuid
      and cm.user_id = (select auth.uid())
      and cm.role in ('OWNER', 'DM')
  )
)
with check (
  bucket_id = 'campaign-audio'
  and exists (
    select 1 from public.campaign_members cm
    where cm.campaign_id = ((storage.foldername(storage.objects.name))[1])::uuid
      and cm.user_id = (select auth.uid())
      and cm.role in ('OWNER', 'DM')
  )
);

create policy campaign_audio_dm_delete
on storage.objects
for delete to authenticated
using (
  bucket_id = 'campaign-audio'
  and exists (
    select 1 from public.campaign_members cm
    where cm.campaign_id = ((storage.foldername(storage.objects.name))[1])::uuid
      and cm.user_id = (select auth.uid())
      and cm.role in ('OWNER', 'DM')
  )
);

create or replace function public.control_campaign_audio(
  p_campaign_id uuid,
  p_action text,
  p_track_id uuid default null,
  p_loop boolean default null
)
returns public.campaign_audio_state
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state public.campaign_audio_state;
  v_position bigint;
  v_action text := upper(trim(p_action));
  v_now timestamptz := clock_timestamp();
  v_target_track uuid;
begin
  if not exists (
    select 1
    from public.campaign_members cm
    where cm.campaign_id = p_campaign_id
      and cm.user_id = (select auth.uid())
      and cm.role in ('OWNER', 'DM')
  ) then
    raise exception 'Only a campaign DM can control music.';
  end if;

  insert into public.campaign_audio_state(campaign_id, updated_by)
  values (p_campaign_id, (select auth.uid()))
  on conflict (campaign_id) do nothing;

  select *
  into v_state
  from public.campaign_audio_state
  where campaign_id = p_campaign_id
  for update;

  v_position := v_state.position_ms;
  if v_state.playing and v_state.started_at is not null then
    v_position := greatest(
      0,
      v_position + round(extract(epoch from (v_now - v_state.started_at)) * 1000)::bigint
    );
  end if;

  if v_action = 'PLAY' then
    v_target_track := coalesce(p_track_id, v_state.track_id);
    if v_target_track is null then
      raise exception 'Choose a track before playing.';
    end if;
    if not exists (
      select 1
      from public.campaign_audio_tracks t
      where t.id = v_target_track
        and t.campaign_id = p_campaign_id
    ) then
      raise exception 'That track does not belong to this campaign.';
    end if;

    if p_track_id is not null and p_track_id is distinct from v_state.track_id then
      v_position := 0;
    end if;

    update public.campaign_audio_state
    set track_id = v_target_track,
        playing = true,
        loop = coalesce(p_loop, loop),
        position_ms = v_position,
        started_at = v_now,
        revision = revision + 1,
        updated_by = (select auth.uid()),
        updated_at = v_now
    where campaign_id = p_campaign_id;

  elsif v_action = 'PAUSE' then
    update public.campaign_audio_state
    set playing = false,
        position_ms = v_position,
        started_at = null,
        revision = revision + 1,
        updated_by = (select auth.uid()),
        updated_at = v_now
    where campaign_id = p_campaign_id;

  elsif v_action = 'STOP' then
    update public.campaign_audio_state
    set playing = false,
        position_ms = 0,
        started_at = null,
        revision = revision + 1,
        updated_by = (select auth.uid()),
        updated_at = v_now
    where campaign_id = p_campaign_id;

  elsif v_action = 'LOOP' then
    if p_loop is null then
      raise exception 'Loop state is required.';
    end if;
    update public.campaign_audio_state
    set loop = p_loop,
        revision = revision + 1,
        updated_by = (select auth.uid()),
        updated_at = v_now
    where campaign_id = p_campaign_id;

  else
    raise exception 'Unsupported audio action: %', p_action;
  end if;

  select *
  into v_state
  from public.campaign_audio_state
  where campaign_id = p_campaign_id;

  return v_state;
end;
$$;

revoke all on function public.control_campaign_audio(uuid,text,uuid,boolean) from public, anon;
grant execute on function public.control_campaign_audio(uuid,text,uuid,boolean) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='campaign_audio_tracks'
  ) then
    alter publication supabase_realtime add table public.campaign_audio_tracks;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='campaign_audio_state'
  ) then
    alter publication supabase_realtime add table public.campaign_audio_state;
  end if;
end $$;

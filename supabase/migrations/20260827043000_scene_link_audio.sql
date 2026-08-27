-- Scene-link audio cues: optional music + ambience that fire when a DM travels a scene link.

alter table public.scene_links
  add column music_mode text not null default 'KEEP',
  add column music_track_id uuid references public.campaign_audio_tracks(id) on delete set null,
  add column ambience_mode text not null default 'KEEP',
  add column ambience_track_id uuid references public.campaign_audio_tracks(id) on delete set null,
  add constraint scene_links_music_mode_check check (music_mode in ('KEEP','PLAY','STOP')),
  add constraint scene_links_ambience_mode_check check (ambience_mode in ('KEEP','PLAY','STOP')),
  add constraint scene_links_music_track_check check (
    (music_mode = 'PLAY' and music_track_id is not null)
    or (music_mode <> 'PLAY' and music_track_id is null)
  ),
  add constraint scene_links_ambience_track_check check (
    (ambience_mode = 'PLAY' and ambience_track_id is not null)
    or (ambience_mode <> 'PLAY' and ambience_track_id is null)
  );

create table public.campaign_ambience_state (
  campaign_id uuid primary key references public.campaigns(id) on delete cascade,
  track_id uuid references public.campaign_audio_tracks(id) on delete set null,
  playing boolean not null default false,
  loop boolean not null default true,
  position_ms bigint not null default 0,
  started_at timestamptz,
  revision bigint not null default 0,
  updated_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  constraint campaign_ambience_state_position_check check (position_ms >= 0)
);

alter table public.campaign_ambience_state enable row level security;

create policy campaign_ambience_state_member_select
on public.campaign_ambience_state
for select to authenticated
using ((select private.is_campaign_member(campaign_id)));

revoke all on public.campaign_ambience_state from anon, authenticated;
grant select on public.campaign_ambience_state to authenticated;

create or replace function public.control_campaign_ambience(
  p_campaign_id uuid,
  p_action text,
  p_track_id uuid default null,
  p_loop boolean default null
)
returns public.campaign_ambience_state
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state public.campaign_ambience_state;
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
    raise exception 'Only a campaign DM can control ambience.';
  end if;

  insert into public.campaign_ambience_state(campaign_id, updated_by)
  values (p_campaign_id, (select auth.uid()))
  on conflict (campaign_id) do nothing;

  select *
  into v_state
  from public.campaign_ambience_state
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
      raise exception 'Choose an ambience track before playing.';
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

    update public.campaign_ambience_state
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
    update public.campaign_ambience_state
    set playing = false,
        position_ms = v_position,
        started_at = null,
        revision = revision + 1,
        updated_by = (select auth.uid()),
        updated_at = v_now
    where campaign_id = p_campaign_id;

  elsif v_action = 'STOP' then
    update public.campaign_ambience_state
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
    update public.campaign_ambience_state
    set loop = p_loop,
        revision = revision + 1,
        updated_by = (select auth.uid()),
        updated_at = v_now
    where campaign_id = p_campaign_id;

  else
    raise exception 'Unsupported ambience action: %', p_action;
  end if;

  select *
  into v_state
  from public.campaign_ambience_state
  where campaign_id = p_campaign_id;

  return v_state;
end;
$$;

revoke all on function public.control_campaign_ambience(uuid,text,uuid,boolean) from public, anon;
grant execute on function public.control_campaign_ambience(uuid,text,uuid,boolean) to authenticated;

create or replace function public.activate_scene_link(p_link_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.scene_links;
  v_campaign_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_link
  from public.scene_links
  where id = p_link_id;

  if v_link.id is null then
    raise exception 'Scene link not found';
  end if;

  select campaign_id
  into v_campaign_id
  from public.scenes
  where id = v_link.scene_id;

  if v_campaign_id is null
     or not (select private.has_campaign_role(v_campaign_id,array['OWNER','DM'])) then
    raise exception 'DM permission required';
  end if;

  if not exists (
    select 1
    from public.scenes destination
    where destination.id = v_link.destination_scene_id
      and destination.campaign_id = v_campaign_id
  ) then
    raise exception 'Scene link destination is invalid';
  end if;

  if v_link.music_mode = 'PLAY' then
    perform public.control_campaign_audio(v_campaign_id, 'PLAY', v_link.music_track_id, true);
  elsif v_link.music_mode = 'STOP' then
    perform public.control_campaign_audio(v_campaign_id, 'STOP', null, null);
  end if;

  if v_link.ambience_mode = 'PLAY' then
    perform public.control_campaign_ambience(v_campaign_id, 'PLAY', v_link.ambience_track_id, true);
  elsif v_link.ambience_mode = 'STOP' then
    perform public.control_campaign_ambience(v_campaign_id, 'STOP', null, null);
  end if;

  update public.scenes
  set active = false,
      updated_at = now()
  where campaign_id = v_campaign_id
    and active;

  update public.scenes
  set active = true,
      revealed = true,
      updated_at = now()
  where id = v_link.destination_scene_id;
end;
$$;

revoke all on function public.activate_scene_link(uuid) from public, anon;
grant execute on function public.activate_scene_link(uuid) to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='campaign_ambience_state'
  ) then
    alter publication supabase_realtime add table public.campaign_ambience_state;
  end if;
end $$;

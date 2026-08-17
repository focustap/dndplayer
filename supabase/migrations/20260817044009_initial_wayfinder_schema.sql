-- Wayfinder VTT initial schema
-- Sensitive monster state and DM notes are kept in tables that have no player SELECT policy.

create schema if not exists private;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Adventurer',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  name text not null check (char_length(name) between 1 and 100),
  join_code text not null default upper(substr(md5(gen_random_uuid()::text), 1, 6)),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaigns_join_code_key unique (join_code)
);

create table public.campaign_members (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'PLAYER' check (role in ('OWNER','DM','PLAYER','SPECTATOR')),
  joined_at timestamptz not null default now(),
  primary key (campaign_id, user_id)
);

create table public.characters (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  name text not null,
  image_url text,
  current_hp integer not null default 1 check (current_hp >= 0),
  max_hp integer not null default 1 check (max_hp > 0),
  ac integer not null default 10 check (ac between 0 and 99),
  speed integer not null default 30 check (speed >= 0),
  passive_perception integer not null default 10,
  passive_investigation integer not null default 10,
  passive_insight integer not null default 10,
  conditions text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (current_hp <= max_hp)
);

create table public.character_private (
  character_id uuid primary key references public.characters(id) on delete cascade,
  notes text not null default '',
  updated_at timestamptz not null default now()
);

create table public.maps (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  name text not null,
  storage_path text not null,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.scenes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  map_id uuid references public.maps(id) on delete set null,
  name text not null,
  map_url text,
  width integer not null default 1600 check (width > 0),
  height integer not null default 1000 check (height > 0),
  grid_type text not null default 'SQUARE' check (grid_type in ('SQUARE','GRIDLESS')),
  grid_size integer not null default 80 check (grid_size between 8 and 1000),
  feet_per_cell numeric(8,2) not null default 5 check (feet_per_cell > 0),
  grid_color text not null default '#d9cab0',
  grid_opacity numeric(4,3) not null default .18 check (grid_opacity between 0 and 1),
  fog_enabled boolean not null default true,
  fog_covered boolean not null default false,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index scenes_one_active_per_campaign_idx on public.scenes(campaign_id) where active;

create table public.scene_overlays (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references public.scenes(id) on delete cascade,
  name text not null,
  storage_path text,
  image_url text not null default '',
  kind text not null default 'PROP' check (kind in ('PROP','EFFECT')),
  x numeric not null default 0,
  y numeric not null default 0,
  width numeric not null default 200 check (width > 0),
  height numeric not null default 200 check (height > 0),
  rotation numeric not null default 0,
  opacity numeric(4,3) not null default 1 check (opacity between 0 and 1),
  z_index integer not null default 1,
  visible boolean not null default true,
  locked boolean not null default false,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.monster_templates (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  name text not null,
  image_url text,
  max_hp integer not null default 1 check (max_hp > 0),
  ac integer not null default 10 check (ac between 0 and 99),
  speed integer not null default 30 check (speed >= 0),
  abilities jsonb not null default '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',
  notes text not null default '',
  traits jsonb not null default '[]',
  actions jsonb not null default '[]',
  bonus_actions jsonb not null default '[]',
  reactions jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.monster_instances (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  template_id uuid not null references public.monster_templates(id) on delete restrict,
  custom_name text not null,
  current_hp integer not null check (current_hp >= 0),
  max_hp integer not null check (max_hp > 0),
  ac integer not null check (ac between 0 and 99),
  conditions text[] not null default '{}',
  visible boolean not null default false,
  notes text not null default '',
  dead boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (current_hp <= max_hp)
);

create table public.tokens (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references public.scenes(id) on delete cascade,
  reference_id uuid,
  owner_user_id uuid references public.profiles(id) on delete set null,
  type text not null check (type in ('PLAYER','MONSTER','NPC')),
  display_name text not null,
  image_url text,
  x numeric not null default 0,
  y numeric not null default 0,
  size numeric not null default 1 check (size > 0),
  rotation numeric not null default 0,
  visible boolean not null default true,
  locked boolean not null default false,
  conditions text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.encounters (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  name text not null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.encounter_members (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  monster_template_id uuid not null references public.monster_templates(id) on delete restrict,
  monster_instance_id uuid references public.monster_instances(id) on delete set null,
  quantity integer not null default 1 check (quantity > 0),
  group_key text,
  created_at timestamptz not null default now()
);

create table public.combat_sessions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  scene_id uuid not null references public.scenes(id) on delete cascade,
  active boolean not null default true,
  round integer not null default 1 check (round > 0),
  current_index integer not null default 0 check (current_index >= 0),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  updated_at timestamptz not null default now()
);
create unique index combat_one_active_per_scene_idx on public.combat_sessions(scene_id) where active;

create table public.initiative_entries (
  id uuid primary key default gen_random_uuid(),
  combat_session_id uuid not null references public.combat_sessions(id) on delete cascade,
  token_id uuid references public.tokens(id) on delete set null,
  monster_instance_id uuid references public.monster_instances(id) on delete set null,
  character_id uuid references public.characters(id) on delete set null,
  name text not null,
  image_url text,
  initiative integer not null default 0,
  sort_order integer not null default 0,
  group_key text,
  group_count integer not null default 1 check (group_count > 0),
  created_at timestamptz not null default now()
);

create table public.conditions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null default '',
  is_system boolean not null default true
);

create table public.fog_regions (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references public.scenes(id) on delete cascade,
  mode text not null check (mode in ('REVEAL','HIDE')),
  shape text not null check (shape in ('RECT','BRUSH')),
  points jsonb not null,
  sort_order bigint generated always as identity,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.campaign_notes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  title text not null,
  body text not null default '',
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sync_events (
  id bigint generated always as identity primary key,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  event_type text not null,
  entity_id uuid,
  created_at timestamptz not null default now()
);

-- Index every foreign key and the fields used by RLS and realtime filters.
create index campaign_members_user_id_idx on public.campaign_members(user_id);
create index characters_campaign_id_idx on public.characters(campaign_id);
create index characters_owner_id_idx on public.characters(owner_id);
create index maps_campaign_id_idx on public.maps(campaign_id);
create index scenes_campaign_id_idx on public.scenes(campaign_id);
create index scenes_map_id_idx on public.scenes(map_id);
create index scene_overlays_scene_id_idx on public.scene_overlays(scene_id);
create index monster_templates_campaign_id_idx on public.monster_templates(campaign_id);
create index monster_instances_campaign_id_idx on public.monster_instances(campaign_id);
create index monster_instances_template_id_idx on public.monster_instances(template_id);
create index tokens_scene_id_idx on public.tokens(scene_id);
create index tokens_owner_user_id_idx on public.tokens(owner_user_id);
create index tokens_reference_id_idx on public.tokens(reference_id);
create index encounters_campaign_id_idx on public.encounters(campaign_id);
create index encounter_members_encounter_id_idx on public.encounter_members(encounter_id);
create index encounter_members_template_id_idx on public.encounter_members(monster_template_id);
create index combat_sessions_campaign_id_idx on public.combat_sessions(campaign_id);
create index combat_sessions_scene_id_idx on public.combat_sessions(scene_id);
create index initiative_entries_session_id_idx on public.initiative_entries(combat_session_id);
create index fog_regions_scene_id_idx on public.fog_regions(scene_id);
create index campaign_notes_campaign_id_idx on public.campaign_notes(campaign_id);
create index sync_events_campaign_id_idx on public.sync_events(campaign_id, id desc);

-- Authorization helpers live outside the exposed schema. They are not public RPC endpoints.
create or replace function private.is_campaign_member(p_campaign_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.campaign_members cm where cm.campaign_id = p_campaign_id and cm.user_id = (select auth.uid())) $$;

create or replace function private.has_campaign_role(p_campaign_id uuid, p_roles text[])
returns boolean language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.campaign_members cm where cm.campaign_id = p_campaign_id and cm.user_id = (select auth.uid()) and cm.role = any(p_roles)) $$;

revoke all on schema private from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
-- RLS expressions run as the caller, so authenticated needs execute on the two
-- boolean helpers. The private schema is not exposed through the Data API.
grant usage on schema private to authenticated;
grant execute on function private.is_campaign_member(uuid), private.has_campaign_role(uuid,text[]) to authenticated;

create or replace function public.join_campaign(p_join_code text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_campaign_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select id into v_campaign_id from public.campaigns where join_code = upper(trim(p_join_code)) and not archived;
  if v_campaign_id is null then raise exception 'Campaign not found'; end if;
  insert into public.campaign_members(campaign_id,user_id,role) values(v_campaign_id,(select auth.uid()),'PLAYER') on conflict do nothing;
  return v_campaign_id;
end $$;

create or replace function public.move_token(p_token_id uuid, p_x numeric, p_y numeric)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_token public.tokens; v_campaign_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select * into v_token from public.tokens where id=p_token_id for update;
  select campaign_id into v_campaign_id from public.scenes where id=v_token.scene_id;
  if v_token.locked then raise exception 'Token is locked'; end if;
  if not ((select private.has_campaign_role(v_campaign_id,array['OWNER','DM'])) or (v_token.type='PLAYER' and v_token.owner_user_id=(select auth.uid()))) then raise exception 'Not permitted to move this token'; end if;
  update public.tokens set x=p_x,y=p_y,updated_at=now() where id=p_token_id;
end $$;

create or replace function public.adjust_monster_hp(p_instance_id uuid, p_amount integer, p_mode text)
returns integer language plpgsql security definer set search_path = ''
as $$
declare v_campaign_id uuid; v_result integer;
begin
  if p_amount < 0 or p_mode not in ('DAMAGE','HEAL') then raise exception 'Invalid HP adjustment'; end if;
  select campaign_id into v_campaign_id from public.monster_instances where id=p_instance_id;
  if not (select private.has_campaign_role(v_campaign_id,array['OWNER','DM'])) then raise exception 'DM permission required'; end if;
  update public.monster_instances set current_hp=case when p_mode='DAMAGE' then greatest(0,current_hp-p_amount) else least(max_hp,current_hp+p_amount) end,dead=case when p_mode='DAMAGE' then current_hp-p_amount<=0 else false end,updated_at=now() where id=p_instance_id returning current_hp into v_result;
  return v_result;
end $$;

create or replace function public.reset_scene_fog(p_scene_id uuid, p_covered boolean)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_campaign_id uuid;
begin
  select campaign_id into v_campaign_id from public.scenes where id=p_scene_id;
  if not (select private.has_campaign_role(v_campaign_id,array['OWNER','DM'])) then raise exception 'DM permission required'; end if;
  delete from public.fog_regions where scene_id=p_scene_id;
  update public.scenes set fog_covered=p_covered,updated_at=now() where id=p_scene_id;
end $$;

create or replace function public.advance_turn(p_combat_session_id uuid, p_delta integer)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_campaign_id uuid; v_count integer; v_index integer; v_round integer;
begin
  if p_delta not in (-1,1) then raise exception 'Delta must be -1 or 1'; end if;
  select campaign_id,current_index,round into v_campaign_id,v_index,v_round from public.combat_sessions where id=p_combat_session_id for update;
  if not (select private.has_campaign_role(v_campaign_id,array['OWNER','DM'])) then raise exception 'DM permission required'; end if;
  select count(*) into v_count from public.initiative_entries where combat_session_id=p_combat_session_id;
  if v_count=0 then return; end if;
  v_index:=v_index+p_delta;
  if v_index>=v_count then v_index:=0;v_round:=v_round+1; end if;
  if v_index<0 then v_index:=v_count-1;v_round:=greatest(1,v_round-1); end if;
  update public.combat_sessions set current_index=v_index,round=v_round,updated_at=now() where id=p_combat_session_id;
end $$;

revoke execute on function public.join_campaign(text) from public, anon;
revoke execute on function public.move_token(uuid,numeric,numeric) from public, anon;
revoke execute on function public.adjust_monster_hp(uuid,integer,text) from public, anon;
revoke execute on function public.reset_scene_fog(uuid,boolean) from public, anon;
revoke execute on function public.advance_turn(uuid,integer) from public, anon;
grant execute on function public.join_campaign(text), public.move_token(uuid,numeric,numeric), public.adjust_monster_hp(uuid,integer,text), public.reset_scene_fog(uuid,boolean), public.advance_turn(uuid,integer) to authenticated;

-- Automatic profile and campaign ownership rows.
create or replace function private.handle_new_user() returns trigger language plpgsql security definer set search_path=''
as $$ begin insert into public.profiles(id,display_name) values(new.id,coalesce(new.raw_user_meta_data->>'display_name',split_part(new.email,'@',1))) on conflict do nothing; return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user();

create or replace function private.handle_new_campaign() returns trigger language plpgsql security definer set search_path=''
as $$ begin insert into public.campaign_members(campaign_id,user_id,role) values(new.id,new.owner_id,'OWNER'); return new; end $$;
create trigger on_campaign_created after insert on public.campaigns for each row execute function private.handle_new_campaign();

create or replace function private.emit_scene_sync() returns trigger language plpgsql security definer set search_path=''
as $$ declare v_scene_id uuid; v_campaign_id uuid; begin v_scene_id:=coalesce(new.scene_id,old.scene_id); select campaign_id into v_campaign_id from public.scenes where id=v_scene_id; insert into public.sync_events(campaign_id,event_type,entity_id) values(v_campaign_id,tg_table_name,coalesce(new.id,old.id)); return coalesce(new,old); end $$;
create trigger sync_tokens after insert or update or delete on public.tokens for each row execute function private.emit_scene_sync();
create trigger sync_overlays after insert or update or delete on public.scene_overlays for each row execute function private.emit_scene_sync();
create trigger sync_fog after insert or update or delete on public.fog_regions for each row execute function private.emit_scene_sync();

create or replace function private.emit_campaign_sync() returns trigger language plpgsql security definer set search_path=''
as $$ begin insert into public.sync_events(campaign_id,event_type,entity_id) values(coalesce(new.campaign_id,old.campaign_id),tg_table_name,coalesce(new.id,old.id)); return coalesce(new,old); end $$;
create trigger sync_monsters after insert or update or delete on public.monster_instances for each row execute function private.emit_campaign_sync();
create trigger sync_combat after insert or update or delete on public.combat_sessions for each row execute function private.emit_campaign_sync();
create trigger sync_characters after insert or update or delete on public.characters for each row execute function private.emit_campaign_sync();
create trigger sync_scenes after insert or update or delete on public.scenes for each row execute function private.emit_campaign_sync();

create or replace function private.emit_initiative_sync() returns trigger language plpgsql security definer set search_path=''
as $$ declare v_session_id uuid; v_campaign_id uuid; begin v_session_id:=coalesce(new.combat_session_id,old.combat_session_id); select campaign_id into v_campaign_id from public.combat_sessions where id=v_session_id; insert into public.sync_events(campaign_id,event_type,entity_id) values(v_campaign_id,tg_table_name,coalesce(new.id,old.id)); return coalesce(new,old); end $$;
create trigger sync_initiative after insert or update or delete on public.initiative_entries for each row execute function private.emit_initiative_sync();
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_campaign_member(uuid), private.has_campaign_role(uuid,text[]) to authenticated;

-- RLS on every exposed public table.
alter table public.profiles enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_members enable row level security;
alter table public.characters enable row level security;
alter table public.character_private enable row level security;
alter table public.maps enable row level security;
alter table public.scenes enable row level security;
alter table public.scene_overlays enable row level security;
alter table public.monster_templates enable row level security;
alter table public.monster_instances enable row level security;
alter table public.tokens enable row level security;
alter table public.encounters enable row level security;
alter table public.encounter_members enable row level security;
alter table public.combat_sessions enable row level security;
alter table public.initiative_entries enable row level security;
alter table public.conditions enable row level security;
alter table public.fog_regions enable row level security;
alter table public.campaign_notes enable row level security;
alter table public.sync_events enable row level security;

create policy profiles_self_select on public.profiles for select to authenticated using ((select auth.uid())=id or exists(select 1 from public.campaign_members me join public.campaign_members them on them.campaign_id=me.campaign_id where me.user_id=(select auth.uid()) and them.user_id=profiles.id));
create policy profiles_self_update on public.profiles for update to authenticated using ((select auth.uid())=id) with check ((select auth.uid())=id);
create policy campaigns_member_select on public.campaigns for select to authenticated using ((select private.is_campaign_member(id)));
create policy campaigns_owner_insert on public.campaigns for insert to authenticated with check (owner_id=(select auth.uid()));
create policy campaigns_dm_update on public.campaigns for update to authenticated using ((select private.has_campaign_role(id,array['OWNER','DM']))) with check ((select private.has_campaign_role(id,array['OWNER','DM'])));
create policy members_campaign_select on public.campaign_members for select to authenticated using ((select private.is_campaign_member(campaign_id)));
create policy members_dm_manage on public.campaign_members for all to authenticated using ((select private.has_campaign_role(campaign_id,array['OWNER','DM']))) with check ((select private.has_campaign_role(campaign_id,array['OWNER','DM'])));

create policy characters_member_select on public.characters for select to authenticated using ((select private.is_campaign_member(campaign_id)));
create policy characters_owner_insert on public.characters for insert to authenticated with check ((select private.is_campaign_member(campaign_id)) and (owner_id=(select auth.uid()) or (select private.has_campaign_role(campaign_id,array['OWNER','DM']))));
create policy characters_owner_update on public.characters for update to authenticated using (owner_id=(select auth.uid()) or (select private.has_campaign_role(campaign_id,array['OWNER','DM']))) with check (owner_id=(select auth.uid()) or (select private.has_campaign_role(campaign_id,array['OWNER','DM'])));
create policy character_private_dm_all on public.character_private for all to authenticated using (exists(select 1 from public.characters c where c.id=character_id and (select private.has_campaign_role(c.campaign_id,array['OWNER','DM'])))) with check (exists(select 1 from public.characters c where c.id=character_id and (select private.has_campaign_role(c.campaign_id,array['OWNER','DM']))));

create policy maps_member_active_select on public.maps for select to authenticated using ((select private.has_campaign_role(campaign_id,array['OWNER','DM'])) or exists(select 1 from public.scenes s where s.map_id=maps.id and s.active and (select private.is_campaign_member(s.campaign_id))));
create policy maps_dm_all on public.maps for all to authenticated using ((select private.has_campaign_role(campaign_id,array['OWNER','DM']))) with check ((select private.has_campaign_role(campaign_id,array['OWNER','DM'])));
create policy scenes_member_active_select on public.scenes for select to authenticated using ((select private.has_campaign_role(campaign_id,array['OWNER','DM'])) or (active and (select private.is_campaign_member(campaign_id))));
create policy scenes_dm_all on public.scenes for all to authenticated using ((select private.has_campaign_role(campaign_id,array['OWNER','DM']))) with check ((select private.has_campaign_role(campaign_id,array['OWNER','DM'])));
create policy overlays_member_visible_select on public.scene_overlays for select to authenticated using (exists(select 1 from public.scenes s where s.id=scene_id and ((select private.has_campaign_role(s.campaign_id,array['OWNER','DM'])) or (visible and s.active and (select private.is_campaign_member(s.campaign_id))))));
create policy overlays_dm_all on public.scene_overlays for all to authenticated using (exists(select 1 from public.scenes s where s.id=scene_id and (select private.has_campaign_role(s.campaign_id,array['OWNER','DM'])))) with check (exists(select 1 from public.scenes s where s.id=scene_id and (select private.has_campaign_role(s.campaign_id,array['OWNER','DM']))));

create policy monster_templates_dm_all on public.monster_templates for all to authenticated using ((select private.has_campaign_role(campaign_id,array['OWNER','DM']))) with check ((select private.has_campaign_role(campaign_id,array['OWNER','DM'])));
create policy monster_instances_dm_all on public.monster_instances for all to authenticated using ((select private.has_campaign_role(campaign_id,array['OWNER','DM']))) with check ((select private.has_campaign_role(campaign_id,array['OWNER','DM'])));
create policy tokens_member_visible_select on public.tokens for select to authenticated using (exists(select 1 from public.scenes s where s.id=scene_id and ((select private.has_campaign_role(s.campaign_id,array['OWNER','DM'])) or (tokens.visible and s.active and (select private.is_campaign_member(s.campaign_id))))));
create policy tokens_dm_all on public.tokens for all to authenticated using (exists(select 1 from public.scenes s where s.id=scene_id and (select private.has_campaign_role(s.campaign_id,array['OWNER','DM'])))) with check (exists(select 1 from public.scenes s where s.id=scene_id and (select private.has_campaign_role(s.campaign_id,array['OWNER','DM']))));

create policy encounters_dm_all on public.encounters for all to authenticated using ((select private.has_campaign_role(campaign_id,array['OWNER','DM']))) with check ((select private.has_campaign_role(campaign_id,array['OWNER','DM'])));
create policy encounter_members_dm_all on public.encounter_members for all to authenticated using (exists(select 1 from public.encounters e where e.id=encounter_id and (select private.has_campaign_role(e.campaign_id,array['OWNER','DM'])))) with check (exists(select 1 from public.encounters e where e.id=encounter_id and (select private.has_campaign_role(e.campaign_id,array['OWNER','DM']))));
create policy combat_member_select on public.combat_sessions for select to authenticated using ((select private.is_campaign_member(campaign_id)));
create policy combat_dm_all on public.combat_sessions for all to authenticated using ((select private.has_campaign_role(campaign_id,array['OWNER','DM']))) with check ((select private.has_campaign_role(campaign_id,array['OWNER','DM'])));
create policy initiative_member_select on public.initiative_entries for select to authenticated using (exists(select 1 from public.combat_sessions cs where cs.id=combat_session_id and (select private.is_campaign_member(cs.campaign_id))));
create policy initiative_dm_all on public.initiative_entries for all to authenticated using (exists(select 1 from public.combat_sessions cs where cs.id=combat_session_id and (select private.has_campaign_role(cs.campaign_id,array['OWNER','DM'])))) with check (exists(select 1 from public.combat_sessions cs where cs.id=combat_session_id and (select private.has_campaign_role(cs.campaign_id,array['OWNER','DM']))));
create policy conditions_authenticated_select on public.conditions for select to authenticated using (true);
create policy fog_member_select on public.fog_regions for select to authenticated using (exists(select 1 from public.scenes s where s.id=scene_id and s.active and (select private.is_campaign_member(s.campaign_id))));
create policy fog_dm_all on public.fog_regions for all to authenticated using (exists(select 1 from public.scenes s where s.id=scene_id and (select private.has_campaign_role(s.campaign_id,array['OWNER','DM'])))) with check (exists(select 1 from public.scenes s where s.id=scene_id and (select private.has_campaign_role(s.campaign_id,array['OWNER','DM']))));
create policy notes_dm_all on public.campaign_notes for all to authenticated using ((select private.has_campaign_role(campaign_id,array['OWNER','DM']))) with check ((select private.has_campaign_role(campaign_id,array['OWNER','DM'])));
create policy sync_member_select on public.sync_events for select to authenticated using ((select private.is_campaign_member(campaign_id)));

-- Safe character projection; private notes are never part of this view.
create view public.characters_public with (security_invoker=true) as select id,campaign_id,owner_id,name,image_url,current_hp,max_hp,ac,speed,passive_perception,passive_investigation,passive_insight,conditions,created_at,updated_at from public.characters;

-- Explicit Data API grants (new projects no longer expose SQL-created tables by default).
grant usage on schema public to authenticated;
grant select,insert,update,delete on all tables in schema public to authenticated;
grant usage,select on all sequences in schema public to authenticated;
revoke all on all tables in schema public from anon;
grant select on public.characters_public to authenticated;

-- Private campaign asset bucket. Storage SELECT is granted only for active map or visible overlay assets.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('campaign-assets','campaign-assets',false,15728640,array['image/png','image/jpeg','image/webp']) on conflict (id) do nothing;
create policy campaign_assets_dm_insert on storage.objects for insert to authenticated with check (bucket_id='campaign-assets' and exists(select 1 from public.campaign_members cm where cm.campaign_id=(storage.foldername(storage.objects.name))[1]::uuid and cm.user_id=(select auth.uid()) and cm.role in ('OWNER','DM')));
create policy campaign_assets_allowed_select on storage.objects for select to authenticated using (bucket_id='campaign-assets' and (exists(select 1 from public.campaign_members cm where cm.campaign_id=(storage.foldername(storage.objects.name))[1]::uuid and cm.user_id=(select auth.uid()) and cm.role in ('OWNER','DM')) or exists(select 1 from public.maps m join public.scenes s on s.map_id=m.id where m.storage_path=storage.objects.name and s.active and (select private.is_campaign_member(s.campaign_id))) or exists(select 1 from public.scene_overlays o join public.scenes s on s.id=o.scene_id where o.storage_path=storage.objects.name and o.visible and s.active and (select private.is_campaign_member(s.campaign_id)))));
create policy campaign_assets_dm_update on storage.objects for update to authenticated using (bucket_id='campaign-assets' and exists(select 1 from public.campaign_members cm where cm.campaign_id=(storage.foldername(storage.objects.name))[1]::uuid and cm.user_id=(select auth.uid()) and cm.role in ('OWNER','DM'))) with check (bucket_id='campaign-assets' and exists(select 1 from public.campaign_members cm where cm.campaign_id=(storage.foldername(storage.objects.name))[1]::uuid and cm.user_id=(select auth.uid()) and cm.role in ('OWNER','DM')));
create policy campaign_assets_dm_delete on storage.objects for delete to authenticated using (bucket_id='campaign-assets' and exists(select 1 from public.campaign_members cm where cm.campaign_id=(storage.foldername(storage.objects.name))[1]::uuid and cm.user_id=(select auth.uid()) and cm.role in ('OWNER','DM')));

insert into public.conditions(name) values ('Poisoned'),('Prone'),('Restrained'),('Stunned'),('Blinded'),('Charmed'),('Frightened'),('Grappled'),('Incapacitated'),('Invisible') on conflict do nothing;

-- Realtime publication. Idempotent dynamic block avoids duplicate publication entries.
do $$
declare t text;
begin
  foreach t in array array['sync_events','tokens','scene_overlays','fog_regions','combat_sessions','initiative_entries','monster_instances'] loop
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then execute format('alter publication supabase_realtime add table public.%I',t); end if;
  end loop;
end $$;

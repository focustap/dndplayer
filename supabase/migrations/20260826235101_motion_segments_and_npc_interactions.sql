create table public.token_motion_segments (
  token_id uuid primary key references public.tokens(id) on delete cascade,
  scene_id uuid not null references public.scenes(id) on delete cascade,
  from_x numeric not null, from_y numeric not null, to_x numeric not null, to_y numeric not null,
  started_at timestamptz not null default now(), duration_ms integer not null check(duration_ms > 0),
  revision bigint not null default 1, active boolean not null default true, updated_at timestamptz not null default now()
);
create index token_motion_segments_scene_idx on public.token_motion_segments(scene_id) where active;
alter table public.token_motion_segments enable row level security;
grant select,insert,update,delete on public.token_motion_segments to authenticated;
create policy motion_segments_select on public.token_motion_segments for select to authenticated using (exists(select 1 from public.tokens t join public.scenes s on s.id=t.scene_id where t.id=token_id and t.scene_id=token_motion_segments.scene_id and ((select private.has_campaign_role(s.campaign_id,array['OWNER','DM'])) or (t.visible and s.active and s.revealed and (select private.is_campaign_member(s.campaign_id))))));
create policy motion_segments_dm_write on public.token_motion_segments for all to authenticated using (exists(select 1 from public.scenes s where s.id=scene_id and (select private.has_campaign_role(s.campaign_id,array['OWNER','DM'])))) with check (exists(select 1 from public.scenes s where s.id=scene_id and (select private.has_campaign_role(s.campaign_id,array['OWNER','DM']))));
create trigger sync_token_motion_segments after insert or update or delete on public.token_motion_segments for each row execute function private.emit_scene_sync();

create table public.token_interactions (
  token_id uuid primary key references public.tokens(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  enabled boolean not null default false, type text not null default 'DIALOGUE' check(type in ('DIALOGUE','SHOP','BOTH')),
  display_name text not null default '', dialogue_text text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.npc_shop_items (
  id uuid primary key default gen_random_uuid(), interaction_id uuid not null references public.token_interactions(token_id) on delete cascade,
  name text not null, description text not null default '', price_gp numeric not null default 0 check(price_gp >= 0), quantity integer check(quantity is null or quantity >= 0), sort_order integer not null default 0
);
alter table public.token_interactions enable row level security; alter table public.npc_shop_items enable row level security;
grant select,insert,update,delete on public.token_interactions,npc_shop_items to authenticated;
create policy token_interactions_select on public.token_interactions for select to authenticated using ((select private.has_campaign_role(campaign_id,array['OWNER','DM'])) or (enabled and exists(select 1 from public.tokens t join public.scenes s on s.id=t.scene_id where t.id=token_id and t.visible and s.active and s.revealed and (select private.is_campaign_member(s.campaign_id)))));
create policy token_interactions_dm_write on public.token_interactions for all to authenticated using ((select private.has_campaign_role(campaign_id,array['OWNER','DM']))) with check ((select private.has_campaign_role(campaign_id,array['OWNER','DM'])));
create policy shop_items_select on public.npc_shop_items for select to authenticated using (exists(select 1 from public.token_interactions i where i.token_id=interaction_id and ((select private.has_campaign_role(i.campaign_id,array['OWNER','DM'])) or i.enabled)));
create policy shop_items_dm_write on public.npc_shop_items for all to authenticated using (exists(select 1 from public.token_interactions i where i.token_id=interaction_id and (select private.has_campaign_role(i.campaign_id,array['OWNER','DM'])))) with check (exists(select 1 from public.token_interactions i where i.token_id=interaction_id and (select private.has_campaign_role(i.campaign_id,array['OWNER','DM']))));
create trigger sync_token_interactions after insert or update or delete on public.token_interactions for each row execute function private.emit_campaign_sync();

create or replace function public.start_token_motion_segment(p_patrol_id uuid,p_from_x numeric,p_from_y numeric,p_to_x numeric,p_to_y numeric,p_duration_ms integer)
returns public.token_motion_segments language plpgsql security invoker set search_path='' as $$
declare v_patrol public.token_patrols; v_token public.tokens; v_segment public.token_motion_segments; v_campaign uuid;
begin
  select * into v_patrol from public.token_patrols where id=p_patrol_id for update; select t.* into v_token from public.tokens t where t.id=v_patrol.token_id and t.scene_id=v_patrol.scene_id for update; select campaign_id into v_campaign from public.scenes where id=v_patrol.scene_id;
  if v_patrol.id is null or v_token.id is null or v_token.type not in ('MONSTER','NPC') or not (select private.has_campaign_role(v_campaign,array['OWNER','DM'])) then raise exception 'DM permission required'; end if;
  insert into public.token_motion_segments(token_id,scene_id,from_x,from_y,to_x,to_y,started_at,duration_ms,revision,active) values(v_token.id,v_patrol.scene_id,p_from_x,p_from_y,p_to_x,p_to_y,now(),greatest(1,p_duration_ms),coalesce((select revision+1 from public.token_motion_segments where token_id=v_token.id),1),true) on conflict(token_id) do update set from_x=excluded.from_x,from_y=excluded.from_y,to_x=excluded.to_x,to_y=excluded.to_y,started_at=excluded.started_at,duration_ms=excluded.duration_ms,revision=token_motion_segments.revision+1,active=true,updated_at=now() returning * into v_segment;
  return v_segment;
end $$;

create or replace function public.interact_with_npc(p_token_id uuid)
returns public.tokens language plpgsql security definer set search_path='' as $$
declare v_token public.tokens; v_segment public.token_motion_segments; v_campaign uuid; v_progress numeric; v_x numeric; v_y numeric;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select t.* into v_token from public.tokens t join public.scenes s on s.id=t.scene_id where t.id=p_token_id and t.visible and s.active and s.revealed and (select private.is_campaign_member(s.campaign_id)) for update of t;
  if v_token.id is null or v_token.type <> 'NPC' or not exists(select 1 from public.token_interactions i where i.token_id=v_token.id and i.enabled) then raise exception 'NPC is not available'; end if;
  select campaign_id into v_campaign from public.scenes where id=v_token.scene_id; select * into v_segment from public.token_motion_segments where token_id=v_token.id and active for update;
  if v_segment.token_id is not null then v_progress=least(1,greatest(0,extract(epoch from (now()-v_segment.started_at))*1000/v_segment.duration_ms)); v_x=v_segment.from_x+(v_segment.to_x-v_segment.from_x)*v_progress; v_y=v_segment.from_y+(v_segment.to_y-v_segment.from_y)*v_progress; update public.tokens set x=v_x,y=v_y,updated_at=now() where id=v_token.id returning * into v_token; update public.token_motion_segments set active=false,updated_at=now() where token_id=v_token.id; update public.token_patrols set active=false where token_id=v_token.id; end if;
  return v_token;
end $$;
revoke all on function public.start_token_motion_segment(uuid,numeric,numeric,numeric,numeric,integer),public.interact_with_npc(uuid) from public,anon;
grant execute on function public.start_token_motion_segment(uuid,numeric,numeric,numeric,numeric,integer),public.interact_with_npc(uuid) to authenticated;

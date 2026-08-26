create table public.scene_links (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references public.scenes(id) on delete cascade,
  destination_scene_id uuid not null references public.scenes(id) on delete cascade,
  label text not null default '',
  x numeric not null,
  y numeric not null,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (scene_id <> destination_scene_id)
);
create index scene_links_scene_id_idx on public.scene_links(scene_id);
create index scene_links_destination_scene_id_idx on public.scene_links(destination_scene_id);
alter table public.scene_links enable row level security;
grant select,insert,update,delete on public.scene_links to authenticated;

create policy scene_links_dm_all on public.scene_links for all to authenticated
using (exists(select 1 from public.scenes s where s.id=scene_id and (select private.has_campaign_role(s.campaign_id,array['OWNER','DM']))))
with check (created_by=(select auth.uid()) and exists(select 1 from public.scenes source join public.scenes destination on destination.id=destination_scene_id where source.id=scene_id and source.campaign_id=destination.campaign_id and (select private.has_campaign_role(source.campaign_id,array['OWNER','DM']))));

create or replace function public.activate_and_reveal_scene(p_scene_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_campaign_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select campaign_id into v_campaign_id from public.scenes where id=p_scene_id for update;
  if v_campaign_id is null then raise exception 'Scene not found'; end if;
  if not (select private.has_campaign_role(v_campaign_id,array['OWNER','DM'])) then raise exception 'DM permission required'; end if;
  update public.scenes set active=false,updated_at=now() where campaign_id=v_campaign_id and active;
  update public.scenes set active=true,revealed=true,updated_at=now() where id=p_scene_id;
end $$;
revoke all on function public.activate_and_reveal_scene(uuid) from public;
grant execute on function public.activate_and_reveal_scene(uuid) to authenticated;

-- Keep a character linked to at most one player token per scene when using the
-- supported placement RPC. Existing tokens are returned instead of duplicated.
create or replace function public.place_character_token(p_scene_id uuid,p_character_id uuid,p_x numeric,p_y numeric)
returns public.tokens language plpgsql security definer set search_path = ''
as $$
declare v_campaign_id uuid; v_character public.characters; v_token public.tokens;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select campaign_id into v_campaign_id from public.scenes where id=p_scene_id;
  if v_campaign_id is null or not (select private.has_campaign_role(v_campaign_id,array['OWNER','DM'])) then raise exception 'DM permission required'; end if;
  select * into v_character from public.characters where id=p_character_id and campaign_id=v_campaign_id;
  if v_character.id is null then raise exception 'Character not found in this campaign'; end if;
  select * into v_token from public.tokens where scene_id=p_scene_id and type='PLAYER' and reference_id=v_character.id limit 1;
  if v_token.id is not null then return v_token; end if;
  insert into public.tokens (scene_id,reference_id,owner_user_id,type,display_name,image_url,image_path,x,y,size,rotation,visible,locked,conditions)
  values (p_scene_id,v_character.id,v_character.owner_id,'PLAYER',v_character.name,v_character.image_url,v_character.image_path,p_x,p_y,1,0,true,false,v_character.conditions)
  returning * into v_token;
  return v_token;
end $$;
revoke all on function public.place_character_token(uuid,uuid,numeric,numeric) from public,anon;
grant execute on function public.place_character_token(uuid,uuid,numeric,numeric) to authenticated;

create trigger sync_scene_links after insert or update or delete on public.scene_links for each row execute function private.emit_scene_sync();

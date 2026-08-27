-- A player character should only ever have one placed token per scene.
-- The placement RPC already reuses an existing token; the unique index closes
-- the small concurrent-placement race as well.

create unique index if not exists tokens_one_player_character_per_scene
on public.tokens(scene_id,reference_id)
where type='PLAYER' and reference_id is not null;

create or replace function public.place_character_token(
  p_scene_id uuid,
  p_character_id uuid,
  p_x numeric,
  p_y numeric
)
returns public.tokens
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign_id uuid;
  v_character public.characters;
  v_token public.tokens;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  select campaign_id
  into v_campaign_id
  from public.scenes
  where id=p_scene_id;

  if v_campaign_id is null
     or not (select private.has_campaign_role(v_campaign_id,array['OWNER','DM'])) then
    raise exception 'DM permission required';
  end if;

  select *
  into v_character
  from public.characters
  where id=p_character_id
    and campaign_id=v_campaign_id;

  if v_character.id is null then
    raise exception 'Character not found in this campaign';
  end if;

  select *
  into v_token
  from public.tokens
  where scene_id=p_scene_id
    and type='PLAYER'
    and reference_id=v_character.id
  limit 1;

  if v_token.id is not null then
    return v_token;
  end if;

  begin
    insert into public.tokens(
      scene_id,reference_id,owner_user_id,type,display_name,image_url,image_path,
      x,y,size,rotation,visible,locked,conditions
    ) values (
      p_scene_id,v_character.id,v_character.owner_id,'PLAYER',v_character.name,
      v_character.image_url,v_character.image_path,
      p_x,p_y,v_character.default_token_size,0,true,false,v_character.conditions
    )
    returning * into v_token;
  exception when unique_violation then
    select *
    into v_token
    from public.tokens
    where scene_id=p_scene_id
      and type='PLAYER'
      and reference_id=v_character.id
    limit 1;
  end;

  return v_token;
end;
$$;

revoke all on function public.place_character_token(uuid,uuid,numeric,numeric) from public,anon;
grant execute on function public.place_character_token(uuid,uuid,numeric,numeric) to authenticated;

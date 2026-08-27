-- Persist a preferred map token size on the underlying creature/character source.
-- Changing a placed token's size updates this preference, and future placements
-- inherit it automatically.

alter table public.characters
  add column if not exists default_token_size numeric not null default 1
    check (default_token_size > 0 and default_token_size <= 8);

alter table public.monster_templates
  add column if not exists default_token_size numeric not null default 1
    check (default_token_size > 0 and default_token_size <= 8);

alter table public.npc_templates
  add column if not exists default_token_size numeric not null default 1
    check (default_token_size > 0 and default_token_size <= 8);

-- Preserve sizes the DM has already customized on placed tokens.
with latest_player_sizes as (
  select distinct on (t.reference_id)
    t.reference_id as character_id,
    t.size
  from public.tokens t
  where t.type = 'PLAYER'
    and t.reference_id is not null
  order by t.reference_id, t.updated_at desc, t.created_at desc
)
update public.characters c
set default_token_size = l.size
from latest_player_sizes l
where c.id = l.character_id
  and l.size <> 1;

with latest_npc_sizes as (
  select distinct on (t.reference_id)
    t.reference_id as template_id,
    t.size
  from public.tokens t
  where t.type = 'NPC'
    and t.reference_id is not null
  order by t.reference_id, t.updated_at desc, t.created_at desc
)
update public.npc_templates n
set default_token_size = l.size
from latest_npc_sizes l
where n.id = l.template_id
  and l.size <> 1;

with latest_monster_sizes as (
  select distinct on (mi.template_id)
    mi.template_id,
    t.size
  from public.tokens t
  join public.monster_instances mi on mi.id = t.reference_id
  where t.type = 'MONSTER'
  order by mi.template_id, t.updated_at desc, t.created_at desc
)
update public.monster_templates mt
set default_token_size = l.size
from latest_monster_sizes l
where mt.id = l.template_id
  and l.size <> 1;

create or replace function public.set_token_size_and_default(
  p_token_id uuid,
  p_size numeric
)
returns public.tokens
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token public.tokens;
  v_campaign_id uuid;
  v_template_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if p_size is null or p_size <= 0 or p_size > 8 then
    raise exception 'Token size must be greater than 0 and no more than 8.';
  end if;

  select *
  into v_token
  from public.tokens
  where id = p_token_id
  for update;

  if v_token.id is null then
    raise exception 'Token not found';
  end if;

  select campaign_id
  into v_campaign_id
  from public.scenes
  where id = v_token.scene_id;

  if v_campaign_id is null
     or not (select private.has_campaign_role(v_campaign_id,array['OWNER','DM'])) then
    raise exception 'DM permission required';
  end if;

  update public.tokens
  set size = p_size,
      updated_at = now()
  where id = p_token_id
  returning * into v_token;

  if v_token.type = 'PLAYER' and v_token.reference_id is not null then
    update public.characters
    set default_token_size = p_size,
        updated_at = now()
    where id = v_token.reference_id
      and campaign_id = v_campaign_id;

  elsif v_token.type = 'NPC' and v_token.reference_id is not null then
    update public.npc_templates
    set default_token_size = p_size,
        updated_at = now()
    where id = v_token.reference_id;

  elsif v_token.type = 'MONSTER' and v_token.reference_id is not null then
    select template_id
    into v_template_id
    from public.monster_instances
    where id = v_token.reference_id
      and campaign_id = v_campaign_id;

    if v_template_id is not null then
      update public.monster_templates
      set default_token_size = p_size,
          updated_at = now()
      where id = v_template_id;
    end if;
  end if;

  return v_token;
end;
$$;

revoke all on function public.set_token_size_and_default(uuid,numeric) from public,anon;
grant execute on function public.set_token_size_and_default(uuid,numeric) to authenticated;

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
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select campaign_id into v_campaign_id from public.scenes where id=p_scene_id;
  if v_campaign_id is null or not (select private.has_campaign_role(v_campaign_id,array['OWNER','DM'])) then
    raise exception 'DM permission required';
  end if;

  select * into v_character
  from public.characters
  where id=p_character_id and campaign_id=v_campaign_id;

  if v_character.id is null then
    raise exception 'Character not found in this campaign';
  end if;

  select * into v_token
  from public.tokens
  where scene_id=p_scene_id
    and type='PLAYER'
    and reference_id=v_character.id
  limit 1;

  if v_token.id is not null then
    return v_token;
  end if;

  insert into public.tokens(
    scene_id,reference_id,owner_user_id,type,display_name,image_url,image_path,
    x,y,size,rotation,visible,locked,conditions
  ) values (
    p_scene_id,v_character.id,v_character.owner_id,'PLAYER',v_character.name,
    v_character.image_url,v_character.image_path,
    p_x,p_y,v_character.default_token_size,0,true,false,v_character.conditions
  )
  returning * into v_token;

  return v_token;
end;
$$;

revoke all on function public.place_character_token(uuid,uuid,numeric,numeric) from public,anon;
grant execute on function public.place_character_token(uuid,uuid,numeric,numeric) to authenticated;

create or replace function public.place_monster_token(
  p_scene_id uuid,
  p_template_id uuid,
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
  v_template public.monster_templates;
  v_instance public.monster_instances;
  v_token public.tokens;
  v_name text;
  v_count integer;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;

  select campaign_id into v_campaign_id
  from public.scenes
  where id = p_scene_id;

  if v_campaign_id is null
     or not (select private.has_campaign_role(v_campaign_id,array['OWNER','DM'])) then
    raise exception 'DM permission required';
  end if;

  select * into v_template
  from public.monster_templates
  where id = p_template_id;

  if v_template.id is null then
    raise exception 'Monster template not found';
  end if;

  select count(*) into v_count
  from public.monster_instances
  where campaign_id = v_campaign_id
    and template_id = p_template_id;

  v_name := case
    when v_count = 0 then v_template.name
    else v_template.name || ' ' || (v_count + 1)::text
  end;

  insert into public.monster_instances(
    campaign_id,template_id,custom_name,current_hp,max_hp,ac,conditions,visible,notes,dead
  ) values (
    v_campaign_id,v_template.id,v_name,v_template.max_hp,v_template.max_hp,
    v_template.ac,'{}',true,'',false
  )
  returning * into v_instance;

  insert into public.tokens(
    scene_id,reference_id,owner_user_id,type,display_name,image_url,image_path,
    x,y,size,rotation,visible,locked,conditions
  ) values (
    p_scene_id,v_instance.id,null,'MONSTER',v_instance.custom_name,
    v_template.image_url,v_template.image_path,
    p_x,p_y,v_template.default_token_size,0,true,false,'{}'
  )
  returning * into v_token;

  return v_token;
end;
$$;

revoke all on function public.place_monster_token(uuid,uuid,numeric,numeric) from public,anon;
grant execute on function public.place_monster_token(uuid,uuid,numeric,numeric) to authenticated;

create or replace function public.place_npc_token(
  p_scene_id uuid,
  p_template_id uuid,
  p_x numeric,
  p_y numeric
)
returns public.tokens
language plpgsql
security definer
set search_path=''
as $$
declare
  v_campaign_id uuid;
  v_template public.npc_templates;
  v_token public.tokens;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  select campaign_id into v_campaign_id
  from public.scenes
  where id = p_scene_id;

  if v_campaign_id is null
     or not (select private.has_campaign_role(v_campaign_id,array['OWNER','DM'])) then
    raise exception 'DM permission required';
  end if;

  select * into v_template
  from public.npc_templates
  where id = p_template_id;

  if v_template.id is null then
    raise exception 'NPC template not found';
  end if;

  insert into public.tokens(
    scene_id,reference_id,owner_user_id,type,display_name,image_url,image_path,
    x,y,size,rotation,visible,locked,conditions
  ) values (
    p_scene_id,v_template.id,null,'NPC',v_template.name,
    v_template.image_url,v_template.image_path,
    p_x,p_y,v_template.default_token_size,0,true,false,'{}'
  )
  returning * into v_token;

  return v_token;
end;
$$;

revoke all on function public.place_npc_token(uuid,uuid,numeric,numeric) from public,anon;
grant execute on function public.place_npc_token(uuid,uuid,numeric,numeric) to authenticated;

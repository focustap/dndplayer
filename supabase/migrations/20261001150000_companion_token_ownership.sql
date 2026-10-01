create or replace function public.move_token(
  p_token_id uuid,
  p_x numeric,
  p_y numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token public.tokens;
  v_campaign_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
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

  if v_token.locked then
    raise exception 'Token is locked';
  end if;

  if not (
    (select private.has_campaign_role(v_campaign_id, array['OWNER','DM']))
    or (
      v_token.type in ('PLAYER','NPC','MONSTER')
      and v_token.owner_user_id = (select auth.uid())
    )
  ) then
    raise exception 'Not permitted to move this token';
  end if;

  update public.tokens
  set x = p_x,
      y = p_y,
      updated_at = now()
  where id = p_token_id;
end;
$$;

revoke all on function public.move_token(uuid,numeric,numeric) from public, anon;
grant execute on function public.move_token(uuid,numeric,numeric) to authenticated;

create or replace function public.place_npc_token(
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
  v_template public.npc_templates;
  v_token public.tokens;
  v_owner_user_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  select campaign_id
  into v_campaign_id
  from public.scenes
  where id = p_scene_id;

  if v_campaign_id is null
     or not (select private.has_campaign_role(v_campaign_id,array['OWNER','DM'])) then
    raise exception 'DM permission required';
  end if;

  select *
  into v_template
  from public.npc_templates
  where id = p_template_id;

  if v_template.id is null then
    raise exception 'NPC template not found';
  end if;

  v_owner_user_id := null;

  if lower(v_template.name) = 'theldren clone' then
    select owner_id
    into v_owner_user_id
    from public.characters
    where campaign_id = v_campaign_id
      and lower(name) = 'theldren eldercrown'
    limit 1;
  end if;

  insert into public.tokens(
    scene_id,reference_id,owner_user_id,type,display_name,image_url,image_path,
    x,y,size,rotation,visible,locked,conditions
  ) values (
    p_scene_id,v_template.id,v_owner_user_id,'NPC',v_template.name,
    v_template.image_url,v_template.image_path,
    p_x,p_y,v_template.default_token_size,0,true,false,'{}'
  )
  returning * into v_token;

  return v_token;
end;
$$;

revoke all on function public.place_npc_token(uuid,uuid,numeric,numeric) from public, anon;
grant execute on function public.place_npc_token(uuid,uuid,numeric,numeric) to authenticated;

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
  v_owner_user_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  select campaign_id
  into v_campaign_id
  from public.scenes
  where id = p_scene_id;

  if v_campaign_id is null
     or not (select private.has_campaign_role(v_campaign_id,array['OWNER','DM'])) then
    raise exception 'DM permission required';
  end if;

  select *
  into v_template
  from public.monster_templates
  where id = p_template_id;

  if v_template.id is null then
    raise exception 'Monster template not found';
  end if;

  select count(*)
  into v_count
  from public.monster_instances
  where campaign_id = v_campaign_id
    and template_id = p_template_id;

  v_name := case
    when v_count = 0 then v_template.name
    else v_template.name || ' ' || (v_count + 1)::text
  end;

  v_owner_user_id := null;

  if lower(v_template.name) = 'spider' then
    select owner_id
    into v_owner_user_id
    from public.characters
    where campaign_id = v_campaign_id
      and lower(name) = 'pipp karew'
    limit 1;
  end if;

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
    p_scene_id,v_instance.id,v_owner_user_id,'MONSTER',v_instance.custom_name,
    v_template.image_url,v_template.image_path,
    p_x,p_y,v_template.default_token_size,0,true,false,'{}'
  )
  returning * into v_token;

  return v_token;
end;
$$;

revoke all on function public.place_monster_token(uuid,uuid,numeric,numeric) from public, anon;
grant execute on function public.place_monster_token(uuid,uuid,numeric,numeric) to authenticated;

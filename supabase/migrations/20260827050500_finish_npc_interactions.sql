-- Finish NPC/creature interactions: allow configured MONSTER tokens to interact
-- (older campaigns often used monsters as NPCs) and sync shop-item edits live.

create or replace function public.interact_with_npc(p_token_id uuid)
returns public.tokens
language plpgsql
security definer
set search_path=''
as $$
declare
  v_token public.tokens;
  v_segment public.token_motion_segments;
  v_campaign uuid;
  v_progress numeric;
  v_x numeric;
  v_y numeric;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  select t.*
  into v_token
  from public.tokens t
  join public.scenes s on s.id=t.scene_id
  where t.id=p_token_id
    and t.visible
    and s.active
    and s.revealed
    and (select private.is_campaign_member(s.campaign_id))
  for update of t;

  if v_token.id is null
     or v_token.type not in ('NPC','MONSTER')
     or not exists(
       select 1
       from public.token_interactions i
       where i.token_id=v_token.id
         and i.enabled
     ) then
    raise exception 'NPC is not available';
  end if;

  select campaign_id
  into v_campaign
  from public.scenes
  where id=v_token.scene_id;

  select *
  into v_segment
  from public.token_motion_segments
  where token_id=v_token.id
    and active
  for update;

  if v_segment.token_id is not null then
    v_progress=least(
      1,
      greatest(
        0,
        extract(epoch from (now()-v_segment.started_at))*1000/v_segment.duration_ms
      )
    );
    v_x=v_segment.from_x+(v_segment.to_x-v_segment.from_x)*v_progress;
    v_y=v_segment.from_y+(v_segment.to_y-v_segment.from_y)*v_progress;

    update public.tokens
    set x=v_x,
        y=v_y,
        updated_at=now()
    where id=v_token.id
    returning * into v_token;

    update public.token_motion_segments
    set active=false,
        updated_at=now()
    where token_id=v_token.id;

    update public.token_patrols
    set active=false,
        updated_at=now()
    where token_id=v_token.id;
  end if;

  return v_token;
end $$;

revoke all on function public.interact_with_npc(uuid) from public,anon;
grant execute on function public.interact_with_npc(uuid) to authenticated;

create or replace function private.emit_shop_item_sync()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_interaction_id uuid;
  v_campaign_id uuid;
begin
  v_interaction_id:=coalesce(new.interaction_id,old.interaction_id);

  select campaign_id
  into v_campaign_id
  from public.token_interactions
  where token_id=v_interaction_id;

  if v_campaign_id is not null then
    insert into public.sync_events(campaign_id,event_type,entity_id)
    values(v_campaign_id,'npc_shop_items',coalesce(new.id,old.id));
  end if;

  return coalesce(new,old);
end $$;

drop trigger if exists sync_npc_shop_items on public.npc_shop_items;
create trigger sync_npc_shop_items
after insert or update or delete on public.npc_shop_items
for each row execute function private.emit_shop_item_sync();

drop policy if exists shop_items_select on public.npc_shop_items;
create policy shop_items_select
on public.npc_shop_items
for select to authenticated
using (
  exists(
    select 1
    from public.token_interactions i
    where i.token_id=interaction_id
      and (
        (select private.has_campaign_role(i.campaign_id,array['OWNER','DM']))
        or (
          i.enabled
          and (select private.is_campaign_member(i.campaign_id))
          and exists(
            select 1
            from public.tokens t
            join public.scenes s on s.id=t.scene_id
            where t.id=i.token_id
              and t.visible
              and s.active
              and s.revealed
          )
        )
      )
  )
);

revoke execute on function private.emit_shop_item_sync() from public,anon,authenticated;

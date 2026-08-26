alter table public.characters
  add column temp_hp integer not null default 0 check (temp_hp >= 0);

create or replace function public.set_character_combat(
  p_character_id uuid,
  p_current_hp integer,
  p_max_hp integer,
  p_temp_hp integer,
  p_ac integer
)
returns public.characters
language plpgsql
security definer
set search_path = ''
as $$
declare v_character public.characters;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select * into v_character from public.characters where id=p_character_id for update;
  if v_character.id is null then raise exception 'Character not found'; end if;
  if v_character.owner_id <> (select auth.uid()) and not (select private.has_campaign_role(v_character.campaign_id,array['OWNER','DM'])) then
    raise exception 'Character owner or DM permission required';
  end if;
  if p_max_hp < 1 or p_current_hp < 0 or p_current_hp > p_max_hp or p_temp_hp < 0 or p_ac < 0 or p_ac > 99 then
    raise exception 'Invalid character combat values';
  end if;
  update public.characters set current_hp=p_current_hp,max_hp=p_max_hp,temp_hp=p_temp_hp,ac=p_ac,updated_at=now() where id=p_character_id returning * into v_character;
  return v_character;
end;
$$;

create or replace function public.adjust_character_hp(p_character_id uuid,p_amount integer,p_mode text)
returns public.characters
language plpgsql
security definer
set search_path = ''
as $$
declare v_character public.characters; v_remaining integer;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_amount <= 0 or p_mode not in ('DAMAGE','HEAL') then raise exception 'Invalid HP adjustment'; end if;
  select * into v_character from public.characters where id=p_character_id for update;
  if v_character.id is null then raise exception 'Character not found'; end if;
  if v_character.owner_id <> (select auth.uid()) and not (select private.has_campaign_role(v_character.campaign_id,array['OWNER','DM'])) then
    raise exception 'Character owner or DM permission required';
  end if;
  if p_mode='DAMAGE' then
    v_remaining:=greatest(0,p_amount-v_character.temp_hp);
    update public.characters set temp_hp=greatest(0,temp_hp-p_amount),current_hp=greatest(0,current_hp-v_remaining),updated_at=now() where id=p_character_id returning * into v_character;
  else
    update public.characters set current_hp=least(max_hp,current_hp+p_amount),updated_at=now() where id=p_character_id returning * into v_character;
  end if;
  return v_character;
end;
$$;

revoke all on function public.set_character_combat(uuid,integer,integer,integer,integer) from public,anon;
revoke all on function public.adjust_character_hp(uuid,integer,text) from public,anon;
grant execute on function public.set_character_combat(uuid,integer,integer,integer,integer) to authenticated;
grant execute on function public.adjust_character_hp(uuid,integer,text) to authenticated;

drop view public.characters_public;
create view public.characters_public with (security_invoker = true) as
select id,campaign_id,owner_id,name,image_url,image_path,current_hp,max_hp,temp_hp,ac,speed,passive_perception,passive_investigation,passive_insight,conditions,created_at,updated_at
from public.characters;
grant select on public.characters_public to authenticated;

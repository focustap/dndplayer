alter table public.characters
  add column strength smallint not null default 10 check (strength between 1 and 30),
  add column dexterity smallint not null default 10 check (dexterity between 1 and 30),
  add column constitution smallint not null default 10 check (constitution between 1 and 30),
  add column intelligence smallint not null default 10 check (intelligence between 1 and 30),
  add column wisdom smallint not null default 10 check (wisdom between 1 and 30),
  add column charisma smallint not null default 10 check (charisma between 1 and 30);

create or replace function public.set_character_abilities(
  p_character_id uuid,
  p_strength integer,
  p_dexterity integer,
  p_constitution integer,
  p_intelligence integer,
  p_wisdom integer,
  p_charisma integer
)
returns public.characters
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_character public.characters;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  select * into v_character
  from public.characters
  where id = p_character_id
  for update;

  if v_character.id is null then
    raise exception 'Character not found';
  end if;

  if v_character.owner_id <> (select auth.uid())
    and not (select private.has_campaign_role(v_character.campaign_id, array['OWNER', 'DM'])) then
    raise exception 'Character owner or DM permission required';
  end if;

  if p_strength not between 1 and 30
    or p_dexterity not between 1 and 30
    or p_constitution not between 1 and 30
    or p_intelligence not between 1 and 30
    or p_wisdom not between 1 and 30
    or p_charisma not between 1 and 30 then
    raise exception 'Ability scores must be between 1 and 30';
  end if;

  update public.characters
  set strength = p_strength,
      dexterity = p_dexterity,
      constitution = p_constitution,
      intelligence = p_intelligence,
      wisdom = p_wisdom,
      charisma = p_charisma,
      updated_at = now()
  where id = p_character_id
  returning * into v_character;

  return v_character;
end;
$$;

revoke all on function public.set_character_abilities(uuid, integer, integer, integer, integer, integer, integer) from public, anon;
grant execute on function public.set_character_abilities(uuid, integer, integer, integer, integer, integer, integer) to authenticated;

drop view public.characters_public;
create view public.characters_public with (security_invoker = true) as
select id, campaign_id, owner_id, name, image_url, image_path, current_hp, max_hp, temp_hp, ac, speed,
       strength, dexterity, constitution, intelligence, wisdom, charisma,
       passive_perception, passive_investigation, passive_insight, conditions, created_at, updated_at
from public.characters;
grant select on public.characters_public to authenticated;

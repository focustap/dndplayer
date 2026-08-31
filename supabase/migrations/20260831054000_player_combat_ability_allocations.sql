alter table public.characters
  add column if not exists allowed_attack_presets text[] not null default array['MELEE']::text[];

update public.characters
set allowed_attack_presets = case
  when lower(trim(name)) in ('zach', 'echo frost') then array['MELEE','SNEAK_ATTACK']::text[]
  when lower(trim(name)) in ('cody', 'theldren eldercrown') then array['MELEE','SPELL','WIZARD']::text[]
  when lower(trim(name)) = 'gerbo grumble' then array['MELEE','SMITE']::text[]
  when lower(trim(name)) = 'pipp karew' then array['MELEE','DRUID']::text[]
  else allowed_attack_presets
end;

create or replace function public.set_character_attack_presets(
  p_character_id uuid,
  p_presets text[]
)
returns public.characters
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_character public.characters;
  v_presets text[];
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;

  select * into v_character
  from public.characters
  where id = p_character_id
  for update;

  if v_character.id is null then raise exception 'Character not found'; end if;
  if not (select private.has_campaign_role(v_character.campaign_id, array['OWNER','DM'])) then
    raise exception 'DM permission required';
  end if;
  if p_presets is null or cardinality(p_presets) > 32 then
    raise exception 'Invalid combat ability allocation';
  end if;

  select coalesce(array_agg(distinct upper(trim(value)) order by upper(trim(value))), '{}'::text[])
  into v_presets
  from unnest(p_presets) as preset(value)
  where trim(value) <> '';

  update public.characters
  set allowed_attack_presets = v_presets,
      updated_at = now()
  where id = p_character_id
  returning * into v_character;

  return v_character;
end;
$$;

revoke all on function public.set_character_attack_presets(uuid, text[]) from public, anon;
grant execute on function public.set_character_attack_presets(uuid, text[]) to authenticated;

drop view if exists public.characters_public;
create view public.characters_public with (security_invoker = true) as
select id, campaign_id, owner_id, name, image_url, image_path,
       current_hp, max_hp, temp_hp, ac, speed,
       strength, dexterity, constitution, intelligence, wisdom, charisma,
       passive_perception, passive_investigation, passive_insight,
       allowed_attack_presets, conditions, created_at, updated_at
from public.characters;
grant select on public.characters_public to authenticated;

create or replace function private.validate_player_attack_preset()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text;
  v_reference_id uuid;
  v_allowed text[];
begin
  select type, reference_id into v_type, v_reference_id
  from public.tokens
  where id = new.attacker_token_id;

  if v_type = 'PLAYER' and v_reference_id is not null then
    select allowed_attack_presets into v_allowed
    from public.characters
    where id = v_reference_id;

    if v_allowed is null or not (new.preset = any(v_allowed)) then
      raise exception 'This character is not allowed to use %', new.preset;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_player_attack_preset on public.tabletop_animation_events;
create trigger validate_player_attack_preset
before insert on public.tabletop_animation_events
for each row execute function private.validate_player_attack_preset();

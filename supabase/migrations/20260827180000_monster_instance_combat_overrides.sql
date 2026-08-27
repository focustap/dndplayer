alter table public.monster_instances
  add column if not exists hp_formula_override text,
  add column if not exists damage_dice_overrides jsonb not null default '{}'::jsonb;

alter table public.monster_instances
  drop constraint if exists monster_instances_damage_dice_overrides_object;

alter table public.monster_instances
  add constraint monster_instances_damage_dice_overrides_object
  check (jsonb_typeof(damage_dice_overrides) = 'object');

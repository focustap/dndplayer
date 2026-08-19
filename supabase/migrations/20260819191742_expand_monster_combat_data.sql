alter table public.monster_templates
  add column if not exists creature_size text not null default 'Medium',
  add column if not exists creature_type text not null default '',
  add column if not exists hp_formula text,
  add column if not exists movement jsonb not null default '{"walk":30,"fly":0,"swim":0,"climb":0,"burrow":0,"hover":false}'::jsonb,
  add column if not exists initiative jsonb not null default '{}'::jsonb,
  add column if not exists saving_throws jsonb not null default '{}'::jsonb,
  add column if not exists skills jsonb not null default '{}'::jsonb,
  add column if not exists damage_vulnerabilities text[] not null default '{}',
  add column if not exists damage_resistances text[] not null default '{}',
  add column if not exists damage_immunities text[] not null default '{}',
  add column if not exists condition_immunities text[] not null default '{}',
  add column if not exists senses jsonb not null default '[]'::jsonb,
  add column if not exists passive_perception integer,
  add column if not exists languages text[] not null default '{}',
  add column if not exists legendary_actions jsonb not null default '[]'::jsonb,
  add column if not exists legendary_action_uses integer,
  add column if not exists spellcasting jsonb not null default '[]'::jsonb;

alter table public.monster_templates
  add constraint monster_templates_movement_object check (jsonb_typeof(movement) = 'object'),
  add constraint monster_templates_initiative_object check (jsonb_typeof(initiative) = 'object'),
  add constraint monster_templates_saving_throws_object check (jsonb_typeof(saving_throws) = 'object'),
  add constraint monster_templates_skills_object check (jsonb_typeof(skills) = 'object'),
  add constraint monster_templates_senses_array check (jsonb_typeof(senses) = 'array'),
  add constraint monster_templates_legendary_actions_array check (jsonb_typeof(legendary_actions) = 'array'),
  add constraint monster_templates_spellcasting_array check (jsonb_typeof(spellcasting) = 'array'),
  add constraint monster_templates_legendary_action_uses_positive check (legendary_action_uses is null or legendary_action_uses >= 0);

drop trigger if exists sync_monster_templates on public.monster_templates;
create trigger sync_monster_templates after insert or update or delete on public.monster_templates for each row execute function private.emit_campaign_sync();

-- Tiny tokens are intentionally only a little smaller than normal.
-- Convert the old 0.5x Tiny setting to the new 0.8x value everywhere.

update public.tokens
set size = 0.8,
    updated_at = now()
where size = 0.5;

update public.characters
set default_token_size = 0.8,
    updated_at = now()
where default_token_size = 0.5;

update public.monster_templates
set default_token_size = 0.8,
    updated_at = now()
where default_token_size = 0.5;

update public.npc_templates
set default_token_size = 0.8,
    updated_at = now()
where default_token_size = 0.5;

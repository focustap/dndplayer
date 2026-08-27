-- Multi-page NPC dialogue.
-- Keep dialogue_text as a backwards-compatible first-page mirror while
-- dialogue_pages stores the full ordered conversation script.

alter table public.token_interactions
  add column if not exists dialogue_pages jsonb not null default '[]'::jsonb
  check (jsonb_typeof(dialogue_pages) = 'array');

update public.token_interactions
set dialogue_pages = jsonb_build_array(dialogue_text)
where jsonb_array_length(dialogue_pages) = 0
  and btrim(dialogue_text) <> '';

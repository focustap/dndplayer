-- Initial table creation was applied to the linked project before the full
-- policy and Realtime setup migration that follows.
create table public.tabletop_cinematic_events (
  id uuid primary key default gen_random_uuid()
);

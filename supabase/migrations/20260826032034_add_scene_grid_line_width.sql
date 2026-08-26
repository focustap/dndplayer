alter table public.scenes
  add column grid_line_width numeric(4,2) not null default 1 check (grid_line_width between .5 and 12);

-- Rename scene lighting to time-of-day presets.
alter table public.scenes
  drop constraint if exists scenes_lighting_check;

update public.scenes
set lighting = case lighting
  when 'BRIGHT' then 'DAY'
  when 'DIM' then 'MIDDAY'
  when 'DARK' then 'NIGHT'
  else lighting
end;

alter table public.scenes
  alter column lighting set default 'DAY';

alter table public.scenes
  add constraint scenes_lighting_check
  check (lighting in ('DAY','MIDDAY','NIGHT'));

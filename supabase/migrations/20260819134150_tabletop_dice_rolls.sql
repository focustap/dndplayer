-- Results are generated in Postgres and exposed only through an RLS-filtered history.
create table public.tabletop_dice_rolls (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  roller_user_id uuid not null references public.profiles(id) on delete restrict,
  roller_role text not null check (roller_role in ('OWNER', 'DM', 'PLAYER')),
  sides integer not null check (sides in (4, 6, 8, 10, 12, 20, 100)),
  quantity integer not null check (quantity between 1 and 20),
  results integer[] not null,
  total integer not null,
  created_at timestamptz not null default now()
);

create index tabletop_dice_rolls_campaign_created_idx on public.tabletop_dice_rolls(campaign_id, created_at desc);

alter table public.tabletop_dice_rolls enable row level security;

create policy tabletop_dice_rolls_private_history on public.tabletop_dice_rolls
for select to authenticated
using (
  roller_user_id = (select auth.uid())
  or (select private.has_campaign_role(campaign_id, array['OWNER', 'DM']))
);

revoke all on public.tabletop_dice_rolls from anon, authenticated;
grant select on public.tabletop_dice_rolls to authenticated;

create or replace function public.roll_tabletop_dice(
  p_campaign_id uuid,
  p_sides integer,
  p_quantity integer
)
returns table (
  id uuid,
  campaign_id uuid,
  roller_user_id uuid,
  roller_role text,
  sides integer,
  quantity integer,
  results integer[],
  total integer,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_results integer[] := array[]::integer[];
  v_roll integer;
  v_total integer;
  v_inserted public.tabletop_dice_rolls;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;
  if p_sides not in (4, 6, 8, 10, 12, 20, 100) then
    raise exception 'Unsupported die';
  end if;
  if p_quantity not between 1 and 20 then
    raise exception 'Dice quantity must be between 1 and 20';
  end if;

  select cm.role into v_role
  from public.campaign_members cm
  where cm.campaign_id = p_campaign_id and cm.user_id = (select auth.uid());
  if v_role not in ('OWNER', 'DM', 'PLAYER') then
    raise exception 'Campaign member permission required';
  end if;

  for i in 1..p_quantity loop
    v_roll := floor(random() * p_sides + 1)::integer;
    v_results := array_append(v_results, v_roll);
  end loop;
  select coalesce(sum(result), 0) into v_total from unnest(v_results) as result;

  insert into public.tabletop_dice_rolls(campaign_id, roller_user_id, roller_role, sides, quantity, results, total)
  values (p_campaign_id, (select auth.uid()), v_role, p_sides, p_quantity, v_results, v_total)
  returning * into v_inserted;

  return query select v_inserted.id, v_inserted.campaign_id, v_inserted.roller_user_id, v_inserted.roller_role, v_inserted.sides, v_inserted.quantity, v_inserted.results, v_inserted.total, v_inserted.created_at;
end;
$$;

revoke all on function public.roll_tabletop_dice(uuid, integer, integer) from public, anon;
grant execute on function public.roll_tabletop_dice(uuid, integer, integer) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tabletop_dice_rolls'
  ) then
    alter publication supabase_realtime add table public.tabletop_dice_rolls;
  end if;
end $$;

-- Short-lived visual events are persisted only to relay them through Realtime.
-- RLS validates that the attacker is a DM-controlled token or the caller's player token.
create table public.tabletop_animation_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  attacker_token_id uuid not null references public.tokens(id) on delete cascade,
  target_token_id uuid not null references public.tokens(id) on delete cascade,
  preset text not null check (preset in ('MELEE', 'RANGED', 'SPELL')),
  created_at timestamptz not null default now()
);

create index tabletop_animation_events_campaign_created_idx on public.tabletop_animation_events(campaign_id, created_at desc);

alter table public.tabletop_animation_events enable row level security;

create policy tabletop_animation_events_member_select on public.tabletop_animation_events
for select to authenticated
using ((select private.is_campaign_member(campaign_id)));

create policy tabletop_animation_events_controlled_attacker_insert on public.tabletop_animation_events
for insert to authenticated
with check (
  (select private.is_campaign_member(campaign_id))
  and exists (
    select 1
    from public.tokens attacker
    join public.tokens target on target.id = tabletop_animation_events.target_token_id
    join public.scenes scene on scene.id = attacker.scene_id
    where attacker.id = tabletop_animation_events.attacker_token_id
      and target.scene_id = attacker.scene_id
      and scene.campaign_id = tabletop_animation_events.campaign_id
      and (
        (select private.has_campaign_role(tabletop_animation_events.campaign_id, array['OWNER', 'DM']))
        or (attacker.type = 'PLAYER' and attacker.owner_user_id = (select auth.uid()))
      )
  )
);

grant select, insert on public.tabletop_animation_events to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tabletop_animation_events'
  ) then
    alter publication supabase_realtime add table public.tabletop_animation_events;
  end if;
end $$;

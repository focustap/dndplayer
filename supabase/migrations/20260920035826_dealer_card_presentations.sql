-- Card presentation is attached to existing combat; no creature/rules writes.
create table public.combat_card_decks (
  combat_session_id uuid primary key references public.combat_sessions(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  version integer not null check (version > 0),
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  updated_at timestamptz not null default now()
);
create table public.combat_card_presentations (
  combat_session_id uuid primary key references public.combat_sessions(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  version integer not null check (version > 0),
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  updated_at timestamptz not null default now()
);
create index combat_card_decks_campaign_idx on public.combat_card_decks(campaign_id);
create index combat_card_presentations_campaign_idx on public.combat_card_presentations(campaign_id);
alter table public.combat_card_decks enable row level security;
alter table public.combat_card_presentations enable row level security;
revoke all on public.combat_card_decks, public.combat_card_presentations from anon, authenticated;
grant select, insert, update on public.combat_card_decks, public.combat_card_presentations to authenticated;
create policy combat_card_decks_dm on public.combat_card_decks for all to authenticated
using ((select private.has_campaign_role(campaign_id,array['OWNER','DM'])))
with check ((select private.has_campaign_role(campaign_id,array['OWNER','DM'])) and exists (
  select 1 from public.combat_sessions c where c.id=combat_session_id and c.campaign_id=combat_card_decks.campaign_id
));
create policy combat_card_presentations_dm on public.combat_card_presentations for all to authenticated
using ((select private.has_campaign_role(campaign_id,array['OWNER','DM'])))
with check ((select private.has_campaign_role(campaign_id,array['OWNER','DM'])) and exists (
  select 1 from public.combat_sessions c where c.id=combat_session_id and c.campaign_id=combat_card_presentations.campaign_id
));
create policy combat_card_presentations_member on public.combat_card_presentations for select to authenticated
using ((select private.is_campaign_member(campaign_id)) and exists (
  select 1 from public.combat_sessions c where c.id=combat_session_id and c.campaign_id=combat_card_presentations.campaign_id and c.active
));

-- Invoker rights preserve ordinary RLS. Locking the combat row also serializes
-- two first-time starts. A stale UI cannot silently replace another DM's deal.
create function public.save_combat_cards(p_combat_session_id uuid, p_version integer, p_state jsonb)
returns public.combat_card_presentations language plpgsql security invoker set search_path = '' as $$
declare
  c public.combat_sessions;
  old_version integer;
  exposed jsonb;
  presentation jsonb;
  result public.combat_card_presentations;
  stamp timestamptz := clock_timestamp();
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into c from public.combat_sessions where id=p_combat_session_id for update;
  if c.id is null or not private.has_campaign_role(c.campaign_id,array['OWNER','DM']) then
    raise exception 'DM permission required';
  end if;
  if not c.active then raise exception 'Combat has ended'; end if;
  select version into old_version from public.combat_card_decks where combat_session_id=c.id;
  if coalesce(old_version,0) <> p_version then raise exception 'Cards changed in another session. Reload and retry.'; end if;
  if p_state->>'preset' is distinct from 'The Dealer — 12 Card Deck'
    or jsonb_typeof(p_state->'draw') is distinct from 'array'
    or jsonb_typeof(p_state->'discard') is distinct from 'array'
    or jsonb_typeof(p_state->'burned') is distinct from 'array'
    or jsonb_typeof(p_state->'active') is distinct from 'object'
    or jsonb_typeof(p_state->'assets') is distinct from 'object'
    or (p_state->>'round')::integer < 1
    or octet_length(p_state::text) > 131072 then raise exception 'Invalid card presentation state'; end if;
  select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into exposed
    from jsonb_each(p_state->'active') where value->>'revealed'='true';
  -- Explicit allowlist: no draw order, preview, queue or research notes reach players.
  presentation := jsonb_build_object(
    'preset',p_state->'preset','round',p_state->'round','phase',p_state->'phase',
    'phaseTwoNext',p_state->'phaseTwoNext','stage',p_state->'stage',
    'active',exposed,'pending',p_state->'pending',
    'drawCount',jsonb_array_length(p_state->'draw'),
    'discardCount',jsonb_array_length(p_state->'discard'),
    'burned',p_state->'burned','assets',p_state->'assets','reveal',p_state->'reveal'
  );
  insert into public.combat_card_decks values(c.id,c.campaign_id,p_version+1,p_state,stamp)
    on conflict(combat_session_id) do update set version=excluded.version,state=excluded.state,updated_at=excluded.updated_at;
  insert into public.combat_card_presentations values(c.id,c.campaign_id,p_version+1,presentation,stamp)
    on conflict(combat_session_id) do update set version=excluded.version,state=excluded.state,updated_at=excluded.updated_at
    returning * into result;
  return result;
end $$;
revoke all on function public.save_combat_cards(uuid,integer,jsonb) from public, anon;
grant execute on function public.save_combat_cards(uuid,integer,jsonb) to authenticated;
alter publication supabase_realtime add table public.combat_card_presentations;

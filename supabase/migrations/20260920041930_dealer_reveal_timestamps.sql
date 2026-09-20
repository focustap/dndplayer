-- Preserve the timestamp of the last reveal across unrelated control changes.
create or replace function public.save_combat_cards(p_combat_session_id uuid, p_version integer, p_state jsonb)
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
    on conflict(combat_session_id) do update set version=excluded.version,state=excluded.state,updated_at=case
      when combat_card_presentations.state->'reveal'->>'sequence' = excluded.state->'reveal'->>'sequence'
      then combat_card_presentations.updated_at else excluded.updated_at end
    returning * into result;
  return result;
end $$;

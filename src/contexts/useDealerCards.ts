import { useCallback, useEffect, useRef, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { dealerCardService } from '../services/dealerCardService';
import { campaignCardArtworkService } from '../services/campaignCardArtworkService';
import { newDealerDeck, reduceDealerDeck, type DealerCommand, type DealerSnapshot } from '../domain/dealerCards';

export function useDealerCards(combatId: string | undefined, dm: boolean, campaignId?: string) {
  const [snapshot, setSnapshot] = useState<DealerSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const latest = useRef<DealerSnapshot | null>(null);
  const saving = useRef(false);
  const generation = useRef(0);
  const invalidate = useCallback(() => { generation.current++; }, []);
  const accept = useCallback((next: DealerSnapshot | null) => {
    if (!next && latest.current) return; // An earlier empty read cannot erase a newly saved deal.
    if (next && latest.current && next.version < latest.current.version) return;
    latest.current = next; setSnapshot(next);
  }, []);
  const reload = useCallback(async () => {
    if (!combatId || combatId === 'none' || !isSupabaseConfigured) return;
    const started = generation.current;
    try {
      const next = await dealerCardService.load(combatId, dm);
      if (started !== generation.current) return;
      accept(next); setError(null);
    } catch (e) { if (started === generation.current) setError(e instanceof Error ? e.message : String(e)); }
  }, [combatId, dm, accept]);
  useEffect(() => {
    invalidate(); latest.current = null;
    // State belongs to a combat session; never display another session's cards.
    const timer = window.setTimeout(() => { setSnapshot(null); setError(null); void reload(); }, 0);
    if (!combatId || combatId === 'none' || !isSupabaseConfigured) return () => window.clearTimeout(timer);
    const channel = supabase.channel(`dealer-cards:${combatId}:${dm}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'combat_card_presentations', filter: `combat_session_id=eq.${combatId}` }, () => void reload())
      .subscribe(status => { setConnected(status === 'SUBSCRIBED'); if (status === 'SUBSCRIBED') void reload(); });
    const refresh = () => { if (document.visibilityState === 'visible') void reload(); };
    window.addEventListener('online', refresh); document.addEventListener('visibilitychange', refresh);
    return () => { invalidate(); window.clearTimeout(timer); void supabase.removeChannel(channel); window.removeEventListener('online', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [combatId, dm, reload, invalidate]);
  const command = useCallback(async (action: DealerCommand) => {
    if (!dm || !combatId || saving.current) return;
    saving.current = true; setBusy(true); setError(null);
    const started = generation.current;
    try {
      if (!latest.current && action.type !== 'reset') throw new Error('Start the Dealer card encounter first.');
      const deck = reduceDealerDeck(latest.current?.deck ?? newDealerDeck(), action);
      if (action.type === 'reset' && campaignId) deck.assets = { ...deck.assets, ...(await campaignCardArtworkService.deck(campaignId)) };
      const next = await dealerCardService.save(combatId, latest.current?.version ?? 0, deck);
      if (started === generation.current) accept(next);
    } catch (e) {
      await reload();
      if (started === generation.current) setError(e instanceof Error ? e.message : String(e));
    } finally { saving.current = false; setBusy(false); }
  }, [combatId, dm, campaignId, accept, reload]);
  return { snapshot, error, busy, connected, command, reload };
}

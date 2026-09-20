import { supabase } from '../lib/supabase';
import type { DealerDeck, DealerPublic, DealerSnapshot } from '../domain/dealerCards';

interface CardRow { version: number; updated_at: string; state: DealerPublic; }
export const dealerCardService = {
  async load(combatId: string, dm: boolean, attempt = 0): Promise<DealerSnapshot | null> {
    const { data, error } = await supabase.from('combat_card_presentations').select('version,updated_at,state').eq('combat_session_id', combatId).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    let deck: DealerDeck | null = null;
    if (dm) {
      const privateResult = await supabase.from('combat_card_decks').select('version,state').eq('combat_session_id', combatId).single();
      if (privateResult.error) throw privateResult.error;
      // A write between reads should be retried, never paired with an old revision.
      if (privateResult.data.version !== data.version) {
        if (attempt >= 3) throw new Error('Cards are changing in another session. Retry in a moment.');
        return this.load(combatId, dm, attempt + 1);
      }
      deck = privateResult.data.state as DealerDeck;
    }
    return { version: data.version, updatedAt: data.updated_at, public: data.state as DealerPublic, deck };
  },
  async save(combatId: string, version: number, deck: DealerDeck): Promise<DealerSnapshot> {
    const { data, error } = await supabase.rpc('save_combat_cards', { p_combat_session_id: combatId, p_version: version, p_state: deck });
    if (error) throw error;
    const row = data as CardRow;
    return { version: row.version, updatedAt: row.updated_at, public: row.state, deck };
  },
};

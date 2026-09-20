import { supabase } from '../lib/supabase';
import { r2AssetService } from './r2AssetService';
import { DEALER_CARDS, type CardId } from '../domain/dealerCards';

export const CARD_ART_KEYS = ['redClue', 'nineClue', 'heartsClue', 'jester', ...DEALER_CARDS.map(c => c.id)] as const;
export type CardArtKey = typeof CARD_ART_KEYS[number];
export const cardArtCategory = (key: CardArtKey) => key === 'jester' ? 'monster-templates' : key.endsWith('Clue') ? 'discoverables' : 'dealer-cards';

export const campaignCardArtworkService = {
  async load(campaignId: string): Promise<Partial<Record<CardArtKey, string>>> {
    const { data, error } = await supabase.from('campaign_card_artwork').select('asset_key,storage_path').eq('campaign_id', campaignId);
    if (error) throw error;
    return Object.fromEntries((data ?? []).map(row => [row.asset_key, row.storage_path]));
  },
  async upload(campaignId: string, key: CardArtKey, file: File): Promise<string> {
    if (!file.type.startsWith('image/')) throw new Error('Choose an image file.');
    const asset = await r2AssetService.upload(campaignId, cardArtCategory(key), file);
    if (!asset.path.startsWith(`${campaignId}/`)) throw new Error('Worker returned an unexpected asset path.');
    const { error } = await supabase.from('campaign_card_artwork').upsert({ campaign_id: campaignId, asset_key: key, storage_path: asset.path, updated_at: new Date().toISOString() });
    if (error) throw error;
    return asset.path;
  },
  async deck(campaignId: string): Promise<Partial<Record<CardId, string>>> {
    const all = await this.load(campaignId);
    return Object.fromEntries(DEALER_CARDS.flatMap(c => all[c.id] ? [[c.id, all[c.id]]] : []));
  },
};

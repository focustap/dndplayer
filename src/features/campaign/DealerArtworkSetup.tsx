import { useEffect, useState } from 'react';
import { CARD_ART_KEYS, campaignCardArtworkService, type CardArtKey } from '../../services/campaignCardArtworkService';

const label: Record<CardArtKey, string> = {
  redClue: 'Arcana clue · RED', nineClue: 'Graveyard clue · 9', heartsClue: 'Civic Hall portrait · HEARTS', jester: 'Jester token',
  blade: 'Blade', glass: 'Glass', saint: 'Saint', 'dead-man': 'Dead Man', crown: 'Crown', chains: 'Chains', mirror: 'Mirror', miser: 'Miser', fool: 'Fool', duelist: 'Duelist', hound: 'Hound', debt: 'Debt',
};

export function DealerArtworkSetup({ campaignId, dm }: { campaignId: string; dm: boolean }) {
  const [paths, setPaths] = useState<Partial<Record<CardArtKey, string>>>({});
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  useEffect(() => { if (dm) void campaignCardArtworkService.load(campaignId).then(setPaths).catch(e => setStatus(String(e))); }, [campaignId, dm]);
  if (!dm) return <p>Only the DM can manage Dealer artwork.</p>;
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const selected = Array.from(files).map(file => ({ file, key: file.name.replace(/\.[^.]+$/, '') as CardArtKey }));
    if (selected.some(({ key }) => !CARD_ART_KEYS.includes(key))) { setStatus('Name each image for its asset key: redClue, nineClue, heartsClue, jester, or a card ID.'); return; }
    setBusy(true);
    try {
      for (const { file, key } of selected) {
        setStatus(`Uploading ${label[key]}…`);
        const path = await campaignCardArtworkService.upload(campaignId, key, file);
        setPaths(previous => ({ ...previous, [key]: path }));
      }
      setStatus(`Uploaded ${selected.length} image${selected.length === 1 ? '' : 's'} to R2.`);
    } catch (e) { setStatus(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  return <section className="editor-card"><h2>Dealer artwork</h2><p>Upload the three physical clues, Jester token, and twelve card faces through Wayfinder’s authenticated R2 Worker. Name the files by asset key; each returned path is saved for this campaign. Card faces load automatically when a new Dealer card encounter starts.</p>
    <label className="form-field"><span>Artwork files</span><input aria-label="Upload Dealer artwork" type="file" accept="image/*" multiple disabled={busy} onChange={event => void upload(event.target.files)} /></label>
    {status && <p role="status">{status}</p>}
    <ul>{CARD_ART_KEYS.map(key => <li key={key}><strong>{label[key]}</strong>: {paths[key] ? 'Uploaded to R2' : 'Missing'} <small>{paths[key]}</small></li>)}</ul>
  </section>;
}

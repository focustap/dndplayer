import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useTabletop } from '../../contexts/TabletopContext';
import { useAuth } from '../../contexts/AuthContext';
import { cardDefinition, CARD_REMINDER, DEALER_CARDS, type ActiveCard, type CardHolder, type CardId, type HeldCard } from '../../domain/dealerCards';
import { isDmRole } from '../../domain/types';
import { r2AssetService } from '../../services/r2AssetService';
import { campaignCardArtworkService } from '../../services/campaignCardArtworkService';
import { serverNowMs } from '../../services/tabletopService';
import './dealerCards.css';

function CardFace({ card, path, campaignId }: { card: HeldCard; path?: string; campaignId: string }) {
  const [image, setImage] = useState<{ path: string; url: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (path) void r2AssetService.sign(campaignId, path).then(result => { if (!cancelled && result) setImage({ path, url: result.url }); }).catch(() => { /* Printed card remains fully usable. */ });
    return () => { cancelled = true; };
  }, [campaignId, path]);
  const definition = cardDefinition(card);
  return <article className="dealer-card-face">
    <span className="dealer-card-corner" aria-hidden="true">{definition.symbol}</span>
    {image?.path === path && image ? <img src={image.url} alt={`${definition.name} card artwork`} /> : <div className="dealer-card-illustration" aria-hidden="true">{definition.symbol}</div>}
    <small>THE DEALER</small><h2>{definition.name}</h2><p>{definition.rule}</p>
    <span className="dealer-card-seal" aria-hidden="true">✦</span>
  </article>;
}

function CardDetail({ card, path, campaignId, close }: { card: HeldCard; path?: string; campaignId: string; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="dealer-detail" aria-label={`${cardDefinition(card).name} card`} onCancel={close}>
    <div><button onClick={close}>Close card</button><CardFace card={card} path={path} campaignId={campaignId} /><p>{CARD_REMINDER}</p></div>
  </dialog>;
}

export function DealerCardReveal() {
  const { state, dealerCards } = useTabletop();
  const { user } = useAuth();
  const [show, setShow] = useState<{ cards: ActiveCard[]; elapsed: number; key: string } | null>(null);
  const seen = useRef('');
  const timers = useRef<number[]>([]);
  useEffect(() => () => { timers.current.forEach(window.clearTimeout); }, []);
  const snapshot = dealerCards.snapshot;
  useEffect(() => {
    if (!snapshot || !state?.combat.active) return;
    const key = `${state.combat.id}:${snapshot.public.reveal.sequence}`;
    if (seen.current === key) return;
    seen.current = key;
    timers.current.forEach(window.clearTimeout);
    const clear = () => { timers.current = [window.setTimeout(() => setShow(null), 0)]; };
    const elapsed = serverNowMs() - (Date.parse(snapshot.updatedAt) + 700);
    if (elapsed > 6500) { clear(); return; } // Reconnect restores the badge, not stale cinematics.
    const cards = snapshot.public.reveal.holders.map(id => snapshot.public.active[id]).filter((a): a is ActiveCard => Boolean(a));
    const relevant = cards.filter(a => a.holder.ownerId === user?.id || !a.holder.ownerId);
    const visible = relevant.length ? relevant.sort((a, b) => Number(b.holder.ownerId === user?.id) - Number(a.holder.ownerId === user?.id)) : cards;
    if (!visible.length) { clear(); return; }
    const start = window.setTimeout(() => setShow({ cards: visible, elapsed: Math.max(0, elapsed), key }), Math.max(0, -elapsed));
    const stop = window.setTimeout(() => setShow(current => current?.key === key ? null : current), Math.max(0, 6500 - elapsed));
    timers.current = [start, stop];
  }, [snapshot, state?.combat.active, state?.combat.id, user?.id]);
  if (!show || !state || !snapshot || !state.combat.active) return null;
  const cards = show.cards.filter(a => snapshot.public.active[a.holder.id]?.card === a.card);
  if (!cards.length) return null;
  return <div className="dealer-reveal" key={show.key} style={{ '--deal-elapsed': `-${show.elapsed}ms` } as CSSProperties} aria-live="polite">
    <div className="dealer-reveal-heading">Every game has rules. <small>Round {snapshot.public.round}</small></div>
    <div className="dealer-reveal-cards">{cards.map(a => <div key={a.holder.id} className="dealer-flip"><strong>{a.holder.name}</strong><CardFace card={a.card} path={snapshot.public.assets[a.card as CardId]} campaignId={state.campaign.id} /></div>)}</div>
  </div>;
}


export function DealerCardBuilderPreview() {
  const { state } = useTabletop();
  const [assets, setAssets] = useState<Partial<Record<CardId, string>>>({});
  const [selected, setSelected] = useState<CardId>('blade');
  const [showGallery, setShowGallery] = useState(false);
  const [reveal, setReveal] = useState<{ card: CardId; key: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!state?.campaign.id) return;
    void campaignCardArtworkService.deck(state.campaign.id)
      .then(result => { if (!cancelled) setAssets(result); })
      .catch(() => { if (!cancelled) setAssets({}); });
    return () => { cancelled = true; };
  }, [state?.campaign.id]);

  if (!state) return null;
  const loaded = DEALER_CARDS.filter(card => Boolean(assets[card.id])).length;
  const previewReveal = () => {
    setReveal({ card: selected, key: Date.now() });
    window.setTimeout(() => setReveal(current => current?.card === selected ? null : current), 6500);
  };

  return <>
    <div className="dealer-builder-preview">
      <div className="dealer-builder-preview-heading">
        <strong>Dealer card preview</strong>
        <small>{loaded}/12 artwork loaded</small>
      </div>
      <div className="dealer-builder-preview-row">
        <select aria-label="Dealer card to preview" value={selected} onChange={event => setSelected(event.target.value as CardId)}>
          {DEALER_CARDS.map(card => <option key={card.id} value={card.id}>{card.name}</option>)}
        </select>
        <button onClick={previewReveal}>Preview reveal</button>
        <button onClick={() => setShowGallery(true)}>View all 12</button>
      </div>
    </div>

    {reveal && <div className="dealer-reveal dealer-builder-reveal" key={reveal.key} aria-live="polite">
      <div className="dealer-reveal-heading">Every game has rules. <small>Preview</small></div>
      <div className="dealer-reveal-cards">
        <div className="dealer-flip">
          <strong>Player preview</strong>
          <CardFace card={reveal.card} path={assets[reveal.card]} campaignId={state.campaign.id} />
        </div>
      </div>
    </div>}

    {showGallery && <div className="dealer-gallery-backdrop">
      <section className="dealer-gallery" role="dialog" aria-modal="true" aria-label="Dealer card artwork preview">
        <header><div><strong>Dealer deck artwork</strong><small>{loaded}/12 uploaded</small></div><button onClick={() => setShowGallery(false)}>Close</button></header>
        <div className="dealer-gallery-grid">
          {DEALER_CARDS.map(card => <button key={card.id} className={selected === card.id ? "selected" : ""} onClick={() => setSelected(card.id)}>
            <CardFace card={card.id} path={assets[card.id]} campaignId={state.campaign.id} />
          </button>)}
        </div>
      </section>
    </div>}
  </>;
}

export function DealerCards() {
  const { state, playerView, dealerCards } = useTabletop();
  const { user } = useAuth();
  const { snapshot, command, busy, error, connected } = dealerCards;
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<HeldCard | null>(null);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [burn, setBurn] = useState<CardId>('blade');
  const [artCard, setArtCard] = useState<CardId>('blade');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const holders = useMemo((): CardHolder[] => (state?.combat.entries ?? []).flatMap(entry => {
    const token = state?.tokens.find(t => t.id === entry.tokenId);
    const ownerId = token?.ownerUserId ?? state?.characters.find(c => c.id === entry.characterId)?.ownerId ?? null;
    return Array.from({ length: Math.max(1, entry.groupCount) }, (_, i) => ({ id: i ? `${entry.id}:${i}` : entry.id, name: entry.groupCount > 1 ? `${entry.name} ${i + 1}` : entry.name, ownerId, tokenId: entry.tokenId }));
  }), [state?.combat.entries, state?.tokens, state?.characters]);
  if (!state?.combat.active) return null;
  const dm = isDmRole(state.role) && !playerView && !state.previewPlayerView;
  if (!dm && !snapshot) return null;
  const deck = snapshot?.deck;
  const publicState = snapshot?.public;
  const active = Object.values(publicState?.active ?? {});
  const run = (action: Parameters<typeof command>[0]) => void command(action);
  const own = active.filter(a => a.holder.ownerId === user?.id);
  const upload = async (file: File | undefined) => {
    if (!file || !dm) return;
    setUploading(true); setUploadError(null);
    try { const path = await campaignCardArtworkService.upload(state.campaign.id, artCard, file); await command({ type: 'art', card: artCard, path }); }
    catch (e) { setUploadError(e instanceof Error ? e.message : String(e)); }
    finally { setUploading(false); }
  };
  const uploadDeck = async (files: FileList | null) => {
    if (!files?.length || !dm) return;
    setUploading(true); setUploadError(null);
    try {
      const selected = Array.from(files).map(file => ({ file, card: DEALER_CARDS.find(c => c.id === file.name.replace(/\.[^.]+$/, '').toLowerCase()) }));
      if (selected.some(item => !item.card) || new Set(selected.map(item => item.card?.id)).size !== selected.length) throw new Error('Use card IDs as filenames, such as blade.png and dead-man.png; select each card once.');
      const assets: Partial<Record<CardId, string>> = {};
      for (const { file, card } of selected) assets[card!.id] = await campaignCardArtworkService.upload(state.campaign.id, card!.id, file);
      await command({ type: 'art-batch', assets });
    } catch (e) { setUploadError(e instanceof Error ? e.message : String(e)); }
    finally { setUploading(false); }
  };
  return <>
    <aside className="dealer-card-dock" aria-label="Dealer Cards">
      <button className="dealer-dock-toggle" onClick={() => setOpen(!open)}>♠ {dm ? 'Dealer Cards' : 'Active Cards'} {publicState && <small>Round {publicState.round} · Phase {publicState.phase}</small>}</button>
      {!dm && own.map(a => <button key={a.holder.id} onClick={() => setDetail(a.card)}>{a.holder.name} · {cardDefinition(a.card).name}</button>)}
      {!open && publicState?.pending && <button onClick={() => setOpen(true)}>{publicState.pending.holder.name} · two cards exposed</button>}
      {open && <div className="dealer-controls">
        <header><strong>The Dealer — 12 Card Deck</strong><span>{connected ? 'Live' : 'Reconnecting…'}</span></header>
        <p className="dealer-manual">Presentation only. Apply all card effects manually.</p>
        {error && <p role="alert">{error} <button onClick={() => void dealerCards.reload()}>Retry</button></p>}
        {dm && <fieldset disabled={busy || uploading}>
          {!deck ? <button disabled={!holders.length} onClick={() => run({ type: 'reset', round: state.combat.round })}>Start Dealer encounter</button> : <>
            <div className="dealer-piles"><span>Draw <b>{deck.draw.length}</b></span><span>Discard <b>{deck.discard.length}</b></span><span>Burned <b>{deck.burned.length}</b></span></div>
            {deck.round !== state.combat.round && <p role="status">Card round {deck.round}; initiative round {state.combat.round}. Expire cards before the next round’s deal. Initiative remains under your control.</p>}
            <div className="dealer-actions">
              {deck.stage === 'dealing' && !deck.pending && <button onClick={() => run({ type: 'next-pair' })}>Expose next pair</button>}
              <button disabled={deck.stage !== 'between' || Boolean(deck.preview)} onClick={() => run({ type: 'deal', holders: holders.filter(h => !excluded.includes(h.id)) })}>Deal Round</button>
              <button disabled={deck.stage !== 'active'} onClick={() => run({ type: 'expire' })}>End round / expire</button>
              <button disabled={deck.stage !== 'between' || Boolean(deck.preview)} onClick={() => run({ type: 'shuffle' })}>Shuffle draw pile</button>
              <button disabled={deck.phase === 2 || deck.phaseTwoNext} onClick={() => run({ type: 'phase-two' })}>{deck.phaseTwoNext ? 'Phase Two next round' : 'Enter Phase Two next round'}</button>
            </div>
            <details><summary>Participants · initiative order</summary>{holders.map(h => <label key={h.id}><input type="checkbox" checked={!excluded.includes(h.id)} onChange={() => setExcluded(list => list.includes(h.id) ? list.filter(id => id !== h.id) : [...list, h.id])} />{h.name}{deck.stage === 'active' && !deck.active[h.id] && <button onClick={() => run({ type: 'entrant', holder: h })}>Deal entrant</button>}</label>)}<p>Include the Dealer, participating pets, allies and summons. Keep nonparticipating Dog outside.</p></details>
            <details><summary>Research &amp; interventions · {deck.interventions}/2 this round</summary>
              <p>Set only charges the party earned. One intervention per creature’s draw; resolve before turns. Duplicate sources do not add charges.</p>
              {(['read', 'objection', 'burn', 'cut'] as const).map(key => <label key={key}>{({ read: 'Read the Back', objection: 'Objection', burn: 'Burn a Card', cut: 'Cut the Deck' })[key]}<input aria-label={`${key} charges`} type="number" min="0" max={key === 'burn' || key === 'cut' ? 1 : 2} value={deck.charges[key]} onChange={e => run({ type: 'charges', charges: { ...deck.charges, [key]: Number(e.target.value) } })} /></label>)}
              <button disabled={deck.stage !== 'between' || !deck.charges.read || !!deck.preview || deck.interventions >= 2} onClick={() => run({ type: 'read' })}>Read the Back</button>
              {deck.preview && <div className="dealer-preview"><p>Next cards: {deck.preview.map(c => cardDefinition(c).name).join(' → ') || 'Neutral blanks'}</p><button onClick={() => run({ type: 'reverse' })}>Reverse next two</button><button onClick={() => run({ type: 'finish-read' })}>Keep this order</button></div>}
              <label>Burn a Card<select value={burn} onChange={e => setBurn(e.target.value as CardId)}>{DEALER_CARDS.map(c => <option key={c.id} value={c.id}>{c.name}{deck.burned.includes(c.id) ? ' · burned' : ''}</option>)}</select></label>
              <button disabled={deck.stage !== 'between' || !!deck.preview || !deck.charges.burn || deck.interventions >= 2 || !(deck.draw.includes(burn) || deck.discard.includes(burn))} onClick={() => run({ type: 'burn', card: burn })}>Permanently burn selected</button>
              <p>Placard: set Objection to 1 if none learned. One character may spend an action to earn one additional Objection, once per fight.</p><button disabled={deck.fallbackUsed} onClick={() => run({ type: 'fallback' })}>Record action → +1 Objection</button>
            </details>
            <details><summary>Piles &amp; artwork</summary><p>Discard: {deck.discard.map(c => cardDefinition(c).name).join(', ') || 'Empty'}</p><p>Burned: {deck.burned.map(c => cardDefinition(c).name).join(', ') || 'None'}</p>
              <label>Card artwork<select value={artCard} onChange={e => setArtCard(e.target.value as CardId)}>{DEALER_CARDS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><input aria-label="Upload card artwork to R2" type="file" accept="image/*" onChange={e => void upload(e.target.files?.[0])} /></label>{uploadError && <p role="alert">{uploadError}</p>}
              <label>Upload deck artwork<input aria-label="Upload deck artwork to R2" type="file" accept="image/*" multiple onChange={e => void uploadDeck(e.target.files)} /></label><p>Name files blade.png, glass.png, saint.png, dead-man.png, crown.png, chains.png, mirror.png, miser.png, fool.png, duelist.png, hound.png and debt.png. Artwork persists through refresh and reset.</p>
            </details>
            <details><summary>Reset encounter</summary><p>Returns every card, clears research charges and starts Phase One. Creature statistics are untouched.</p><button onClick={() => run({ type: 'reset', round: state.combat.round })}>Reset all Dealer cards</button></details>
          </>}
        </fieldset>}
        {publicState?.pending && <section className="dealer-pair"><h3>{publicState.pending.holder.name} · exposed pair</h3><p>{publicState.pending.cut ? 'Cut the Deck: ask the holder to choose (party chooses for the Dealer).' : 'The Dealer / DM chooses which card is kept.'}</p>{publicState.pending.cards.map((c, index) => <div key={index}><button onClick={() => setDetail(c)}>{cardDefinition(c).name} · read</button>{dm && <button disabled={busy} onClick={() => run({ type: 'choose', index: index as 0 | 1 })}>Keep {cardDefinition(c).name}</button>}</div>)}{dm && <button disabled={busy || !deck?.charges.cut || publicState.pending.cut || (deck?.interventions ?? 2) >= 2 || deck?.intervened.includes(publicState.pending.holder.id)} onClick={() => run({ type: 'cut' })}>Cut the Deck · holder chooses</button>}</section>}
        {active.map(a => <div className={`dealer-active-row${a.holder.ownerId === user?.id ? ' own' : ''}`} key={a.holder.id}><button onClick={() => setDetail(a.card)}><strong>{a.holder.name}</strong><span>{cardDefinition(a.card).name}</span></button>{dm && <div><button disabled={busy || !deck?.charges.objection || (deck?.interventions ?? 2) >= 2 || deck?.intervened.includes(a.holder.id)} onClick={() => run({ type: 'objection', holderId: a.holder.id })}>Objection</button><button disabled={busy} onClick={() => run({ type: 'replay', holderId: a.holder.id })}>Reveal / replay</button><button disabled={busy} onClick={() => run({ type: 'clear', holderId: a.holder.id })}>Clear</button></div>}</div>)}
        {publicState && !active.length && !publicState.pending && <p>Between rounds. No active cards.</p>}
      </div>}
    </aside>
    {detail && <CardDetail card={detail} path={publicState?.assets[detail as CardId]} campaignId={state.campaign.id} close={() => setDetail(null)} />}
  </>;
}

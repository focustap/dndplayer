// Presentation state only. This module never changes a creature's statistics.
export const DEALER_CARDS = [
  { id: 'blade', name: 'Blade', symbol: '⚔', rule: 'First melee hit on your turn adds 1d6 original-type damage. Cannot make ranged attacks; save spells and utility still work.' },
  { id: 'glass', name: 'Glass', symbol: '◇', rule: 'Once on your turn, add 1d6 to one damage roll. First damage you take this round adds 1d6 of that damage type. No bonus from reflected damage.' },
  { id: 'saint', name: 'Saint', symbol: '✦', rule: 'Cannot deal damage, including ongoing effects you control. Healing dice maximized. May use action to touch a creature (including self) restoring 8 HP, once per holder/round. Help, Dodge and nondamaging control allowed.' },
  { id: 'dead-man', name: 'Dead Man', symbol: '☾', rule: 'Optional: disappear until START of your turn this round, then return to same/nearest safe free space and take full turn. While absent cannot act, affect play or be targeted; concentration persists, controlled ongoing effects pause. May decline.' },
  { id: 'crown', name: 'Crown', symbol: '♛', rule: 'Advantage on your attacks; attacks against you have advantage. Normal cancellation applies.' },
  { id: 'chains', name: 'Chains', symbol: '∞', rule: 'Speed 0; immune to forced movement and being knocked prone. Teleportation allowed. If already prone, cannot stand until expiration. Actions remain available.' },
  { id: 'mirror', name: 'Mirror', symbol: '◈', rule: 'First OTHER creature damaging you takes 1d6 force afterward, no reaction. Cannot trigger Mirror, Glass, Debt or any other card; self-cost does not trigger it.' },
  { id: 'miser', name: 'Miser', symbol: '♦', rule: 'Cannot regain HP. First time on your turn you damage another creature, gain 4 temporary HP; do not stack, leftovers expire next round.' },
  { id: 'fool', name: 'Fool', symbol: '☆', rule: 'First natural 1 on an attack becomes 20; first natural 20 becomes 1, each once, only the die used after advantage/disadvantage. Never convert the result again. No saves or death saves affected.' },
  { id: 'duelist', name: 'Duelist', symbol: '⚜', rule: 'Exactly one enemy within 5 ft at attack time: first hit on your turn adds 1d6. Two or more: attacks have disadvantage. None: no effect.' },
  { id: 'hound', name: 'Hound', symbol: '♞', rule: 'Move in straight segments of at least 10 ft before turning; may stop early. After 10 ft voluntary movement on your turn, next hit that turn adds 1d6. No forced movement/teleport credit.' },
  { id: 'debt', name: 'Debt', symbol: '♠', rule: 'First damage to another creature on your turn adds 1d6 to one roll, then lose 2 HP directly, minimum 1 HP. Not damage, ignores temp HP, cannot be reduced or trigger effects.' },
] as const;
export type CardId = typeof DEALER_CARDS[number]['id'];
export type HeldCard = CardId | 'blank';
export const CARD_REMINDER = 'Apply rules manually. Bonus card dice are not doubled by criticals. One held card, no stacking. Cards bind off-turn actions too; normal spell/resource costs remain. Saint suppresses Mirror. Expire card temporary HP and resolve returns at the next round. Cards never wake unconscious creatures or grant extra turns.';
export const cardDefinition = (id: HeldCard) => DEALER_CARDS.find(c => c.id === id) ?? { id: 'blank', name: 'Neutral blank', symbol: '—', rule: 'All available cards are held. This blank has no effect until the next draw.' };
export interface CardHolder { id: string; name: string; ownerId: string | null; tokenId: string | null; }
export interface ActiveCard { holder: CardHolder; card: HeldCard; revealed: boolean; }
export interface CardPair { holder: CardHolder; cards: [HeldCard, HeldCard]; cut: boolean; }
export interface DealerDeck {
  preset: 'The Dealer — 12 Card Deck'; round: number; phase: 1 | 2; phaseTwoNext: boolean;
  stage: 'between' | 'dealing' | 'active'; draw: CardId[]; discard: CardId[]; burned: CardId[];
  active: Record<string, ActiveCard>; pending: CardPair | null; queue: CardHolder[];
  charges: { read: number; objection: number; burn: number; cut: number };
  interventions: number; intervened: string[]; preview: CardId[] | null;
  fallbackUsed: boolean; assets: Partial<Record<CardId, string>>;
  reveal: { sequence: number; holders: string[] };
}
export interface DealerPublic {
  preset: string; round: number; phase: 1 | 2; phaseTwoNext: boolean; stage: DealerDeck['stage'];
  active: Record<string, ActiveCard>; pending: CardPair | null;
  drawCount: number; discardCount: number; burned: CardId[];
  assets: Partial<Record<CardId, string>>; reveal: DealerDeck['reveal'];
}
export interface DealerSnapshot { version: number; updatedAt: string; public: DealerPublic; deck: DealerDeck | null; }
export type DealerCommand =
  | { type: 'reset'; round: number } | { type: 'shuffle' | 'expire' | 'phase-two' | 'read' | 'reverse' | 'finish-read' | 'fallback' | 'next-pair' }
  | { type: 'deal'; holders: CardHolder[] } | { type: 'entrant'; holder: CardHolder }
  | { type: 'choose'; index: 0 | 1 } | { type: 'cut' }
  | { type: 'objection' | 'clear' | 'reveal' | 'replay'; holderId: string }
  | { type: 'burn'; card: CardId }
  | { type: 'charges'; charges: DealerDeck['charges'] }
  | { type: 'art-batch'; assets: Partial<Record<CardId, string>> }
  | { type: 'art'; card: CardId; path: string };

// Rejection sampling avoids modulo bias; phase one never selects a favorable card.
export function shuffled<T>(values: readonly T[]): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const bound = i + 1, limit = Math.floor(0x100000000 / bound) * bound;
    let value: number;
    do { value = crypto.getRandomValues(new Uint32Array(1))[0]; } while (value >= limit);
    const j = value % bound;
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function newDealerDeck(round = 1): DealerDeck {
  return { preset: 'The Dealer — 12 Card Deck', round, phase: 1, phaseTwoNext: false, stage: 'between', draw: shuffled(DEALER_CARDS.map(c => c.id)), discard: [], burned: [], active: {}, pending: null, queue: [], charges: { read: 0, objection: 0, burn: 0, cut: 0 }, interventions: 0, intervened: [], preview: null, fallbackUsed: false, assets: {}, reveal: { sequence: 0, holders: [] } };
}
const requireThat = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
function draw(deck: DealerDeck): HeldCard {
  if (!deck.draw.length) { deck.draw = shuffled(deck.discard); deck.discard = []; }
  return deck.draw.shift() ?? 'blank';
}
function discard(deck: DealerDeck, card: HeldCard) { if (card !== 'blank') deck.discard.push(card); }
function announce(deck: DealerDeck, ids: string[]) { deck.reveal = { sequence: deck.reveal.sequence + 1, holders: ids }; }
function intervention(deck: DealerDeck, kind: keyof DealerDeck['charges'], holder?: string) {
  requireThat(deck.charges[kind] > 0, 'No research charges remaining.');
  requireThat(deck.interventions < 2, 'Only two interventions per round.');
  requireThat(!holder || !deck.intervened.includes(holder), 'Only one intervention per creature’s draw.');
  deck.charges[kind]--; deck.interventions++;
  if (holder) deck.intervened.push(holder);
}
function nextPair(deck: DealerDeck) {
  const holder = deck.queue.shift();
  deck.pending = holder ? { holder, cards: [draw(deck), draw(deck)], cut: false } : null;
  if (!holder) deck.stage = 'active';
}
export function assertDealerDeck(deck: DealerDeck) {
  const cards = [...deck.draw, ...deck.discard, ...deck.burned, ...Object.values(deck.active).map(a => a.card), ...(deck.pending?.cards ?? [])].filter(c => c !== 'blank');
  requireThat(cards.length === 12 && new Set(cards).size === 12 && cards.every(c => DEALER_CARDS.some(d => d.id === c)), 'Deck must contain each canonical card exactly once.');
}
export function reduceDealerDeck(previous: DealerDeck, command: DealerCommand): DealerDeck {
  if (command.type === 'reset') { const fresh = newDealerDeck(command.round); fresh.assets = previous.assets; fresh.reveal.sequence = previous.reveal.sequence + 1; return fresh; }
  const d = structuredClone(previous);
  switch (command.type) {
    case 'shuffle':
      requireThat(d.stage === 'between' && !d.preview, 'Shuffle only between rounds, before Read the Back.'); d.draw = shuffled(d.draw); break;
    case 'expire':
      requireThat(d.stage === 'active', 'Finish the current deal first.');
      Object.values(d.active).forEach(a => discard(d, a.card)); d.active = {}; d.round++; d.stage = 'between'; d.interventions = 0; d.intervened = []; d.preview = null; announce(d, []); break;
    case 'phase-two': d.phaseTwoNext = true; break;
    case 'deal': {
      requireThat(d.stage === 'between' && !d.preview, 'Finish research or expire the previous round first.');
      requireThat(command.holders.length > 0 && new Set(command.holders.map(h => h.id)).size === command.holders.length, 'Choose distinct participating combatants.');
      if (d.phaseTwoNext) { d.phase = 2; d.phaseTwoNext = false; }
      d.stage = 'dealing';
      if (d.phase === 2) { d.queue = command.holders; nextPair(d); }
      else { for (const holder of command.holders) d.active[holder.id] = { holder, card: draw(d), revealed: true }; d.stage = 'active'; announce(d, command.holders.map(h => h.id)); }
      break;
    }
    case 'entrant':
      requireThat(d.stage === 'active' && !d.active[command.holder.id], 'Finish dealing first; entrant must not already hold a card.');
      if (d.phase === 2) { d.stage = 'dealing'; d.queue = [command.holder]; nextPair(d); }
      else { d.active[command.holder.id] = { holder: command.holder, card: draw(d), revealed: true }; announce(d, [command.holder.id]); } break;
    case 'choose': {
      requireThat(d.pending, 'No exposed pair.'); const pair = d.pending!;
      d.active[pair.holder.id] = { holder: pair.holder, card: pair.cards[command.index], revealed: true };
      discard(d, pair.cards[1 - command.index]); announce(d, [pair.holder.id]); d.pending = null; if (!d.queue.length) d.stage = 'active'; break;
    }
    case 'next-pair': requireThat(d.stage === 'dealing' && !d.pending && d.queue.length, 'Resolve the current pair first.'); nextPair(d); break;
    case 'cut': requireThat(d.pending && !d.pending.cut, 'Expose a pair first.'); intervention(d, 'cut', d.pending!.holder.id); d.pending!.cut = true; break;
    case 'read': {
      requireThat(d.stage === 'between' && !d.preview, 'Read the Back before dealing.'); intervention(d, 'read');
      const two = [draw(d), draw(d)].filter((c): c is CardId => c !== 'blank'); d.draw.unshift(...two); d.preview = two; break;
    }
    case 'reverse': requireThat(d.preview, 'Read the Back first.'); d.preview!.reverse(); d.draw.splice(0, d.preview!.length, ...d.preview!); break;
    case 'finish-read': d.preview = null; break;
    case 'objection': {
      const active = d.active[command.holderId]; requireThat(active, 'No kept card to replace.'); intervention(d, 'objection', command.holderId);
      const replacement = draw(d); discard(d, active.card); active.card = replacement; active.revealed = true; announce(d, [command.holderId]); break;
    }
    case 'burn':
      requireThat(d.stage === 'between' && !d.preview, 'Burn between expiration and dealing, before a preview.');
      requireThat(d.draw.includes(command.card) || d.discard.includes(command.card), 'Held or already burned cards cannot be burned.');
      intervention(d, 'burn'); d.draw = d.draw.filter(c => c !== command.card); d.discard = d.discard.filter(c => c !== command.card); d.burned.push(command.card); break;
    case 'clear': {
      const active = d.active[command.holderId]; requireThat(active, 'No active card.'); discard(d, active.card); delete d.active[command.holderId]; announce(d, []); break;
    }
    case 'reveal': case 'replay':
      requireThat(d.active[command.holderId], 'No active card.'); d.active[command.holderId].revealed = true; announce(d, [command.holderId]); break;
    case 'charges':
      requireThat(Object.values(command.charges).every(n => Number.isInteger(n) && n >= 0) && command.charges.read <= 2 && command.charges.objection <= (d.fallbackUsed ? 3 : 2) && command.charges.burn <= 1 && command.charges.cut <= 1, 'Use canonical research charge limits.'); d.charges = command.charges; break;
    case 'fallback': requireThat(!d.fallbackUsed, 'The action-earned fallback is once per fight.'); d.fallbackUsed = true; d.charges.objection++; break;
    case 'art': d.assets[command.card] = command.path; break;
    case 'art-batch': d.assets = { ...d.assets, ...command.assets }; break;
  }
  assertDealerDeck(d); return d;
}

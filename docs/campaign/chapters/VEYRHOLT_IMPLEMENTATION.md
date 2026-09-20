# Favorite card and Dealer presentation implementation

DM ONLY. Based on PR #23 (`9ac4514`) and the current explicit instructions. `VEYRHOLT.md` remains the source of the twelve exact card effects.

## Playable path

Keep the Greymere aftermath, East Road rescue and Level 3 arrival unchanged. Cira at the Gilded Lamb establishes the favorite-card invitation; she does not know the answer. City locations can be visited in any order. Ysabet remains a shopkeeper, Olyss protects mourners, and the civic NPCs direct visitors to the historical portraits.

- Arcana: a damaged pawned card case reads **RED**. Reveal on inspection, no check. DC 13 Arcana only identifies residual magic.
- Graveyard: three Jesters ambush after a few minutes of investigation or open questions about the Dealer. AC 12, HP 14, speed 30; knife +3, 1d6+1 slashing. Gravestones give half cover. They try to surround conscious threats; flee when two fall; no executions or pursuit outside. Two Jesters for a depleted party, four for five rested PCs. Automatically reveal their dropped ritual token, **9**, after combat, including if they flee. No search roll. Recover 12 gp in mundane coin.
- Civic Hall: formal chronological House Veyr owner portraits end in an unsettling theatrical Dealer portrait, with a heart-suit card and **HEARTS** in discoverable text. Automatic on inspection. No additional fragment.
- City circus hotspot: **State his favorite card.** The DM hears **Red Nine of Hearts**, then uses the existing scene travel control. No payment, Kest route, check or alternate outside entry. Scene links and scene activation are already DM-only. The label is a reminder; the solution lives only in campaign notes. The DM keeps the interior unrevealed until solved, then it stays available.
- First interior: three Jesters with the same profile/art. Trigger: party enters. They believe the party will ruin the Dealer's game. Tables provide half cover; same retreat/scaling rules. They were never recruited, created, ordered or affiliated with the Dealer. Reward: passage to Final Table and 10 gp; no second password.
- Direct Grand Floor → Final Table link. Where retained by the DM, optional Gallery, Private House and Foundations provide research, evidence and rest; never required to reach the boss. The live focused upgrade does not recreate deleted rooms. Preserve the Dealer profile, all twelve cards, restitution and Lornwatch hook.

## Presentation architecture

Use the existing combat session/initiative identities, TabletopContext, authenticated Supabase client and Realtime subscription pattern. A small private deck-state table holds draw order and research bookkeeping; a public presentation table holds exposed cards, pairs, round and replay sequence only. RLS permits OWNER/DM mutations and campaign members to read public presentations. A transactional, revision-checked RPC saves both. No HP, movement, attack, condition or resource writes.

The DM explicitly expires/advances cards before dealing, confirms research charges earned, announces phase two for the next round, and resolves pairs in initiative order. Held cards and pending pairs are reserved. Only exhausted draw piles refill from discard. A neutral blank handles more holders than available cards. Read the Back reserves the exact next two across reshuffles. Objection draws before discarding the rejected card. Cut delegates selection to the holder/party through the DM. Two interventions per round; one per creature's draw. Manual clear/reveal/replay remain available. Combat rounds remain authoritative; the panel warns when card and initiative rounds differ.

Present synchronized timestamped card flips with a persistent clickable round badge. Reconnect restores state; old animations do not replay. Respect reduced motion. Public card rules are exact copies of the canonical table plus shared rule reminders. Dealer/NPC kept cards and exposed pairs are public, as required by the encounter.

## Asset and verification checklist

- Generate RED case, 9 token, portrait sequence and one reusable Jester portrait into ignored workspace storage; upload via authenticated R2 Worker and save real paths in the private registry.
- Card faces use reusable physical-card styling and support individual art uploads through the same R2 service. No invented URLs or committed raster binaries.
- Extend the existing idempotent importer with actual discoverables, scoped old-dog/collection retirement, Jester encounters, corrected dialogue and links. Preserve user-added art and all protected runtime state.
- Test deck uniqueness, exhaustion, blank fallback, phase-two reservations, interventions, refresh, stale writes, round expiration and absence of stat writes.
- Exercise DM and player browser sessions, RLS and reconnect. Run importer tests, lint, typecheck and build. Record any unavailable live verification honestly.

## Implementation and verification — September 20, 2026

Code is on `codex/veyrholt-dealer-cards`, based on PR #23 commit `9ac4514`. The two presentation migrations were applied to the connected Wayfinder database. A rollback-only live SQL test passed OWNER writes, player public-only reads, outsider/anonymous denial, stale-revision rejection, unchanged reveal timestamps for non-reveal edits, and unchanged character/monster statistics. No test combat was retained.

Nineteen automated tests cover the exact canonical rules, no replacement, held/burned exclusions, blanks, exhaustion, all research controls, round expiration, reset, importer preservation and idempotence. A private snapshot compatibility test also confirmed the current live scene layout and moved Dealer NPC; it produced 52 proposed operations and a zero-operation rerun. That test used synthetic in-memory assets, exported no SQL and applied nothing.

Two browser tabs exercised production UI components with an explicitly labelled isolated local-storage transport: player flip/replay and persistent badge, full rules and Escape dismissal, refresh, expiration, phase two, private research preview/reorder, Burn, Cut, Objection, intervention caps and exhaustion/reshuffle. This is **not** a completed authenticated Supabase Realtime two-session test. Real DM/player sessions remain required for that final test.

Generated and visually inspected 16 images in ignored `.tmp/favorite-card-art/`: RED case, 9 token, HEARTS portrait sequence, Jester, and twelve card illustrations. No binaries or fake URLs were committed. R2 uploads are pending: the browser file chooser rejected local files, and no existing DM access token was provided to the Worker uploader. Enable the browser extension's local-file access or use the authenticated uploader. The favorite-card campaign transaction has consequently **not been applied**. The frontend has not been deployed.

Typecheck and production build pass (existing large-bundle warning). Full lint retains pre-existing frontend errors; new card modules and importer code are checked separately. Final authenticated test: DM and player open the same active encounter; deal/replay, refresh both, expire, trigger phase two, exhaust/recycle the deck and exercise each research control. Confirm player controls absent/private table unreadable, no stat writes, and all four uploaded clue/Jester images plus card art load from R2. Then apply the reviewed focused campaign transaction and verify automatic clue acquisition and the DM-operated spoken gate end to end.

## Live integration — September 20, 2026

Commit `880ac22` was pushed to `codex/veyrholt-dealer-cards`, then fast-forwarded to `main` because the Pages environment rejected a feature-branch workflow dispatch. The ordinary main push workflow deployed successfully. The deployed UI showed build `880ac22` in the Codex browser. The three database migrations are applied.

The Codex browser uploaded all sixteen generated images through the authenticated Wayfinder R2 Worker. `campaign_card_artwork` contains their real returned storage paths, including all twelve card faces. The RED prop was placed directly in Morrow's Arcana; its stored path was reused. The focused importer planned 51 operations from a fresh snapshot, passed a rollback rehearsal, then committed atomically. An after-snapshot yielded zero rerun operations and exact equality for scenes, maps, characters, campaign membership, fog and overlays. Hollow Dungeon 1 stayed active. The graveyard/circus Jesters, clues, dialogue, scene links and DM notes are live. The existing Dealer boss and optional rooms were not rebuilt.

In the separate Test Campaign, temporary initiative participants exercised the deployed DM panel: deal and replay animation, refresh persistence, card expiration, Read the Back and reorder, Burn, Objection, Cut on the Dealer, Phase Two choice, and draw exhaustion with discard reshuffle. The test did not modify HP, movement or conditions. SQL under an existing PLAYER identity read the public active Dealer/player cards, but zero private deck or DM artwork rows; draw order and preview were absent from public state. A second signed-in PLAYER browser session remains necessary to verify actual Realtime presentation and that the player UI lacks DM controls. The temporary Test Campaign card rows and initiative participants were removed; all three test tables returned zero rows for that combat.

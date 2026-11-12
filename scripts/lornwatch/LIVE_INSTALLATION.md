# Lornwatch live installation — 2026-10-15

Later targeted revision: [Mossjaw Ankheg live verification](MOSSJAW_LIVE_VERIFICATION.md) supersedes the original cave encounter described below. Two Ankhegs replace the placed owlbear/cub; original preparation history is retained. Other content and progress remain intact.

Installed with the DM's explicit approval into **The Hollow**, campaign `d8f5c76f-56ff-4724-ab43-f2709dfc225f`, in the existing dndplayer Supabase project. No new campaign was created. This records preparation, not played progress.

## Installed content

| Content | Added |
| --- | ---: |
| Draft, unrevealed scenes / maps | 10 / 10 |
| NPC placements / portrait archetypes | 46 / 20 |
| Total tokens / monster instances | 56 / 10 |
| SHOP-only interactions / stocked inventory lines | 7 / 41 |
| Prepared encounters / composition rows | 4 / 6 |
| Navigation links | 24 |
| Discoverables / private campaign notes | 13 / 12 |

The actual installed names are Lornwatch - Sunpetal Square; Lornwatch - The Golden Finch Inn; Lornwatch - Honeycrust Bakery; Lornwatch - Bramble & Brass; Lornwatch - Ada Rook's Cottage; Lornwatch - Courthouse; Lornwatch - Holding Cells; Lornwatch - Lower Chamber; Lornwatch - Mossjaw Cavern; and Glass Road - The Broken Crossing. Original stable scene IDs and navigation destinations were retained.

The route connects the **existing Veyrholt - Final Table** to The Broken Crossing and Sunpetal Square, with return links and the ford alternative. Earlier notes were preserved, including their older Abbey wording; the new private chapter notes supply the current town hook. All new scenes remain `active=false, revealed=false`. **Veyrholt - Grand Room remains the live, revealed scene.** No party tokens were moved or copied. Eleven new tokens intentionally start hidden: continuity copies, prisoners, optional combat guards, cave/basement actors and the roadside lookout; reveal them manually when appropriate.

Lina, Bram, Tessa and Daro operate four square shops. Oren operates Bramble & Brass, Pippa sells baked goods, and Mira sells overnight beds/private rooms, supper, tea, rations, ale and Hearthstones. Every inventory line has a positive price and finite starting stock. Hearthstones cost5gp, following the campaign bible's return-to-an-inn rule. The DM records the destination and resolves use; no automatic teleport, token movement, gold deduction or rest is claimed. Native shop inventory and payment remain DM-managed. Every new NPC interaction is SHOP with empty speech/pages; other NPCs have no scripted interaction. Ada's story and reveal conditions remain in private notes.

## Backup and preservation

Before the first live write, a consistent snapshot covered all37 relevant public tables: campaign/membership/profiles, scenes/maps/overlays/fog/links, characters and character_private, NPC/monster templates, instances/tokens/interactions/stock/patrols/motion, encounters, combat/initiative/cards, notes, audio and event history. Global reference/template rows were included. Private backups stay in ignored `.tmp/`, never Git.

Authoritative backup: `.tmp/lornwatch-complete-before-20261015-lossless.json`.

SHA256: `b64448c8b504d7ed21df91e86e4a74f42f7bb1770f22b757e4fbb8bb41c731af`.

The first rollback rehearsal exposed pre-existing high-precision NUMERIC coordinates that database-client JSON parsing rounded. No write committed. The exporter now returns JSON as text, and both import CLIs preserve the original snapshot bytes in SQL checks. The corrected197-insert transaction passed a full rollback rehearsal with existing authenticated-owner RLS, active-combat refusal, lock and untouched-row guards, then committed. Native uploads added ten map rows and thirteen discoverable rows. No schema or RLS policy changed.

Post-install SQL compared every original row against the lossless backup using PostgreSQL JSONB set difference, avoiding JavaScript numeric conversion. **Zero original rows changed or disappeared in all37 tables**, including private character data/inventory, HP, levels, existing tokens, combat/initiative/cards, scene flags/settings, earlier notes and artwork. The final lossless snapshots and verification artifacts are `.tmp/lornwatch-{complete,operational}-final-20261015-lossless.json`, `.tmp/lornwatch-installed-assets-20261015.json` and `.tmp/lornwatch-r2-verification-20261015.json`.

## Artwork and actual deployed-app checks

All uploads used the signed-in **in-Codex browser**, through Wayfinder's existing authenticated R2 Worker. No desktop control, browser credential extraction, direct R2 credentials or new Supabase Storage uploads were used. Fifty R2 objects represent ten maps, twenty NPC portraits, seven creature images and thirteen discoverables, from48 distinct local PNG files. Guard/captain images are reused content in separate native template uploads. All50 downloaded R2 objects matched their source PNG SHA256 hashes exactly; all49 manifest keys resolve to real campaign-scoped references.

Verified in deployed build `f349be41866acc37fb090230381441f1153f2be1`, against the actual installed campaign:

- All ten maps render in the draft Scene Builder; NPC/monster portraits load, visible town/road actors render, and all56 token rows have finite transforms and explicit defaults. Hidden actors retain their intended hidden state.
- Inn and bakery customers sit by the depicted tables; vendors occupy stall edges; Oren and Mira are physically present; courthouse staff, petitioners and guards are visible. The edited courthouse has a real interior arch into the service stair bay, with the basement destination correctly assigned.
- All seven built-in player shop previews open with the actual41 inventory rows, prices and stock. No test purchase or stock mutation was made.
- All thirteen discoverables open in private DM image previews; no discovery/reveal event was broadcast. Silent implosion and Old foundation stone stay hidden and undiscovered. Their markers were separated from boss hit areas at1000,650 and1150,650 so they can be inspected/revealed reliably.
- Native encounter editors show one owlbear, two optional court guards, Ilan plus sphere, and captain plus three highwaymen. Placed monsters have independent instance HP; cub is excluded from initiative composition. No new combat or encounter deployment was triggered.
- All24 new link destinations resolve inside the existing campaign, and the prepared graph is reachable in both directions. Private EDIT SCENE navigation was exercised across all ten scenes. Live travel links were not activated, because that changes the campaign's active scene.
- Authenticated RLS checks under **each of the four existing PLAYER memberships** returned zero new scenes/tokens/discoverables/links and zero private Lornwatch notes/encounters. Original public content remains untouched; no DM secrets were inserted into new public NPC text, dialogue or monster notes.
- A fresh rerun reports **0 operations / 0 missing assets**, both with the native-upload asset registry and without it. Browser-authored map/evidence IDs are recognized; mismatched references fail closed. Sold stock, HP, positions, reveals and DM edits remain protected on subsequent runs.

Local proof screenshots are under ignored `outputs/lornwatch/installed-*.jpg`, including the square, occupied interiors, accessible courthouse, all other maps, and Mira's actual shop with Hearthstones.

## Application deployment and remaining verification

The chapter can be opened **now** as hidden drafts in deployed Wayfinder. Use the Scene Builder's EDIT SCENE chooser; the narrow campaign-setup layout can hide its scene-list sidebar. The DM alone chooses when to make a scene live/revealed and place the party.

PR [#28](https://github.com/focustap/dndplayer/pull/28) remains open and draft. **No merge or deployment was performed.** Production still runs `f349be4`, so the new Turn cinematic and explicit cinematic-motion selector are not available there. They are implemented and tested in the PR/local preview. No additional schema migration is required for this chapter. After approval, merge PR #28 into main and verify the GitHub Pages deploy workflow succeeds; it runs on pushes to main. Confirm the new build SHA in Wayfinder, then verify Turn on an opted-in DM display and a player client, its Reduced Motion default, Restore and synchronized completion. The full campaign-data import must not be repeated as a deployment step.

Checks:51 focused regression tests pass, including exact numeric snapshot preservation, native-upload idempotency, clean names, Hearthstone stock, finite token transforms and Turn motion. Typecheck and production build pass with bundled Node24. `npm run lint` retains the same16 errors and1 warning in the existing five frontend files; no new findings. The build retains its existing bundle-size warning. Actual live travel/combat, player-browser multiplayer play, and deployed Turn were intentionally not exercised as part of this inactive installation.

## Approved pricing correction — 2026-10-15

At the DM's request, all41 Lornwatch inventory lines now use whole gold amounts of at least1gp. The32 previously fractional prices became1gp; existing2gp and5gp prices stayed unchanged. Four private running notes were corrected without replacing their other content. A fresh lossless snapshot was saved as `.tmp/lornwatch-prices-before-20261015-lossless.json`; the guarded update passed rollback rehearsal before commit. Verification found zero fractional/sub-1gp prices across all seven shops. Stock quantities, other item fields, scene flags, characters, combat and earlier chapters were preserved. The manifest, generated local preview and a dedicated regression test use the same pricing rule. This content correction is live without an application deployment.

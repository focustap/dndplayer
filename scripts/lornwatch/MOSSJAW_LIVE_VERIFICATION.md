# Mossjaw Ankheg revision — live verification, 2026-10-15

Applied to the existing **The Hollow** campaign `d8f5c76f-56ff-4724-ab43-f2709dfc225f`, Supabase project `feqwcrytaponcbhvfozc`. Open the deployed Scene Builder and select **Lornwatch - Mossjaw Cavern**. This is installed live content, not the demo.

## Installed

Existing Mossjaw scene `0a54c47d-877b-5549-abe2-85a2f6a665e7`, two token IDs, encounter ID and composition row retained. Map replaced with revised R2 art; original map and images retained. Scene settings, links and inactive/unrevealed flags preserved. Both exact token coordinates preserved, including the DM-moved northeast token.

Two new independent instances: `228aa4b5-85a7-53e3-a5b1-4ad612f562e7` and `654aa718-18b7-5fa9-a166-a73b5bed84ae`,39/39HP,AC14,walk30/burrow10,Large. First visible; second hidden for DM reveal. Native structured Bite and Acid Spray actions. Existing encounter is now **[Lornwatch] Mossjaw Ankheg infestation**, quantity2. Use the already placed tokens; Deploy encounter would add another pair.

Existing Livestock notice ID, position, visibility and discovery state preserved; image now describes insects/tunnels/acid remains and40gp for eliminating the infestation. Oren's ten-item SHOP, prices, quantities, token and position unchanged. Five private chapter/run-sheet notes updated after checking original content; one private history/running-reference note added. No NPC dialogue or automatic quest outcomes.

No cave combat/initiative history existed. Old owlbear/cub instances and templates remain unchanged as **unplaced historical records**, absent from the current encounter. Original encounter notes and token assignments retained privately. The moved token was explicitly accounted for, not reset.

## Verified on the actual deployed site

Only the in-Codex browser was used, at `focustap.github.io/dndplayer`, build `f349be41866acc37fb090230381441f1153f2be1`.

- New map loads; nest absent, burrows and acid-damaged terrain visible. Both new tokens rendered during temporary reveal test.
- First HP39→38 while second stayed39, restored. Second HP39→38 while first stayed39, restored. Final both39/39.
- Native second-token reveal worked; hidden again afterward. Separate named initiative controls inspected. No combat session or initiative roll started.
- Bite exposes +5 attack and2d6+3 plus1d6 damage buttons. Spray exposes DC13DEX,3d6,Recharge6,30×5ft line and half-save instructions. Saves, grapple and recharge remain DM-managed. Roll buttons inspected without broadcasting test dice to the active table.
- Live encounter editor shows2 Ankhegs,0 owlbear,0 cub. No duplicate encounter deployment.
- Oren's actual SHOP opens all ten stocked supplies without dialogue. Revised notice opens privately; no discovery event created.

Three R2 objects fetched from signed URLs actually displayed by production; bytes exactly matched local PNGs:

| Asset | Dimensions | SHA-256 |
| --- | --- | --- |
| cave-ankheg.png |1536×1024|58c3e32eb1325acadf7f3b0a6167521ea04c858a4acc06b9da200cd917b22492|
| ankheg.png |1254×1254|3bca789b0eb2405dbfd5a7e9584b89fbbef8f25e6018386fa7bb85b9eb4892e8|
| livestock-ankheg.png |1200×1400|d2c40034e503d301f54ed4615196e6f2afb8bee187c9c8f9e69c2a6b30974ceb|

## Preservation and deployment

Recoverable lossless snapshot: `.tmp/mossjaw-ankheg-before-20261015-lossless.json`,37 relevant tables. PostgreSQL comparison against exact original JSON found **zero unexpected modified or missing original rows across all37 tables**, allowing only approved map/token/encounter/notice/private-note fields. Characters/private data, earlier chapters, other scenes/NPCs/shops, exact positions, flags, old creature history, combat, initiative and discoveries preserved. **Veyrholt - Grand Room remains active.** Added1 map,1 template,2 instances,1 private note; scene/token/encounter/discoverable counts unchanged. Native operations added normal sync log entries.

Staging and final transactions passed ROLLBACK dry runs before commit, using authenticated owner/RLS. No migration, RLS alteration, service key, frontend runtime change, merge or deployment. Existing production functionality handles the new content immediately. Unrelated Turn code remains undeployed.

Source updated: manifest/assets, canon/chapter/run-sheet, guarded replacement planner and regression tests; SQL stale checks preserve exact NUMERIC values for updated rows. Both additive installer and targeted replacement plan **zero writes** against the actual post-install snapshot. General installer separately reports the pre-existing missing/renamed Broken Crossing wagon waybill; left untouched because this revision is limited to Mossjaw.

Validation:33 Lornwatch/Veyrholt tests pass; typecheck/build pass; changed JS passes ESLint. Full lint still reports16 existing errors and1 warning in unchanged frontend files. No Mossjaw content pending. Real initiative/combat execution was not started during verification.

Ignored local audit artifacts: `.tmp/ankheg-*` for staged/final snapshots, reviewed SQL, applied operations,37-table comparison and R2 hashes. Screenshots: `outputs/lornwatch/mossjaw-live-final.jpg`, `mossjaw-live-both-ankhegs-verification.jpg` (temporary reveal; second hidden again), `mossjaw-live-quest-verification.jpg`. Never restore a whole old snapshot over subsequent play.

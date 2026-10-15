# Glass Road / occupied Lornwatch / courthouse access

Implemented on the existing Chapter4 branch and isolated local fixture. No live Supabase reads/writes were needed for this expansion; an already saved read-only snapshot was used only for offline planning. No R2 uploads, merge, deployment, live scene activation, character changes or combat resets occurred.

## Native content

- Ten scenes,22 internal links,46 NPC/background placements and10 monster tokens. Original scene IDs, first14 NPC IDs, first6 monster IDs and first19 link IDs retain their identities; all additions append. New default positions can improve the uninstalled fixture without overwriting any existing authored database rows.
- The Broken Crossing has two travelers, a horse, captain and three highwaymen; three robbers start visible, the lookout hidden. Four-member encounter, independent HP/AC/actions, cargo rescue/repair, bargaining, safe ford and retreat outcomes are in the private expansion note. Entirely mundane, no Hollow clue or faction tie. No NPC dialogue interactions exist.
- Four new native SHOP vendors: Lina(food4 lines), Bram(produce4), Tessa(flowers4), Daro(mundane goods5). Together with original shops: seven shops,36 stock lines. Prices/quantities are actual npc_shop_items rows. Payment and story consequences remain manual under existing Wayfinder behavior.
- 25 new background extras occupy the square, inn, bakery and courthouse. Inn patrons use existing chairs/stools; bakery customers use chairs around west tables; courthouse petitioners occupy benches, clerks work at registry desks, guards stand alongside clear aisles. Three generated portrait archetypes are reused for extras with individual role labels. Original story-token positions are kept clear of roofs/beds in the new fixture.
- Courthouse sibling artwork `court-accessible.png` retains the original layout while opening a broad interior arch from east public aisle into the southeast landing. Stairs are visible; the marker now sits at1260,625 on the landing. `court.png` is preserved. The route can be guarded/restricted narratively, with escort/tool/holding-corridor alternatives in DM notes.
- 48 distinct active PNG files are local-ready,49 manifest keys because captain/robber share one image. No invented R2 URLs. Map/discoverable upload remains the existing authenticated Worker flow when installation is later authorized; current browser authoring is confined to local fixture storage.

## In-Codex browser checks

All interactions used the in-Codex browser. No Windows desktop control, OS preference changes, hidden application state injection or live credentials.

1. Uploaded crossing map and edited courthouse via **Upload/change map**. Uploaded both new documents via **Upload & place**, set650,390 and400,420 through native position fields, canceled pending placement. Opened both physical documents from their map markers and checked readable text/ford instructions. Verified map dimensions/markers and rendered token portraits.
2. Clicked actual map markers: east road → square, square → crossing, south ford → square. Clicked moved courthouse service-stairs marker → Lower Chamber, and basement return → courthouse. All reached the expected selected scene.
3. Selected each new vendor and opened **Preview player interaction**. Each showed SHOP, correct item count, prices and available quantities, with no dialogue panel. Food4, produce4, flowers4, goods5.
4. Entered all four highwaymen into native initiative, checked their attack/AC/HP UI, damaged captain27→19 without changing other robbers11HP, healed him back to27, ended combat. Travelers/horse were not entered in initiative. This verifies controls, not a four-player balance playtest.
5. Inspected actual canvas placements in the square, inn, bakery and courthouse. Checked chairs/benches and open passages against the1536×1024 art. Focused the corridor guard using native Cinematics **Focus selected** to inspect the arch and landing closely, then tested stairs/return.

Ignored proof images: `outputs/lornwatch/expansion-crossing-table.jpg`, `expansion-road-combat.jpg`, `expansion-square.jpg`, `expansion-inn.jpg`, `expansion-bakery.jpg`, `expansion-courthouse.jpg`, `expansion-courthouse-access.jpg` and `shop-lina.jpg` / `shop-bram.jpg` / `shop-tessa.jpg` / `shop-daro.jpg`.

## Automated / offline checks

47 relevant Node tests pass, including new checks for exact Veyrholt attachment, missing/ambiguous departure handling, native shop stock, encounter composition/starting visibility, original token identities, private expansion notes and finite Pixi transforms for all56 tokens across ten scenes. Existing preservation/no-op tests retain earlier chapters, authored positions, HP, sold stock, character state and notes.

Typecheck and production build pass on Node24; existing bundle-size warning remains. Full lint matches clean-main baseline:16 errors /1 warning, no additional findings. Production bundle does not include expansion notes, fixture endpoint or Ada lore.

Offline planner against the saved real-campaign snapshot produces192 inserts, including24 scene links (22 internal plus Final Table↔crossing). SQL is rollback-only and has not been executed. Exact departure lookup is `Veyrholt - Final Table`; no replacement earlier-chapter scene is invented when absent. The fixture contains only the new chapter, so the two real Veyrholt handoff links are verified by planner tests and snapshot data, **not claimed browser-tested against the live campaign**.

Pending only outside the authorized local scope: fresh live snapshot, installation approval, authenticated R2 uploads, database rehearsal/install and real player/multiplayer verification. No claim of live chapter installation or table playtest.

# Veyrholt — Wayfinder Scene Restructure

This file changes **presentation and scene topology only**. It does **not** change Veyrholt lore, clues, NPC motives, encounter mechanics, rewards, or chapter progression established in `VEYRHOLT.md`.

## Goal

Veyrholt is a large town. The current live build treats the grand Veyrholt overview as a normal playable scene with party tokens, NPCs, and investigation content placed directly on the city illustration. That makes the town feel compressed and makes combat/exploration feel like it happens on every map.

Refactor Veyrholt so the grand town illustration is a **location-selection hub**. Players choose a named destination on the overview and move to a dedicated top-down scene for that place.

The town itself should feel like investigation, roleplay, shopping, rumors, and movement between places. Combat should be concentrated in a few deliberate tactical scenes.

## Non-negotiable presentation rules

### Veyrholt Overview

Use the existing `Veyrholt 02 — Town & Castle Ring` art as the regional hub.

The overview should be:

- gridless
- non-tactical
- free of combat encounters
- free of monster placements
- free of ordinary player token movement
- free of NPC tokens that imply everyone is standing outdoors on the city illustration
- free of physical clue/discoverable placements that belong inside buildings
- used primarily for labeled scene links / travel choices

The overview should answer: **Where do you want to go in Veyrholt?**

Players should be able to choose specific locations and transition to proper top-down scenes.

## Desired scene topology

### Pre-town

1. **Veyrholt 01 — Bellpost Road**
   - Keep existing tactical map and encounter.
   - This is the road adventure that advances the party to Level 3.

### Town hub

2. **Veyrholt 02 — Town Overview**
   - Existing grand Veyrholt town art.
   - No encounter.
   - No party token roster required on the image.
   - Scene links only.

### Town locations

3. **The Brass Lamb**
   - Top-down inn map.
   - Safe social/rest scene.
   - Tamsin Reed can appear here before the farm investigation.
   - Add the retired/silent `VII` bell clue here.
   - Common supplies / lodging belong here.
   - No combat by default.

4. **Reeve's Hall & Civic Archive**
   - Top-down civic hall + archive map.
   - Reeve Elian Morrow and Sister Avra Seln.
   - Move `Reeve's Clock Ledger` here.
   - Move `Old Tithe Map` here.
   - Main investigation / timestamp / records scene.
   - No combat by default.

5. **Calder Bellworks**
   - Top-down bell foundry/workshop map distinct from the castle Bellfoundry dungeon.
   - Nessa Calder and her shop.
   - This is where players learn that old castle bronze regulates Second Motion.
   - Nessa's hidden recasting/sale history belongs here.
   - No combat by default.

6. **Chapel of the Last Chime**
   - Top-down chapel map.
   - Sister Avra can also appear here when appropriate.
   - Seventh-verse / Caldris oath / alternate castle entrance material belongs here.
   - No mandatory combat.

7. **Sunward Farms**
   - Use or regenerate the current farm map so it functions as an investigation scene, not the barn battle.
   - Tamsin Reed.
   - `Inherited Bell Collar` belongs here.
   - Investigation of missing animals and old tithe path.
   - No combat by default.

8. **Old Tithe Barn**
   - Separate top-down tactical barn map.
   - Kest Rane may be placed here or immediately nearby depending on pacing.
   - `Tithe Tag VII` and `Collection Roll` belong here.
   - **Bailiffs of the Empty Tithe** encounter belongs here.
   - This is the point where the apparently mundane livestock problem is revealed as a replay of the ancient tithe process.

### Castle Veyr

9. **Castle Gate, Echo Pens & Processional Court**
   - Existing castle gate/court tactical map may remain combined if it reads clearly.
   - `Gatewright's Lesson` belongs here.
   - Courtyard Sentinels are **optional/bypassable**, not a mandatory fight simply because the party enters the scene.
   - Bryn may appear at the boundary or before entry, but should not feel permanently stationed inside the dungeon.

10. **Hall of Measures, Ward Archive & Banquet**
   - Existing halls map may remain combined if the internal locations are visually readable.
   - Mara Venn can appear here.
   - Builder's Mural, Caldris Portrait, Three Door Sketches, Anchor Design Leaves, Response Strip VII, and Lornwatch Route Strip belong here.
   - Exploration/lore scene first.
   - No mandatory combat. Any Script Wraith-style threat is optional.

11. **Bellfoundry Undercroft**
   - Keep existing tactical map.
   - **The Recasting** encounter belongs here.

12. **Regent's Belfry**
   - Keep existing tactical map.
   - Bell Regent Catalyst fight belongs here.

## Overview scene links

The Veyrholt overview should expose clear scene-link hotspots for:

- The Brass Lamb
- Reeve's Hall & Civic Archive
- Calder Bellworks
- Chapel of the Last Chime
- Sunward Farms
- Castle Veyr / Ring Road
- West Road back toward Greymere

Do not link directly from the overview to deep castle rooms such as the Hall, Bellfoundry, or Belfry. Those should be reached through in-world castle navigation once the party enters Castle Veyr.

## Town-location return links

Each town location should have an obvious return link to **Veyrholt Overview**.

Sunward Farms should link to Old Tithe Barn only once that route is available/relevant, while still allowing return to the overview.

Castle entry should return to the overview only through believable exits/aftermath paths, not as a generic teleport from every dungeon room.

## Encounter distribution

The intended combat density is:

1. **Bellpost Road** — Toll-Takers and Road Refrains
2. **Old Tithe Barn** — Bailiffs of the Empty Tithe
3. **Processional Court** — Courtyard Sentinels, optional/bypassable
4. **Bellfoundry** — The Recasting
5. **Regent's Belfry** — Bell Regent Catalyst

There should be **no default combat** in:

- Veyrholt Overview
- The Brass Lamb
- Reeve's Hall & Civic Archive
- Calder Bellworks
- Chapel of the Last Chime
- Sunward Farms
- Hall/Archive/Banquet

Use NPC conflict, clues, Second Motion incidents, environmental weirdness, and choices to create tension in those scenes instead.

## NPC placement after restructure

- **Reeve Elian Morrow** → Reeve's Hall & Civic Archive
- **Captain Bryn Halvek** → castle boundary / Castle Gate when needed; optionally Reeve's Hall during early investigation
- **Nessa Calder** → Calder Bellworks
- **Sister Avra Seln** → Reeve's Archive and/or Chapel of the Last Chime
- **Tamsin Reed** → Brass Lamb initially, then Sunward Farms
- **Kest Rane** → Sunward Farms / Old Tithe Barn edge
- **Mara Venn** → a quiet town meeting location if needed, then Hall/Archive/Banquet for castle lore

Do not place all major NPCs on the Veyrholt overview at once.

## Discoverable placement after restructure

- `Reeve's Clock Ledger` → Reeve's Hall & Civic Archive
- `Old Tithe Map` → Reeve's Hall & Civic Archive
- Silent `VII` Bell → The Brass Lamb
- `Inherited Bell Collar` → Sunward Farms
- `Tithe Tag VII` → Old Tithe Barn
- `Collection Roll` → Old Tithe Barn
- `Gatewright's Lesson` → Castle Gate / Court
- Builder's Mural → Hall of Measures
- Caldris Portrait → Hall of Measures / Archive
- Three Door Sketches → Ward Archive
- Anchor Design Leaves → Ward Archive
- Response Strip VII → Ward Archive
- Lornwatch Route Strip → Ward Archive / Catalyst aftermath
- Veyrholt Catalyst Shard → Regent's Belfry

## Map art requirements

New maps should match the established grounded dark-fantasy Veyrholt/Greymere art direction but be suitable for Wayfinder tactical/social play.

For every new local map:

- true top-down / orthographic camera
- camera approximately 90 degrees above the floor
- no horizon
- minimal perspective distortion
- no text or labels baked into the art
- readable doors, paths, furniture, counters, stairs, and exits
- enough open floor for tokens
- no pre-drawn token circles or grid unless Wayfinder needs it

Required new art:

1. The Brass Lamb interior
2. Reeve's Hall & Civic Archive
3. Calder Bellworks
4. Chapel of the Last Chime
5. Old Tithe Barn tactical map

Sunward Farms may reuse the current farm asset if it reads cleanly after the barn encounter content is removed; otherwise regenerate it as a farm-investigation map.

## Data / infrastructure requirements

- Heavy new map assets must use the existing private Cloudflare R2 pipeline.
- Supabase should store the normal scene/map rows, links, tokens, interactions, discoverables, and encounter metadata.
- Do not migrate existing R2 assets back into Supabase Storage.
- Do not hardcode production UUIDs in repository files.
- Preserve current Greymere content.
- Preserve all existing Veyrholt lore and DM notes.
- Preserve all existing generated Veyrholt art unless superseded by a more appropriate local map.
- Keep new Veyrholt scenes inactive and unrevealed until the DM intentionally begins them.

## Migration behavior

The live Veyrholt content already exists. Refactoring must be **additive and careful**.

1. Create/upload new local map assets first.
2. Create the new location scenes.
3. Move/copy NPC interactions and discoverables to their correct local scenes.
4. Move the Tithe Barn monster placements/encounter off the farm scene and into the dedicated barn scene.
5. Convert the town overview into a hub by removing ordinary player/NPC/combat content from it only after every replacement location exists.
6. Replace overview links with the location-hub structure above.
7. Preserve current active scene and player-facing reveal state during the migration.
8. Do not delete campaign history or unrelated data.
9. Make the repo importer/manifest idempotent for the restructured topology.
10. Verify player clients cannot see unrevealed scenes or DM-only notes.

## Final desired feel

Veyrholt should play like a **real town surrounding a dangerous castle**, not like a single giant battle map.

The rhythm should be:

**arrive → choose where to investigate → talk/shop/explore → connect the mundane livestock problem to the Hollow → deliberately enter Castle Veyr → dungeon escalation → Catalyst**.

The lore in `VEYRHOLT.md` remains canon. This refactor exists only to make Wayfinder present that lore at the correct physical scale and pacing.

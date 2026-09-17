# Veyrholt setup and verification

The single story source is [VEYRHOLT.md](../../docs/campaign/chapters/VEYRHOLT.md). `manifest.mjs` contains scene topology and player-safe dialogue; the importer copies the chapter's sections into DM-only campaign notes. `legacy.mjs` is an exact retirement allowlist, **not playable lore**. Historical binary artwork is retained rather than deleted.

## Reproducible workflow

Requires Node >=22.13 (verified with Node 24.19). Default validation is read-only:

```sh
npm run campaign:veyholt
node --test scripts/veyholt/plan.test.mjs
```

1. Export a fresh campaign snapshot. Generate its read-only SQL with `node scripts/import-veyholt.mjs --campaign-id UUID --snapshot-sql`. Execute through the connected Supabase admin tool and save the returned `snapshot` object as a private JSON file, or use `psql -t -A` to write the single JSON column. Store snapshots in ignored `.tmp/`, never Git. Snapshot includes scene objects, shops, character/combat state and global template definitions needed to check references.
2. Upload supplied PNGs with Wayfinder's **Upload/change map** UI, or `node scripts/veyholt/upload-assets.mjs --campaign-id UUID --key town --file /absolute/path.png --registry .tmp/assets.json`. The script requires an existing DM `WAYFINDER_ACCESS_TOKEN`, uses the normal Worker `/v1/upload` and `/v1/sign` flow, hashes files for repeat uploads, and records actual returned paths/dimensions. It never uses direct R2 credentials or Supabase Storage. `VITE_ASSET_API_URL` is the frontend-compatible override; old `VITE_R2_ASSET_WORKER_URL` remains accepted.
3. A UI upload changes the scene name to the filename. Restore its canonical scene name, verify the loaded image, then take another snapshot. For UI-uploaded or reused maps, add their actual database `storage_path`, `width`, `height` and `verified: true` to the private registry after verification. Keys are manifest asset keys, not arbitrary filenames. Never substitute invented URLs.
4. Generate a plan and transaction:

```sh
node scripts/import-veyholt.mjs --campaign-id UUID --snapshot .tmp/before.json --assets .tmp/assets.json --plan .tmp/plan.json --sql .tmp/plan.sql
```

5. Review the JSON operations. Execute the SQL through the Supabase admin connector. Alternatively `--apply` uses installed `psql` and `WAYFINDER_DATABASE_URL` supplied via environment. Database credentials are never command arguments or committed files. Test with the final `commit;` replaced by `rollback;` before first application. Failure rolls back the entire data transaction; an already-completed R2 upload remains an unused asset and is not deleted.
6. After replacing the chapter, run `retireUnusedTemplatesSql` exported from `retire-unused-templates.mjs` through a trusted admin connection. It locks only the eight explicitly named retired template rows and deletes them only if **no campaign** references them through instances, encounters or tokens. It never deletes asset bytes or shared in-use templates. This step requires full database visibility, not a campaign-limited REST token.
7. Export a fresh after-snapshot, compare protected data, verify player RLS and generate the plan again. An unchanged completed setup produces **zero operations**. Keep private snapshots for recovery; do not blindly replay an old snapshot over later sessions.

## Safety boundaries

- No campaign reset, scene deletion, player-token deletion/movement, character-level changes, combat reset, fog/overlay edits or activation changes. Existing revealed flags stay as found; new scenes start inactive/unrevealed. Active Veyrholt scenes or active combat block the rewrite.
- Scene renames use exact current/legacy names and reject ambiguity. Retirement matches exact allowlisted names inside managed Veyrholt scenes. Unknown user additions are retained. Discovered obsolete clues and patrolling/runtime tokens require separate review instead of automatic removal.
- Only Greymere exceptions: the existing Messenger's new player-safe appeal and the existing east-road link's label/destination. Messenger appearance, position and hidden state remain intact. Hobb is verified exactly, never repaired automatically.
- Current HP, conditions, sold shop quantities, player coordinates and existing token visibility survive reruns. New monsters begin hidden. The overview contains scene choices only.
- Global templates are not overwritten when their stats differ: importer requires review or a clone. New art can be applied to campaign tokens without changing other campaigns' global portrait references.
- SQL uses a transaction, campaign advisory lock, expected-row checks and existing OWNER/DM RLS. It verifies every untouched original row and all original scene active/revealed flags before commit. No schema/policy changes, service-role credentials in frontend, or public DM data.
- Archive labels identify unused old map records; their R2 bytes and local art are retained. Ordinary inn/civic interiors were visually reviewed and reused. Missing new maps deliberately have no base image, with existing scene coordinates retained. Do not substitute the city illustration as a tactical map.

## Asset status

Provided: user's 1448×1086 city illustration uploaded and rendered from R2. Reused: 1536×1024 ordinary inn and civic interiors plus existing ordinary NPC portraits. Campaign-specific paths are held in the private registry, not hardcoded in the repository.

### Token portrait polish

The Veyrholt token pass generates and uploads character portraits for Ysabet Morrow, Nera Vale, Rusk Fen, Sable Quill, Lady Ilyra Veyr and the Dealer; it also supplies distinct portraits for the road scout, road bandit, graveyard dog, Claim Usher and Wager Hound. Reuse an archetype portrait only for duplicate encounter placements. Assign image paths to campaign tokens rather than overwriting shared templates, then verify that every current Veyrholt NPC and monster token has art and that the worker-backed image loads in the scene builder. Retain already good portraits and avoid generic casino-background artwork.

| Missing map key | Required file | Dimensions |
| --- | --- | --- |
| road | maps/east-road.png | 1254×1254 |
| arcana | maps/morrows-arcana.png | 1536×1024 |
| market | maps/strangers-market.png | 1254×1254 |
| graveyard | maps/lucky-graveyard.png | 1024×1536 |
| grand | maps/grand-floor.png | 1536×1024 |
| gallery | maps/gallery-of-wagers.png | 1536×1024 |
| private | maps/private-house.png | 1536×1024 |
| foundations | maps/original-foundations.png | 1254×1254 |
| final | maps/final-table.png | 1254×1254 |

Local maps: true top-down, no baked grid/text/tokens, clear exits and usable floor. Final Table: circular room, central card table, Pot around perimeter, no throne or old anchor machinery. Grand Floor: red/black/gold carnival over older civic stone. City art remains a high bird's-eye hub.

Square 1024×1024 is suitable for character and creature portraits. No image-backed discoverables are required for the note-based optional finds.

## Applied and verified — 2026-09-16 local date

- Reused all 12 Veyrholt scene IDs; installed 27 NPCs, 5 encounters, 11 hidden enemy placements, 24 chapter links, a five-item shop and 10 DM chapter notes.
- Replaced obsolete Veyrholt encounters, hidden discoverables, anchors and dialogue; removed eight orphaned obsolete monster templates. Preserved old art bytes. No frontend deployment or schema migration needed.
- Preserved **80 player tokens**, all four character records, all nine Greymere/Threshold scene records, all 21 original active/reveal flag pairs, 70 unrelated tokens (including the hidden Messenger), 15 unrelated dialogue records, six Greymere discoverables, 14 unrelated links, eight Greymere shop entries, 16 Greymere monster instances and the Warden note. Hobb remains byte-for-byte unchanged.
- **The Threshhold remains active and revealed.** Existing Veyrholt reveal flags were mixed and remain so. None was made live.
- All chapter references and entry/return paths validated. Active story/dialogue/encounters have no discarded storyline references. Expected old names exist only in the retirement allowlist, negative validation checks and unused historical asset metadata.
- Player-role SQL checks returned zero readable DM notes, builder links or inactive Veyrholt dialogue. No RLS changes.
- Importer tests pass; targeted script lint passes; typecheck passes; production build passes with Node 24.19 (existing large-chunk warning). Full-project lint has **16 pre-existing errors and one warning** in untouched frontend files. No `src/` files changed. Default system Node 20 cannot build this repo; use its declared Node >=22.13 requirement.

Balance: four Level 3 PCs, Dealer AC 14 / 85 HP, two 1d6+3 attacks, phase two from the round after 42 HP, twelve symmetric rule cards, limited research interventions plus guaranteed fallback. Dead Man preserves the player's turn; Debt cannot reduce its holder below 1 HP. Victory breaks corruption; survival and restitution remain player choices. No live character stats or story outcomes were advanced during setup.

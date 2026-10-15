# Chapter 4 Lornwatch — installation and verification

Prepared native Wayfinder content for issue #27. **Not installed in The Hollow.** No live campaign writes, R2 uploads, deployment, merge, resets, character changes or earlier-chapter edits have been performed. The active live scene was inspected read-only as Veyrholt - Grand Room; no combat was active at snapshot time. Re-snapshot before installation.

## Ready for review

- Nine maps/scenes, nineteen bidirectional DM navigation links, fourteen NPC placements (ten identities, including hidden continuity copies), twenty creature/NPC tokens, three SHOP-only interactions with nineteen stock lines, three prepared encounters, six enemy/noncombatant instances, eleven discoverable images, eleven private notes (chapter sections plus run sheet).
- Twenty-five built-in ImageGen images (nine maps, fourteen portrait/creature images, two finale images) and nine deterministic evidence documents: **34 local PNG assets**. Source files are in ignored `outputs/lornwatch/`; file dimensions and SHA256 hashes are recorded in `docs/campaign/chapters/LORNWATCH_ASSETS.json`. Heavy binaries are intentionally absent from Git.
- Ada's full story, memorial/case triggers, opening arrest read-aloud, NPC knowledge/reactions, boss restrictions/scaling and finale are in `LORNWATCH.md` / `LORNWATCH_RUN_SHEET.md`. No NPC speech or dialogue trees are installed. Only shopkeepers have token_interactions, type SHOP and empty dialogue fields.
- Existing RLS and native scene/discoverable/encounter systems are reused. No schema changes. Ilan90HP/AC15 and sphere60HP/AC13 are separate damage targets. Cub is not an encounter member.
- Turn is available in Cinematics: toward/away a reference token or eight compass directions, smooth visual-only MAP_TILT, automatic return, synchronized Restore, and no automatic saves/token moves. Cinematic motion defaults to following the browser's Reduced Motion preference; select **Full rotation — opt in** to test the actual rotating map. The choice persists for this browser only. See [Turn verification](TURN_VERIFICATION.md); live multi-client verification remains pending.

## Isolated browser preview

Use Node >=22.13 (verified Node24.19; the host default Node20 cannot run Vite8).

```sh
npm run campaign:lornwatch:preview-data
npm run campaign:lornwatch:preview -- --port 5174
```

Open `http://127.0.0.1:5174/campaign/demo/scene/6dfd6387-e4c3-53bb-abf5-c2e68a4957ab/builder`. This is the existing Scene Builder/tabletop, loaded from native record fixtures. The explicit `chapter-preview` serve mode overrides both live Supabase environment values to undefined. It runs locally, has no live credentials, is DM-only, and is excluded from production builds. Its header explicitly says LOCAL FIXTURE PREVIEW / NOT CONNECTED TO YOUR LIVE CAMPAIGN. In-memory edits last until browser reload or dev restart. This is a rehearsal, not an installed multiplayer campaign or another Supabase project. Installation targets the existing The Hollow campaign alongside Greymere/Veyrholt.

Use EDIT SCENE to inspect each map. Upload/change map uses the normal native control. Discoverables use Upload & place and map-position fields; finale/VII remain hidden. `node scripts/lornwatch/preview.mjs --browser-authoring` starts with no evidence so all eleven can be uploaded through browser controls for a clean authoring pass; default preview-data restores the complete fixture. Local preview seed excludes campaign notes; read the private source docs separately.

Browser verification performed in the **in-Codex browser only**, never the Windows desktop: uploaded all nine maps; uploaded/positioned all eleven discoverables; checked Oren's SHOP-only player preview and prices; verified sphere damage changes independently from Ilan. No NPC dialogue was selected or created. Scene graph reachability is additionally tested in both directions. Combat balance is a design estimate, not a four-player playtest.

Token serialization now supplies finite defaults when older or fixture payloads omit rotation and other token fields. New records include explicit defaults. All twenty NPC/monster tokens were checked on the actual canvases across all nine scenes; intentionally hidden actors remain DM-only ghosts. Full rotation, default reduced motion, cancellation, expiration and preference persistence were rechecked through the real motion selector, without source overrides.

## Reviewable setup / live approval required

Default CLI validation is read-only:

```sh
npm run campaign:lornwatch
node scripts/import-lornwatch.mjs --campaign-id CAMPAIGN_UUID --snapshot-sql
node scripts/import-lornwatch.mjs --campaign-id CAMPAIGN_UUID --snapshot .tmp/before.json --plan .tmp/plan.json --sql .tmp/review.sql
```

Export a fresh native snapshot using the read-only SQL. Keep it in ignored `.tmp/`. The existing snapshot covers scene objects, member/character/combat state and global templates. A real read-only snapshot and a 109-insert base-content plan have been prepared privately in `.tmp/lornwatch-before.json`, `.tmp/lornwatch-plan.json`, `.tmp/lornwatch-review.sql`; regenerate after approval rather than executing a stale plan.

SQL output ends in **ROLLBACK**, and `--apply` is rejected. The default plan has no updates/deletes of earlier content and no existing character/token/fog/initiative writes. New scenes are inactive/unrevealed; creatures and continuity copies are hidden. The shared transaction renderer preserves native RLS, verifies owner/DM membership, refuses active combat, takes an advisory lock and checks untouched rows/scene flags. Stable campaign-scoped IDs make repeats no-ops and retain sold stock, HP, discoveries, positions, visibility and DM notes. Ambiguous names, unmanaged template collisions and foreign campaign data fail closed.

Optional `--update-hook` changes only the obsolete travel sentences in the two exact existing Veyrholt private notes (House Veyr sequence / Final Table), preserving all Dealer rules and results. It never edits earlier NPC dialogue, map data or gameplay state. The real snapshot yields two extra note updates, reviewed separately in `.tmp/lornwatch-with-hook-plan.json` / `.tmp/lornwatch-with-hook-review.sql`. These files also end in rollback and have not been executed. Include this option in the approved installation to remove the retired destination from live DM notes.

**After explicit approval**, preferred artwork installation uses the in-Codex browser:

1. Review and rehearse the base-content transaction with rollback, then explicitly change its final rollback to commit to install new draft records. No existing scenes are renamed or retired. Existing NPC dialogue, including earlier chapters, is preserved.
2. Open each new draft scene's builder. Upload its corresponding map, which goes through authenticated Wayfinder R2; the new builder control restores the canonical scene name. Never press Make Live as part of setup.
3. Add each evidence image through Upload & place. Names/coordinates are in manifest.mjs. The two basement images must remain hidden and undiscovered. Ordinary clues start visible but cannot be discovered from an inactive scene. Do not put the sphere/VII images on the baseline map.
4. Update the ten new NPC template portraits and five new monster templates through existing campaign editors. Reuse guard portrait for the guard monster. Native token image hydration reads template images when token image_path is absent. Preserve stats, NPC interaction settings and other campaigns' templates.
5. Export again, confirm protected tables/rows equal the before-snapshot, verify every map and image loads through R2, and check player-role reads cannot see private notes/encounters/undiscovered finale. Open each new scene privately, verify links and shops, then rerun the base planner: zero operations expected. DM chooses when to activate Lornwatch and move/place party tokens later.

For an operator-supplied registry of **actually uploaded, verified** R2 assets, `--assets .tmp/lornwatch-assets.json` can prepare all art references in the original transaction. Each entry is `{path,width,height,verified:true}` with a real campaign-scoped Worker path, never a signed URL or local fixture path. Optional portrait/creature upload support reuses the existing Worker tool: `node scripts/veyholt/upload-assets.mjs --chapter lornwatch --campaign-id UUID --key ada --file outputs/lornwatch/portraits/ada.png --registry .tmp/lornwatch-assets.json`. It uses an existing DM access token supplied privately in environment; never browser credential extraction, direct R2 credentials or new Supabase Storage. The user's browser-first preference remains authoritative for maps/discoverables.

If base blank scenes already exist, the planner intentionally preserves them and won't replace their maps or token art on repeat. Use the native browser editors to fill them; do not expect a later registry to overwrite already-authored records. It does not add duplicate evidence that was authored through the UI when running without an asset registry.

## Checks and remaining work

- Pass: `node --test scripts/cinematic-motion.test.mjs scripts/token-serialization.test.mjs scripts/cinematic-tilt.test.mjs scripts/lornwatch/plan.test.mjs scripts/veyholt/plan.test.mjs scripts/dealer-cards.test.mjs` (42 tests).
- Pass: `npm run typecheck`, `npm run build` with bundled Node24. Existing chunk-size warning remains.
- `npm run lint`: 16 errors and 1 warning. Matched against a clean archive of origin/main f349be4: identical files/rules/severities/messages (ignoring shifted source locations). No new findings. Existing errors are in TabletopContext, CreatureInspector, LiveAudio, NpcInteractionModal and SceneBuilderPage.
- Production bundle checked: no private chapter source lore, fixture endpoint, or Ada backstory. Turn's generic DM controls are production code.
- **Pending:** explicit live installation approval, authenticated R2 uploads, actual database rollback rehearsal, post-install snapshot comparison and player-role/multiplayer RLS verification. Docker's local engine was unavailable, so no local Postgres integration test was claimed. No merge/deployment performed.

Read the run sheet before playing. Manual story token continuity, shopping payment/rewards, writ timing, Ilan survival and post-sphere reveals are intentional DM decisions, not automation.

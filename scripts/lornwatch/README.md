# Chapter 4 Lornwatch — installation and verification

Native Wayfinder content for issue #27. **Installed into the existing The Hollow campaign on 2026-10-15 with explicit DM approval.** Ten cleanly named scenes remain inactive and unrevealed alongside all earlier chapters. Fifty R2 objects were uploaded through native in-Codex browser controls and verified against their local PNG bytes. No existing campaign row was changed or removed. Veyrholt - Grand Room remains active; no combat was started. See [live installation report](LIVE_INSTALLATION.md) for the backup, exact preservation checks, actual browser verification and deployment status. PR #28 remains unmerged; Turn is not yet deployed.

## Ready for review

- Ten maps/scenes,22 internal DM navigation links plus two additive links to the exact existing Veyrholt Final Table;46 NPC/background placements (20 portrait archetypes, including travelers/horse and hidden continuity copies),56 total tokens, seven SHOP-only interactions with41 stock lines, four prepared encounters, ten monster instances,13 discoverable images and12 private notes. Mira sells rooms, food, drinks and5gp Hearthstones, resolved manually by the DM.
- **48 distinct active local PNG assets:**37 built-in ImageGen images (ten maps,25 portrait/creature images, two finale images) and11 rendered evidence documents. The49 manifest keys include two highwayman template aliases sharing one token image. Source files are in ignored `outputs/lornwatch/`; dimensions and SHA256 hashes are recorded in `docs/campaign/chapters/LORNWATCH_ASSETS.json`. Original courthouse art is retained; the preview uses `court-accessible.png`. Heavy binaries are intentionally absent from Git.
- Ada's full story, memorial/case triggers, opening arrest read-aloud, NPC knowledge/reactions, boss restrictions/scaling and finale are in `LORNWATCH.md` / `LORNWATCH_RUN_SHEET.md`. No NPC speech or dialogue trees are installed. Only shopkeepers have token_interactions, type SHOP and empty dialogue fields.
- Existing RLS and native scene/discoverable/encounter systems are reused. No schema changes. Ilan90HP/AC15 and sphere60HP/AC13 are separate damage targets. Cub is not an encounter member.
- Turn is available in Cinematics: toward/away a reference token or eight compass directions, smooth visual-only MAP_TILT, automatic return, synchronized Restore, and no automatic saves/token moves. Cinematic motion defaults to following the browser's Reduced Motion preference; select **Full rotation — opt in** to test the actual rotating map. The choice persists for this browser only. See [Turn verification](TURN_VERIFICATION.md); live multi-client verification remains pending.
- The Broken Crossing is a mundane roadside rescue/robbery before town, unrelated to any Hollow. Four new market shops,25 ordinary background extras, seated inn/bakery patrons and courthouse staff are implemented. The courthouse has a visible interior arch to the southeast stair landing. See [expansion DM reference](../../docs/campaign/chapters/LORNWATCH_EXPANSION.md) and [browser verification](EXPANSION_VERIFICATION.md).

## Isolated browser preview

Use Node >=22.13 (verified Node24.19; the host default Node20 cannot run Vite8).

```sh
npm run campaign:lornwatch:preview-data
npm run campaign:lornwatch:preview -- --port 5174
```

Open `http://127.0.0.1:5174/campaign/demo/scene/6dfd6387-e4c3-53bb-abf5-c2e68a4957ab/builder`. This is the existing Scene Builder/tabletop, loaded from native record fixtures. The explicit `chapter-preview` serve mode overrides both live Supabase environment values to undefined. It runs locally, has no live credentials, is DM-only, and is excluded from production builds. Its header explicitly says LOCAL FIXTURE PREVIEW / NOT CONNECTED TO YOUR LIVE CAMPAIGN. In-memory edits last until browser reload or dev restart. This is a rehearsal, not an installed multiplayer campaign or another Supabase project. Installation targets the existing The Hollow campaign alongside Greymere/Veyrholt.

The new travel scene opens at `http://127.0.0.1:5174/campaign/demo/scene/6700fb1c-0a42-571c-a752-19b4ebd61f36/builder`. The fixture intentionally contains no replacement Veyrholt scene. Against a real campaign snapshot, the planner adds Final Table ↔ Glass Road links only when `Veyrholt - Final Table` is present unambiguously; missing/renamed departures are reported for manual resolution. The DM controls when to travel after the Dealer outcome.

Use EDIT SCENE to inspect each map. Upload/change map uses the normal native control. Discoverables use Upload & place and map-position fields; finale/VII remain hidden. `node scripts/lornwatch/preview.mjs --browser-authoring` starts with no evidence so all thirteen can be uploaded through browser controls for a clean authoring pass; default preview-data restores the complete fixture. Cancel pending placement after setting positions. Local preview seed excludes campaign notes; read the private source docs separately.

Browser verification performed in the **in-Codex browser only**, never the Windows desktop: uploaded all nine maps; uploaded/positioned all eleven discoverables; checked Oren's SHOP-only player preview and prices; verified sphere damage changes independently from Ilan. No NPC dialogue was selected or created. Scene graph reachability is additionally tested in both directions. Combat balance is a design estimate, not a four-player playtest.

Token serialization supplies finite defaults when older or fixture payloads omit rotation and other token fields. New records include explicit defaults. The original twenty tokens were checked across nine scenes; expansion QA additionally checks the occupied square/interiors and seven crossing actors on actual canvases. Regression coverage includes all56 records across ten scenes. Intentionally hidden actors remain DM-only ghosts. Full rotation, default reduced motion, cancellation, expiration and preference persistence were checked through the real motion selector, without source overrides.

## Installation procedure / fresh snapshot required for future changes

Default CLI validation is read-only:

```sh
npm run campaign:lornwatch
node scripts/import-lornwatch.mjs --campaign-id CAMPAIGN_UUID --snapshot-sql
node scripts/import-lornwatch.mjs --campaign-id CAMPAIGN_UUID --snapshot .tmp/before.json --plan .tmp/plan.json --sql .tmp/review.sql
```

Export a fresh native snapshot using the read-only SQL. **Save the returned snapshot_json text verbatim**, without parsing/stringifying through JavaScript: existing PostgreSQL numeric coordinates can exceed IEEE-754 precision. Keep it in ignored `.tmp/`. The CLI carries those exact bytes into SQL preservation checks. The approved live install rehearsed197 inserts with rollback before committing, then attached maps, portraits and discoverables through native R2 uploads. Earlier109/111/192/194-operation plans are obsolete. Never execute a stale plan; the current installed snapshot yields zero operations and no missing assets, with or without its verified asset registry.

SQL output ends in **ROLLBACK**, and `--apply` is rejected. The default plan has no updates/deletes of earlier content and no existing character/token/fog/initiative writes. New scenes are inactive/unrevealed; town combat copies, prisoners and lookout are hidden, while three roadside robbers start visible. The shared transaction renderer preserves native RLS, verifies owner/DM membership, refuses active combat, takes an advisory lock and checks untouched rows/scene flags. Stable campaign-scoped IDs make repeats no-ops and retain sold stock, HP, discoveries, positions, visibility and DM notes. Ambiguous names, unmanaged template collisions and foreign campaign data fail closed.

Optional `--update-hook` changes obsolete travel sentences in two exact existing Veyrholt private notes. **It was not used for the live installation**, to preserve every earlier row as requested. The new chapter notes provide the current hook. Earlier hook-update plans remain obsolete and unexecuted; do not apply them as part of a rerun.

**After explicit approval**, preferred artwork installation uses the in-Codex browser:

1. Review and rehearse the base-content transaction with rollback, then explicitly change its final rollback to commit to install new draft records. No existing scenes are renamed or retired. Existing NPC dialogue, including earlier chapters, is preserved.
2. On deployed build f349be4, use campaign setup → Maps & scenes, select the new draft, then Upload/change map. A wide browser viewport is needed to expose that setup page's scene-list sidebar. Restore its canonical name with Save scene after upload; do not select an earlier scene. PR #28 additionally provides this control inside each draft's builder and preserves the name automatically. Never press Make Live as part of setup.
3. Add each evidence image through Upload & place. Names/coordinates are in manifest.mjs. The two basement images must remain hidden and undiscovered. Ordinary clues start visible but cannot be discovered from an inactive scene. Do not put the sphere/VII images on the baseline map.
4. Update the20 NPC portrait archetypes and seven monster templates through existing campaign editors. Reuse guard portrait for the guard monster, highwayman image for captain/robbers, and background archetypes for labeled extras. Native token image hydration reads template images when token image_path is absent. Preserve stats, NPC interaction settings and other campaigns' templates.
5. Export again, confirm protected tables/rows equal the before-snapshot, verify every map and image loads through R2, and check player-role reads cannot see private notes/encounters/undiscovered finale. Open each new scene privately, verify links and shops, then rerun the base planner: zero operations expected. DM chooses when to activate Lornwatch and move/place party tokens later.

For an operator-supplied registry of **actually uploaded, verified** R2 assets, `--assets .tmp/lornwatch-assets.json` can prepare all art references in the original transaction. Each entry is `{path,width,height,verified:true}` with a real campaign-scoped Worker path, never a signed URL or local fixture path. Optional portrait/creature upload support reuses the existing Worker tool: `node scripts/veyholt/upload-assets.mjs --chapter lornwatch --campaign-id UUID --key ada --file outputs/lornwatch/portraits/ada.png --registry .tmp/lornwatch-assets.json`. It uses an existing DM access token supplied privately in environment; never browser credential extraction, direct R2 credentials or new Supabase Storage. The user's browser-first preference remains authoritative for maps/discoverables.

If base scenes already exist, the planner preserves their maps, token art and DM edits. It recognizes native browser-authored maps and evidence by their existing scene and exact asset references, so a matching registry rerun also creates no duplicate maps/discoverables. Conflicting maps or evidence fail closed. Use native editors for deliberate changes, rather than expecting an import to overwrite authored content.

## Checks and remaining work

- Pass: `node --test scripts/cinematic-motion.test.mjs scripts/token-serialization.test.mjs scripts/cinematic-tilt.test.mjs scripts/lornwatch/plan.test.mjs scripts/veyholt/plan.test.mjs scripts/dealer-cards.test.mjs` (51 tests).
- Pass: `npm run typecheck`, `npm run build` with bundled Node24. Existing chunk-size warning remains.
- `npm run lint`: 16 errors and 1 warning. Matched against a clean archive of origin/main f349be4: identical files/rules/severities/messages (ignoring shifted source locations). No new findings. Existing errors are in TabletopContext, CreatureInspector, LiveAudio, NpcInteractionModal and SceneBuilderPage.
- Production bundle checked: no private chapter source lore, fixture endpoint, or Ada backstory. Turn's generic DM controls are production code.
- **Complete:** approved installation, native authenticated R2 uploads, database rollback rehearsal, exact preservation comparison across37 tables, four player-role RLS checks, all ten deployed maps, thirteen evidence previews, seven shop previews and four encounter compositions. See the live report for details. **Pending:** PR merge/deployment for Turn and its motion selector, followed by deployed multiplayer cinematic verification. Docker's local engine was unavailable; no local Postgres test is claimed. No merge/deployment performed.

Read the run sheet before playing. Manual story token continuity, shopping payment/rewards, writ timing, Ilan survival and post-sphere reveals are intentional DM decisions, not automation.

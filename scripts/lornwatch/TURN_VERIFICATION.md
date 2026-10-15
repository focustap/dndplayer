# Turn cinematic — review and verification

Implements the updated issue #27 requirement in the existing Cinematics menu. No schema change, NPC speech, damage, saves, initiative change or automatic token movement.

- **DM controls:** choose toward/away from Ilan (or an explicitly selected reference token), or one of eight map compass directions. Default reference searches Ilan, never Ada. A reference exactly at map center requires a compass choice.
- **Presentation:** MAP_TILT rotates a parent of the native Pixi board, including art, grid, overlays, props, effects and tokens. Sixteen-degree 2D roll, smooth entrance/return, eight-second lifetime, viewport-centered and scaled to keep edges inside the canvas. This is a cue; the chosen map-space direction is also indicated by an arrow. It is not a physical 3D perspective simulation.
- **Coordinates:** token hit testing uses Pixi inverse world transforms. Pan and mouse-centered zoom invert the presentation parent too. Turn skips the older token/camera capture-restoration path, so manual token moves, incoming moves, and zoom/pan survive expiration/cancellation.
- **Sync/authorization:** same existing tabletop_cinematic_events inserts/subscription and DM RLS; no new service. Turn uses server-calibrated createdAt timing, so delayed subscribers join the current phase rather than restarting. Only DM controls are rendered, and action handlers verify DM role. Builder triggers remain local. Cancel/restore sends an empty Restore view cinematic through the same channel outside builder; timestamp/revision guards reject stale events and in-flight trigger responses after cancellation.
- **Cleanup:** automatic return, cancellation, replaced cinematic, scene change, engine teardown and browser reload remove the presentation transform. MAP_TILT includes sceneId, preventing an old scene's effect from appearing after navigation. Reconnect does not reload transient Turn events.
- **Motion preferences:** Cinematics → Cinematic motion defaults to **Follow browser preference**. Reduced-motion clients get a static slope direction cue without map rotation/scaling. The DM can explicitly select **Full rotation — opt in** to rotate this browser even when its media query requests reduced motion, or **Reduced motion — static cue** to keep the map still regardless of that query. The choice persists in localStorage; blocked storage still permits a current-tab choice. It is a per-browser presentation preference, never a campaign setting or an override of another viewer's accessibility preference. Both the Pixi board and slope cue use the same preference.

Checks: seven dedicated unit/integration tests in `scripts/cinematic-tilt.test.mjs` cover toward/away/cardinal choice, delayed-client clock parity and expiration, easing, reduced motion, viewport fitting, actual Pixi matrix/pointer round trips and scene scoping/Restore semantics. Two tests in `scripts/cinematic-motion.test.mjs` cover default/opt-in/reduced behavior, persistence, subscriptions, removed/invalid preferences and denied storage.

Browser re-verification used the actual Cinematic motion control with the local in-Codex browser still reporting `prefers-reduced-motion: reduce = true`. **No source stubs, browser preference overrides or OS changes were used.** Follow browser preference kept the map horizontal with a static cue; Full rotation visibly rotated the actual artwork, NPCs and scene markers; Cancel / restore immediately restored the board. Reload retained Full rotation. Screenshots: ignored `outputs/lornwatch/turn-system-reduced.jpg`, `turn-full-opt-in.jpg`, `turn-opt-in-cancelled.jpg` and `turn-opt-in-expired.jpg`.

## Token regression

The original local fixture omitted `tokens.rotation`. `Number(undefined)` produced NaN and Pixi could not render those containers. New planner records explicitly include rotation, conditions, owner and image defaults. The shared production/preview deserializer now supplies finite position/rotation/size defaults for incomplete or malformed records while preserving valid authored transforms and hidden state. Pixi also guards rotation at the rendering boundary.

Three regression tests in `scripts/token-serialization.test.mjs` exercise legacy records, invalid numeric payloads, preservation of valid values and all twenty generated NPC/monster records across all nine scenes, including actual Pixi transform/inverse round trips. The in-Codex browser loaded every scene and rendered the following tokens. Hidden actors remain translucent DM-only ghosts; their visibility flags were not changed.

| Scene | Tokens checked |
| --- | --- |
| Sunpetal Square | Jory, Nell, two guards; hidden Ada continuity copy |
| Golden Finch Inn | Mira; hidden Nell continuity copy |
| Honeycrust Bakery | Pippa |
| Bramble & Brass | Oren |
| Ada's Cottage | Ada |
| Courthouse | Judge Ilan, Sera; two hidden court guards |
| Holding Cells | Hidden Martha and Jory |
| Lower Chamber | Hidden Ilan and dark sphere |
| Mossjaw Cavern | Hidden owlbear and cub |

Per-scene screenshots are ignored artifacts `outputs/lornwatch/tokens-01-square.jpg` through `tokens-09.jpg`; closer Jory/monster checks use the native Focus selected control. The earlier roster/upload checks did not catch this serialization bug; this pass checks the actual canvas as well as the roster.

Still pending: authenticated multi-client realtime verification after explicit live-testing approval. These checks used the isolated local native Scene Builder and synthetic event clocks; they are not proof of a production broadcast. No live database changes, uploads, deployment or campaign installation were made.

DM rules remain in LORNWATCH.md/run sheet: action, Recharge5–6, DC14 Dexterity or slide15ft until blocked, no inherent damage/opportunity attacks; earned anchoring/magic helps. Half sphere: DC12 and10ft; destruction ends the power. The DM narrates and resolves all mechanics.

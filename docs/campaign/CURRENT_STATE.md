# The Hollow — Current Campaign State

Use this file to understand where the campaign is **right now**. It should be updated as sessions advance.

## Current chapter status

The party is completing / has just completed the **Greymere Hollow** storyline.

The intended immediate state is:

- the party has investigated the disappearances north of Greymere
- they have followed the trail through Edrin's Camp and into the Hollow
- they have encountered the recurring `VII` mark
- they have fought through the first Hollow dungeon
- Jess's father is found in the first Hollow
- Zach's Dog is found in the first Hollow
- villagers/prisoners are also present in the jail-cell area
- the local Catalyst is defeated or is about to be defeated

Do not start the next chapter as though none of this happened.

## What the players should understand by the end of Greymere

They may understand that:

- Hollows are real places, not just superstition
- they can spread or affect nearby land/people
- people can disappear or be drawn into them
- the local Hollow had a concrete sustaining Catalyst
- destroying the Catalyst matters
- the `VII` mark is connected somehow, but its meaning is still unknown
- there is a larger pattern beyond one missing hunter or one village

They should **not** yet understand the campaign's full Hollow cosmology or final world-scale truth.

## Immediate narrative need

The next chapter needs a believable reason for all four characters to continue together after saving/finding their personal Greymere objectives.

This is especially important because:

- Jess has found the father she came looking for
- Zach has found Dog
- Cody originally had little reason to stay involved
- Aiden is naturally easy to motivate with danger/adventure but that alone should not carry the whole party

The transition should make continuing feel like the logical result of what they discovered, not a DM command.

## Next destination

**Veyrholt** is the next major town/location.

The next chapter should lead the party there and center on a new Hollow-related mystery.

Do not simply copy the Greymere sequence with different names. Veyrholt should teach the party something **new** about Hollows.

## Desired Veyrholt design direction

The next segment should ideally contain:

- a town with its own identity, problems, NPCs, and visual landmarks
- an apparently unrelated local problem or side plot that later proves connected to the Hollow
- clues that reward players who remember Greymere
- at least one recognizable `VII` connection or deliberate variation on that clue
- exploration outside town
- roleplay/investigation inside town
- combat that is not only random wildlife
- a dungeon/ruin/contained danger zone with multiple distinct encounters
- a new Catalyst concept
- a meaningful revelation about Hollow behavior/history
- a clue or consequence pointing beyond Veyrholt

## Player hooks to keep available

Use these where they fit naturally; do not force all of them into every scene.

### Jess

Jess's father can know, carry, remember, or have encountered something that points beyond Greymere. His connection to the Varakai can become more relevant without immediately explaining the faction's entire role.

### Zach

Dog's disappearance can have left behind a strange behavior, object, scent memory, reaction, or other clue suggesting the first Hollow affected more than prisoners physically. Keep Dog alive unless the user explicitly changes that.

### Cody

Cody needs a stronger reason to stay with the group. Knowledge, forbidden magic, lost writing, an unusual spell phenomenon, or evidence that challenges conventional magical understanding can hook him naturally.

The possible missing/stolen spellbook idea remains optional, not required canon.

### Aiden

Aiden is easy to draw toward danger, monsters, challenges, and opportunities to prove himself. Give him something satisfying to act on, but do not reduce every group motivation to "there is a fight."

## Information pacing

For Veyrholt, reveal **one meaningful new layer** about Hollows, not the entire answer.

Good examples of the scale of a reveal:

- Hollows may preserve or distort memories
- multiple Hollows may share symbols or architecture
- Catalysts may be created rather than naturally occurring
- people in the past studied or contained Hollows
- certain factions know more than they admit
- a Hollow can affect a town indirectly before its boundary reaches it

These are examples, not locked canon. Pick a direction that fits the final Veyrholt design and record it in the chapter plan.

## Implementation expectation

When Codex is asked to build Veyrholt, it should first create:

`docs/campaign/chapters/VEYRHOLT.md`

That file should lock the chapter design before large implementation work begins.

Then inspect Wayfinder's current campaign-management, scene, token, encounter, NPC, discoverable, interactable, and Supabase patterns and implement as much of the chapter as the existing architecture supports.

## Prepared next chapter

Veyrholt is fully designed in `docs/campaign/chapters/VEYRHOLT.md` and prepared in Wayfinder, but the current live scene has not been switched away from the existing Greymere-era state.

The intended progression is now:

**Greymere Catalyst → Level 2 → Messenger → Bellpost Road → Level 3 → Veyrholt → Castle Veyr → Bell Regent → Level 4 → Lornwatch Abbey**

Operational state:

- the existing hidden Greymere Messenger has updated, player-safe Veyrholt dialogue
- all Veyrholt scenes are inactive and unrevealed until the DM chooses to begin them
- maps, party entry tokens, NPCs, dialogue, Nessa's shop, hidden enemy placements, prepared encounters, discoverables, transitions, boss anchor markers, and DM-only campaign notes are loaded
- Veyrholt assets are stored in private R2; no Supabase Storage files were migrated or deleted
- the production campaign has not been switched to Veyrholt or otherwise advanced

## Required Veyrholt presentation refactor before play

The currently loaded Veyrholt content is narratively usable, but the town overview is too compressed spatially: the grand Veyrholt map currently carries party tokens, multiple NPCs, investigation clues, and direct links into several adventure areas.

Before running Veyrholt, follow:

`docs/campaign/chapters/VEYRHOLT_SCENE_RESTRUCTURE.md`

That document is the locked presentation target for Wayfinder:

- keep the grand Veyrholt art as a **gridless location-selection hub**
- do not use the overview as a normal tactical walking map
- create dedicated top-down scenes for The Brass Lamb, Reeve's Hall & Civic Archive, Calder Bellworks, Chapel of the Last Chime, and Old Tithe Barn
- keep Sunward Farms primarily investigative and move the barn combat to its own tactical scene
- move major NPCs and discoverables off the overview into the locations where they physically belong
- concentrate combat at Bellpost Road, Old Tithe Barn, optional Processional Court, Bellfoundry, and the Bell Regent
- preserve all Veyrholt lore, clues, rewards, R2 assets, DM notes, and current live reveal/active state while refactoring

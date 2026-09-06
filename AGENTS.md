# AGENTS.md — Wayfinder / The Hollow

These instructions apply to the entire repository.

## What this repository is

Wayfinder is a browser-based virtual tabletop. It is also the tool used to run the D&D campaign **The Hollow**.

Campaign-authoring tasks are not generic D&D-writing tasks. They must preserve the established lore, pacing, secrets, and Wayfinder architecture.

## Required reading for campaign tasks

Before planning, writing, or implementing any content for **The Hollow**, read these files in order:

1. `docs/campaign/CAMPAIGN_BIBLE.md`
2. `docs/campaign/CURRENT_STATE.md`
3. `docs/campaign/STORY_RULES.md`

Treat them as the campaign source of truth.

If the user's prompt conflicts with an older campaign document, the newest explicit user instruction wins. Update the relevant campaign document when the change is clearly intended to become canon.

## Canon hierarchy

For campaign content, use this priority order:

1. The user's current explicit instruction
2. `docs/campaign/CURRENT_STATE.md`
3. `docs/campaign/CAMPAIGN_BIBLE.md`
4. `docs/campaign/STORY_RULES.md`
5. Existing implementation/data in the repository
6. Your own invention

Never silently overwrite established canon with a new idea.

## DM secrets

Anything labeled `DM_SECRET`, `SECRET`, `LATER_REVEAL`, or otherwise described as unknown to the players is DM-only information.

Do not place DM-only information into player-visible dialogue, descriptions, notes, tooltips, discoverables, API responses, or database rows that player clients can read.

Foreshadow secrets through clues, consequences, symbols, inconsistencies, rumors, and environmental details rather than direct exposition.

## Campaign design requirements

When asked to create a new chapter, Hollow, town, dungeon, or major story segment:

- Build a coherent playable sequence, not disconnected encounter ideas.
- Include a strong reason for the party to continue from the previous chapter.
- Include exploration, roleplay, combat, discoveries, and at least one meaningful decision where appropriate.
- Prefer recurring clues and apparent side plots that later connect to the main mystery.
- Preserve the slow-burn mystery of the Hollows.
- Do not reveal the campaign's largest secrets early just because they would make a dramatic scene.
- Create NPCs with motives, useful knowledge, limits on what they know, and a reason to exist beyond exposition.
- Provide practical DM information: DCs, triggers, encounter composition, enemy tactics, loot, consequences, discoverables, and transition conditions.
- Avoid excessive boxed dialogue. The DM prefers concise scene notes and "what the NPC knows" over long scripts.
- Use D&D rules as a framework, but prioritize a fun encounter for this specific party over blindly copying a published stat block.

## Wayfinder implementation rules

Before implementing a campaign feature or chapter, inspect the existing patterns in `src/`, `supabase/`, and the relevant services/domain types.

Reuse Wayfinder's existing concepts wherever possible, including:

- campaigns and campaign members
- characters
- maps and scenes
- scene overlays
- tokens
- monster templates and monster instances
- encounters and encounter members
- campaign notes
- combat sessions and initiative
- discoverables/interactables/NPC dialogue/shop systems that exist in the current codebase
- Supabase Storage for campaign assets
- centralized realtime/tabletop state

Do **not** create a parallel campaign engine when an existing system can represent the content.

Do not weaken RLS or expose DM-only information to make implementation easier.

If a schema change is genuinely necessary, create a normal Supabase migration and preserve existing data and permissions.

Do not place service-role keys, database passwords, or other secrets in frontend code or committed files.

## Planning before implementation

For a substantial new campaign chapter:

1. Read the campaign docs.
2. Inspect the current implementation patterns needed for the task.
3. Write/update a chapter plan under `docs/campaign/chapters/` before making large implementation changes.
4. Identify what can be represented with existing Wayfinder systems and what, if anything, requires code changes.
5. Implement the smallest architecture changes necessary.
6. Verify the playable path from entry to chapter conclusion.

The chapter plan should include:

- chapter premise and player hook
- intended revelations and information that must remain secret
- locations/scenes in order
- NPCs and what each knows
- encounters and difficulty intent
- skill checks and DCs
- discoverables/clues
- loot/rewards
- branch/failure handling
- Catalyst encounter if applicable
- transition/hook to the following chapter
- Wayfinder implementation checklist

## Asset rules

Do not invent fake asset URLs.

If a required map, portrait, token image, or illustration is not present and cannot be created by the available tools, create a clearly named asset requirement/placeholder in the chapter plan and continue implementing everything that does not depend on the final image bytes.

Do not replace existing user-created campaign art unless explicitly asked.

## Engineering checks

After code changes, run the relevant checks when possible:

```bash
npm run lint
npm run typecheck
npm run build
```

Fix regressions introduced by your changes before finishing.

## Definition of done for a campaign chapter

A chapter is not done merely because prose exists. It should be runnable by the DM with minimal improvisation and, when the task includes implementation, represented in Wayfinder as completely as the existing systems allow.

At minimum, verify:

- the opening hook follows logically from current canon
- all required scenes/locations are accounted for
- encounters have composition, triggers, tactics, and rewards
- clues have a delivery method and purpose
- DM secrets are not exposed to players
- scene transitions are clear
- no required NPC or encounter is unreachable
- the conclusion changes the campaign state in some way
- the next story hook exists

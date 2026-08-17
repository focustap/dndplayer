# Wayfinder security model

Wayfinder treats the browser as untrusted. UI visibility is never the primary
authorization boundary; Supabase Auth and Postgres Row Level Security (RLS)
decide which rows each session can read or change.

## Role model

Campaign membership is stored in `campaign_members` with `OWNER`, `DM`,
`PLAYER`, or `SPECTATOR`. `OWNER` and `DM` are considered game-master roles.
Private helper functions in the unexposed `private` schema evaluate membership
using `auth.uid()`. They are `SECURITY DEFINER` only so an RLS policy can perform
an indexed membership lookup without recursively invoking membership RLS. The
private schema is not exposed through the Data API; authenticated sessions have
only the function permission required for policy evaluation.

## Data isolation

- `monster_templates` and `monster_instances` have no player SELECT policy.
  Monster HP, AC, abilities, notes, traits, and actions therefore never appear
  in a player query or Realtime event.
- `tokens` contains only map-safe presentation state. A player can read a token
  only when it is visible and belongs to the active scene. A visible monster
  token contains its display name and image, but no monster statistics.
- `character_private` and `campaign_notes` are DM-only. Player-readable
  character combat fields are projected through the security-invoker
  `characters_public` view.
- Players see only the active scene, its active map, and visible scene overlays.
  Hidden overlay storage objects are protected by Storage RLS as well as table
  RLS.
- Token movement is performed through `move_token`. A player cannot receive
  UPDATE permission on `tokens`; the RPC verifies ownership, type, lock state,
  campaign membership, and `auth.uid()` before changing coordinates.
- HP and turn changes use narrow RPCs that verify DM role in the database.

## Realtime

Clients subscribe once through the tabletop state layer. `sync_events` contains
only campaign ID, entity ID, and an invalidation type. It lets a player learn
that safe state must be reloaded without receiving a newly hidden token's old
row or a changed monster instance. The reload is filtered again by RLS.

## Fog caveat

Fog rendering prevents unrevealed areas from being shown in the player UI, but
the current client must download the full active map image to draw revealed
regions. A determined user can inspect that downloaded image outside the app.
True information-theoretic map secrecy requires a later server-rendered tile or
masked-raster pipeline; this limitation does not affect monster statistics,
hidden tokens, notes, or inactive scenes, which remain protected by RLS.

## Client keys

Only `VITE_SUPABASE_URL` and the publishable key belong in the browser. Secret
and `service_role` keys must never use a `VITE_` prefix or be committed.

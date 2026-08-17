# Wayfinder VTT

Wayfinder is a proprietary, browser-based virtual tabletop focused on helping a
game master run a combat encounter from one screen. It combines scene-based map
images, layered props/effects, tokens, fog, initiative, and fast creature
controls with Supabase-backed authentication, persistence, authorization, and
realtime synchronization.

Authentication is handled exclusively by Supabase. Users can continue with
Google or create an account with an email address and password. There is no
production demo-account bypass.

## Stack

- React 19, strict TypeScript, Vite, React Router, and Tailwind CSS
- PixiJS for the scene renderer, including the map image, overlays, tokens,
  grid, fog, selection, drag, pan, and zoom
- Supabase PostgreSQL, Auth, Realtime, and Storage
- PostgreSQL RLS and narrow RPCs for campaign permissions
- GitHub Actions and GitHub Pages for the production frontend

## Requirements

- Node.js 22.13 or newer
- npm 10 or newer
- Docker Desktop only when running the optional local Supabase stack
- A Supabase project for persistent multiplayer use

## Install and run

```bash
npm install
cp .env.example .env.local
npm run dev
```

The local Vite URL is normally `http://127.0.0.1:5173`. Supabase values are
required before sign-in is available.

Quality commands:

```bash
npm run lint
npm run typecheck
npm run build
```

## Supabase setup

1. Create a Supabase project.
2. In Authentication > URL Configuration, use this production Site URL:
   - `https://focustap.github.io/dndplayer/`
   Add these exact redirect URLs:
   - `http://127.0.0.1:5173/dashboard`
   - `https://focustap.github.io/dndplayer/dashboard`
3. In Authentication > Providers, enable Email and Google. In Google Cloud,
   create a Web OAuth client and add `https://focustap.github.io` as an
   authorized JavaScript origin. The authorized Google redirect URI remains:
   - `https://feqwcrytaponcbhvfozc.supabase.co/auth/v1/callback`
   Copy the Google client ID and secret into Supabase. Do not put the Google
   client secret in the frontend bundle.
4. Copy `.env.example` to `.env.local` and set:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
5. Do not place a secret key or `service_role` key in a `VITE_` variable.
6. Apply the migration:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

For a local stack:

```bash
npx supabase start
npx supabase db reset
```

The migration creates the private `campaign-assets` Storage bucket, RLS
policies, explicit Data API grants, Realtime publication entries, role-checking
RPCs, and the complete application schema. This is important for new Supabase
projects because SQL-created tables are no longer automatically exposed to the
Data API.

## GitHub Pages deployment

Production is built from `main` by `.github/workflows/deploy-pages.yml`. The
workflow installs the locked dependencies with `npm ci`, builds the Vite app,
uploads only `dist`, and deploys it with the official GitHub Pages Actions. It
can also be started manually from the Actions tab.

In GitHub, open **Settings > Pages** and set **Source** to **GitHub Actions**.
Create these repository Actions variables (repository secrets with the same
names also work):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Both values are browser-public Supabase configuration. Never add a database
password, secret key, or `service_role` key. `VITE_BASE_PATH` is optional; the
workflow normally uses the base path reported by GitHub Pages. Set it to `/`
only when moving to a root Pages site or custom domain.

The default production URL is `https://focustap.github.io/dndplayer/`. The app
uses React Router with that deployment basename. A generated `dist/404.html`
preserves and restores deep links before React starts, so direct visits and
refreshes of login, dashboard, campaign, DM, and player routes work on GitHub
Pages. The same redirect preserves Supabase OAuth query strings and URL hashes.

## Database model

Core tables:

- Identity and campaigns: `profiles`, `campaigns`, `campaign_members`
- Players: `characters`, `character_private`
- Image scenes: `maps`, `scenes`, `scene_overlays`, `fog_regions`, `tokens`
- Creatures: `monster_templates`, `monster_instances`, `conditions`
- Preparation: `encounters`, `encounter_members`, `campaign_notes`
- Combat: `combat_sessions`, `initiative_entries`
- Realtime invalidation: `sync_events`

All application IDs are UUIDs. Foreign-key fields and RLS lookup fields are
indexed. `scene_overlays` is deliberately separate from tokens: a transparent
fire, trap, prop, spell effect, or other asset has its own transform, opacity,
visibility, lock state, and z-order above an uploaded base map.

## Security model

Player and DM clients do not query the same sensitive shape and then hide fields
with CSS. Monster templates/instances and DM notes have no player SELECT policy.
Visible tokens contain only safe map presentation state. Hidden tokens and
hidden overlays are filtered by RLS, and their Storage objects are filtered by
Storage RLS. Player movement uses the `move_token` RPC because direct token
UPDATE access would allow changing fields other than coordinates.

See [docs/SECURITY_MODEL.md](docs/SECURITY_MODEL.md) for the complete model and
the documented limitation of client-rendered fog over a downloaded map image.

## Realtime architecture

`TabletopProvider` is the single state and subscription boundary for a live
table. Components do not create ad-hoc table subscriptions. Database triggers
write safe `sync_events`; clients reload the role-filtered scene snapshot when
an event arrives. Local token/overlay dragging stays responsive in Pixi, while
the final transform is persisted on drag end, avoiding a database write for
every pointer event.

At larger scale, migrate high-frequency state to Supabase Realtime Broadcast.
Postgres Changes is intentionally used for this first campaign-sized milestone.

## Project structure

```text
src/
  components/         application shell
  contexts/           auth and centralized tabletop state
  domain/             typed game models and demo records
  features/map/       Pixi application and React canvas adapter
  features/tabletop/  initiative, encounter, inspector, tools, context menu
  pages/              auth, dashboard, campaign setup, DM/player tables
  services/           Supabase reads, writes, uploads, and RPC calls
supabase/
  migrations/         PostgreSQL schema, RLS, Storage, RPCs, Realtime
docs/                  architecture and security notes
```

## Current limitations

- Fog is manual and shape-based; there is no wall vision, raycasting, or
  dynamic lighting.
- Full map-byte secrecy under fog requires a future server-side tile/masking
  service. The UI correctly renders fog, but the browser downloads the active
  map image.
- Overlay transforms use compact controls and direct dragging. On-canvas resize
  handles, multi-select, and layer grouping are future work.
- Encounter loading is modeled and represented in campaign setup, but prepared
  placement presets are not included yet.
- Shared monster initiative is supported as a grouped display. Start/end,
  manual scores, rolling, removal, turn advancement, and drag reordering are
  included; automatic rules-engine initiative modifiers are intentionally not.
- Desktop tabletop play is the priority; campaign management has basic smaller
  viewport support.

## Recommended next milestone

Add prepared encounter deployment and a stronger scene compositor: asset
library reuse, on-canvas transform handles, undo/redo, layer grouping, and a
server-generated fog tile pipeline. Then introduce wall geometry and vision as
new Pixi systems without changing the image-backed scene model.

## License

Proprietary software. All Rights Reserved. See [LICENSE](LICENSE).

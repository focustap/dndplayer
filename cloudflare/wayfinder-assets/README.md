# Wayfinder R2 asset worker

This Worker moves heavy Wayfinder files off Supabase Storage while leaving Supabase as the database/auth/realtime backend.

## Cloudflare resources

- R2 bucket: `wayfinder-assets`
- Worker binding: `ASSETS`
- Worker secret: `ASSET_SIGNING_SECRET`

The frontend never receives an R2 access key or secret.

## Deploy

From this directory:

```bash
npx wrangler secret put ASSET_SIGNING_SECRET
npx wrangler deploy
```

Use a long random value for `ASSET_SIGNING_SECRET`.

The Worker validates the browser's existing Supabase access token before signing, uploading, importing, or deleting an asset. Signed R2 URLs live for 12 hours and use a stable URL during that period so the browser can cache large maps and portraits.

## Migration

The `/v1/import` endpoint can copy an existing private Supabase Storage signed URL into R2 once. This lets Wayfinder migrate legacy assets lazily without exposing a Supabase service-role key.

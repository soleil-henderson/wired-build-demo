# Wired Build — deployment

## Environment variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `EXPO_PUBLIC_SUPABASE_URL` | EAS + local `.env` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | EAS + local `.env` | Anon/publishable key (RLS protects data) |
| `EXPO_PUBLIC_SITE_URL` | EAS production profile | Canonical share links (`/build/[id]`) |

Copy [.env.example](../.env.example) to `.env` for local development.

## EAS native builds

```bash
npm install -g eas-cli
eas login
eas init   # links project; set extra.eas.projectId in app.json
eas build --profile preview --platform ios
eas build --profile production --platform all
```

Production push requires APNs (iOS) and FCM (Android) credentials in the [Expo dashboard](https://expo.dev) → your project → Credentials.

Update `public/.well-known/apple-app-site-association` with your real Apple Team ID and bundle identifier (`ios.bundleIdentifier` in app.json).

## Supabase Auth (OAuth)

1. **Authentication → URL Configuration** — add redirect URLs:
   - `wiredbuilddemo://auth/callback` (Expo Go / native)
   - `exp://*` (Expo Go development)
   - `https://wiredbuild.com/app/auth/callback` (production web)
   - `http://localhost:8081/auth/callback` (local `expo start --web`, port may vary)
   - Set **Site URL** to `https://wiredbuild.com`
2. **Google Cloud Console** (OAuth client used by Supabase) → **Authorized JavaScript origins**:
   - `https://wiredbuild.com`
   - `http://localhost:8081` (local web dev)
3. **Providers → Apple** — Service ID, Team ID, Key ID, `.p8` key; callback `https://<project>.supabase.co/auth/v1/callback`
4. **Providers → Google** — OAuth client ID + secret; same Supabase callback on the Google console

## HTTPS (“Not Secure” in Chrome)

Chrome shows **Not Secure** when you open the site over **HTTP** (`http://wiredbuild.com`), not HTTPS.

1. **Always use** `https://wiredbuild.com` (bookmark the `https://` URL).
2. **Vercel** → Project → **Domains** → `wiredbuild.com` must show **Valid** SSL (Let’s Encrypt). Wait up to 24h after first DNS connect.
3. **GoDaddy DNS only** — use **A** `@` → `76.76.21.21` and **CNAME** `www` → `cname.vercel-dns.com`.  
   Do **not** use GoDaddy “Forward domain” / masking to Vercel; that often serves HTTP only.
4. Redeploy after `vercel.json` HTTPS redirect changes: `npm run build:web && npx vercel --prod`.

Google OAuth requires HTTPS on production web.

## Web (landing + app)

| URL | Content |
|-----|---------|
| `https://wiredbuild.com/` | Static marketing landing ([marketing/index.html](../marketing/index.html)) |
| `https://wiredbuild.com/app` | Expo web app (auth, garage, feed, …) |
| `https://wiredbuild.com/build/[id]` | Redirects to `/app/build/[id]` (short share links) |

```bash
npm run build:web   # exports app to dist/app/ + copies landing to dist/index.html
```

Deploy `dist/` to Vercel ([vercel.json](../vercel.json)).

Set `EXPO_PUBLIC_SITE_URL` to `https://wiredbuild.com` (site origin, not `/app`).

Supabase redirect URLs must include `https://wiredbuild.com/app/auth/callback`.

## Database

```bash
npx supabase link --project-ref <ref>
npx supabase db push
```

Confirm `pg_net` is enabled on hosted Supabase (push notifications migration).

## Stripe / Identity webhooks (when configured)

```bash
supabase functions deploy stripe-webhook --no-verify-jwt
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
```

Point Stripe webhooks at `https://<project>.supabase.co/functions/v1/stripe-webhook`.

## Admin user for moderation QA

Run [supabase/scripts/grant-admin.sql](../supabase/scripts/grant-admin.sql) in SQL Editor (set your handle), or set `users.is_admin = true` in Studio.

## Local testing

See [TESTING.md](./TESTING.md) and `npm run verify` / `npm run verify:db`.

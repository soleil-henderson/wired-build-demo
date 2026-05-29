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
   - `wiredbuilddemo://auth/callback`
   - `exp://*` (Expo Go development)
2. **Providers → Apple** — Service ID, Team ID, Key ID, `.p8` key; callback `https://<project>.supabase.co/auth/v1/callback`
3. **Providers → Google** — OAuth client ID + secret; same Supabase callback on the Google console

## Web (public share pages)

Static export for `/build/[id]` and marketing:

```bash
npm run build:web
```

Deploy the `dist/` folder (Vercel: [vercel.json](../vercel.json) rewrites all routes to `index.html` for expo-router).

Set `EXPO_PUBLIC_SITE_URL` to your production web origin so native Share uses the same domain.

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

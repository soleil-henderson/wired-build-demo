# Wired Build — testing guide

Quick reference for local QA and public beta setup. See also [DEPLOYMENT.md](./DEPLOYMENT.md).

## One-command checks

```bash
npm run verify          # env + typecheck + unit tests + lint
npm run verify:db       # above + confirm Supabase migrations are current
```

## Local smoke test (15–20 min)

1. Copy [.env.example](../.env.example) → `.env` with Supabase keys.
2. `npm install && npm run verify:db`
3. `npm run ios` (or `android` / `web`)
4. Walk through:
   - Sign up / sign in
   - Add vehicle → Log a mod (privacy **Public**) → see Feed
   - Build profile → Share
   - Explore search

If email confirmation is enabled in Supabase, confirm inbox or disable temporarily under **Auth → Email**.

## Test paid tiers without Stripe

In Supabase Studio → **Table Editor** → `users`:

| Column | Value |
|--------|--------|
| `subscription_tier` | `member`, `pro`, or `workshop` |
| `is_identity_verified` | `true` (verify badge) |
| `is_admin` | `true` (moderation + affiliate admin) |

Or run [supabase/scripts/grant-admin.sql](../supabase/scripts/grant-admin.sql) (replace handle).

## Web share (`/build/[id]`)

```bash
npm run build:web     # outputs to dist/
npm run preview:web   # local preview at http://localhost:3000/build/<vehicle-uuid>
```

Production deploy (requires `vercel login`):

```bash
chmod +x scripts/deploy-web.sh
./scripts/deploy-web.sh
```

Deploy `dist/` to Vercel; set `EXPO_PUBLIC_SITE_URL` to the production origin.

## EAS + OAuth + push (public beta)

1. `eas login` → `eas init` → `eas build --profile preview --platform ios`
2. Supabase **Auth → URL Configuration**: `wiredbuilddemo://auth/callback`, `exp://*`
3. Enable Apple + Google providers (callback: `https://<ref>.supabase.co/auth/v1/callback`)
4. Expo dashboard → Credentials → APNs + FCM

## Stripe webhook (when charging)

```bash
supabase functions deploy stripe-webhook --no-verify-jwt
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
```

Point Stripe to `https://<ref>.supabase.co/functions/v1/stripe-webhook`.

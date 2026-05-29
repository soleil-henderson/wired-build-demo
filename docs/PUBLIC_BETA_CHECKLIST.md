# Public beta checklist

Copy this list when moving from local QA to a wide beta. Automated prep: `npm run verify:db` and `npm run build:web`.

## Done in repo (no action)

- [x] Migrations 01–19 (`supabase db push`)
- [x] CI: typecheck, vitest, lint (`.github/workflows/ci.yml`)
- [x] Web export builds to `dist/` (`npm run build:web`)
- [x] Vercel config ([vercel.json](../vercel.json))
- [x] EAS profiles ([eas.json](../eas.json))

## You must do manually

### Web share

1. Deploy: `npx vercel --prod` (or connect GitHub repo in Vercel dashboard).
2. Set env in Vercel: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_SITE_URL` (= your Vercel URL).
3. Open `https://<your-domain>/build/<public-vehicle-uuid>` in a private window (logged out).

### EAS + stores

```bash
eas login
eas init                    # once: links project ID in app.json
eas build --profile preview --platform ios
eas submit --profile production --platform ios   # when ready for TestFlight
```

### Supabase Auth

- Redirect URLs: `wiredbuilddemo://auth/callback`, `exp://*`
- Apple + Google OAuth → callback `https://oappihyoqodqaylqsoqy.supabase.co/auth/v1/callback`

### Push

- Expo dashboard → Project → Credentials → APNs (iOS) + FCM (Android)
- Confirm `pg_net` enabled on Supabase (Database → Extensions)

### Admin + Stripe (optional until paid)

```bash
# SQL Editor: supabase/scripts/grant-admin.sql (set your handle)

supabase functions deploy stripe-webhook --no-verify-jwt
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
```

### Universal links

- Edit [public/.well-known/apple-app-site-association](../public/.well-known/apple-app-site-association) with your Apple Team ID.

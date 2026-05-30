# Environments

| Environment | Supabase project | App config |
|-------------|------------------|------------|
| Development | Local / shared dev ref | `.env` |
| Staging | Separate project recommended | EAS `preview` profile |
| Production | `oappihyoqodqaylqsoqy` or dedicated prod | EAS `production` profile |

## Required secrets (production)

Set in EAS, Vercel, and Supabase Edge Function secrets:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_SITE_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_IDENTITY_WEBHOOK_SECRET`
- `STRIPE_PRICE_MEMBER` / `STRIPE_PRICE_PRO` / `STRIPE_PRICE_WORKSHOP`
- `SITE_URL`
- `REDBOOK_API_KEY` / `KBB_API_KEY` (optional)
- `ANTHROPIC_API_KEY` (Wired AI)
- `SERPAPI_KEY` (Google Shopping + maintenance web search in Wired AI; product resolve)
- `IAP_ALLOW_SANDBOX=true` (dev only)

## Auth (sign-up / email)

In **Supabase → Authentication → Providers → Email**:

- Turn on **Confirm email** (recommended for production).
- Turn on **Email OTP** so sign-up emails include a 6-digit code (not only a magic link).

In **Authentication → URL Configuration**:

| Setting | Value |
|---------|--------|
| Site URL | `https://wiredbuild.com` |
| Redirect URLs | `https://wiredbuild.com/app/auth/callback`, `https://www.wiredbuild.com/app/auth/callback` |

The app flow: **Create account → enter code on the same tab → onboarding**. If a confirmation link still opens the marketing homepage, it auto-forwards to `/app/auth/callback`.

Customize the **Confirm signup** email template to show `{{ .Token }}` (OTP). See [Supabase email OTP docs](https://supabase.com/docs/guides/auth/auth-email-passwordless#email-otp).

## Edge Functions

```bash
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook --no-verify-jwt
supabase functions deploy create-identity-session
supabase functions deploy stripe-identity-webhook --no-verify-jwt
supabase functions deploy verify-iap
supabase functions deploy estimate-valuation
supabase functions deploy generate-image-variants
supabase functions deploy wired-ai
```

Apply latest DB (includes events, private invites, DM event shares):

```bash
npm run db:push
```

Event locations + confirmation email:

```bash
supabase secrets set GOOGLE_MAPS_API_KEY=your_google_maps_key
supabase secrets set RESEND_API_KEY=re_...
supabase secrets set RESEND_FROM_EMAIL="Wired Build <events@wiredbuild.app>"
supabase functions deploy places-autocomplete
supabase functions deploy notify-event-created
```

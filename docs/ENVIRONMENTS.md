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
- `IAP_ALLOW_SANDBOX=true` (dev only)

## Edge Functions

```bash
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook --no-verify-jwt
supabase functions deploy create-identity-session
supabase functions deploy stripe-identity-webhook --no-verify-jwt
supabase functions deploy verify-iap
supabase functions deploy estimate-valuation
supabase functions deploy generate-image-variants
```

# Payment sandbox QA

## Stripe (web / Android)

1. Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_PRICE_*` on the Supabase project.
2. Deploy `create-checkout-session` and `stripe-webhook`.
3. Point Stripe CLI: `stripe listen --forward-to https://<ref>.supabase.co/functions/v1/stripe-webhook`
4. In app: Profile → Subscription → upgrade Member/Pro/Workshop.
5. Complete Checkout with test card `4242 4242 4242 4242`.
6. Confirm `users.subscription_tier` updates only from webhook (not client).
7. Test renewal, `customer.subscription.deleted`, and refund events.

## iOS IAP

1. Configure products in App Store Connect: `wired_member_monthly`, `wired_pro_monthly`, `wired_workshop_monthly`.
2. EAS production or development build with StoreKit (Expo Go uses Stripe on web only).
3. Sandbox Apple ID purchase → `verify-iap` Edge Function → tier flip.
4. Profile → Restore purchases on iOS.

## Identity

1. Deploy `create-identity-session` and `stripe-identity-webhook`.
2. Profile → Identity → complete Stripe Identity test flow.
3. Confirm `users.is_identity_verified` after webhook.

# Legal review checklist

Before production launch, have counsel review:

- [src/app/legal/privacy.tsx](../src/app/legal/privacy.tsx) — photos, VIN, receipts, location (if collected)
- [src/app/legal/terms.tsx](../src/app/legal/terms.tsx) — marketplace, subscriptions, user content
- Account deletion: `delete_own_account()` RPC + storage purge ([src/lib/auth-account.ts](../src/lib/auth-account.ts))
- App Store / Play privacy nutrition labels aligned with actual data collection
- Stripe + Identity data processing agreements

This repo ships template copy only; it is not legal advice.

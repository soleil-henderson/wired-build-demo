# RLS audit checklist

Review before production launch. All `public` tables should have RLS enabled.

## Critical paths

| Resource | Policy intent | Test as |
|----------|---------------|---------|
| `vehicles` | Public rows readable when `is_public`; owner full access | anon, stranger, owner |
| `mods` | `public` / `followers` / `own` privacy | follower, non-follower, owner |
| `media` | Photos follow mod visibility; receipts owner-only | anon on public build |
| `posts` | Mirror vehicle visibility | anon vs owner |
| `receipts` bucket | Owner read/write only | signed URL test |
| `users` | Public profile fields for anon on public builds | |

## SECURITY DEFINER RPCs

| Function | Caller | Validates |
|----------|--------|-----------|
| `transfer_vehicle_ownership` | Owner only | `auth.uid()` = current owner |
| `delete_own_account` | Self only | cascades storage |
| `recalc_vehicle_total_spend` | Triggers / service | no direct client abuse |
| `check_rate_limit` | Authenticated | per-user buckets |

## Followers privacy (migration 17)

- Mod `privacy = followers` visible only if viewer follows `vehicles.current_owner_id`
- Post removed when mod leaves `public`

Sign-off: _______________  Date: _______________

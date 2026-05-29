# Wired Build — screen matrix (design QA)

Reference tokens: [tailwind.config.js](../../tailwind.config.js) — ink palette, accent `#F5A524`, Inter (body), Space Grotesk (display).

| Route | Screen | P0 checks |
|-------|--------|-----------|
| `/(auth)/sign-in` | Sign in | OAuth row, email fields, forgot link |
| `/(auth)/sign-up` | Sign up | Same visual weight as sign-in |
| `/(auth)/forgot-password` | Reset | Single CTA, success copy |
| `/(auth)/onboarding` | Onboarding | Handle + display name, CTA to add vehicle |
| `/(tabs)/` | Feed | Mode chips, cards 16:9 image, badges, infinite scroll footer |
| `/(tabs)/explore` | Explore | Search, for-sale section, popular parts, trending |
| `/(tabs)/log` | Log tab | Vehicle picker CTA |
| `/(tabs)/garage` | Garage | Cover thumb, public/for-sale badges |
| `/(tabs)/profile` | Profile | Avatar hero, stats, action chips |
| `/log/new` | Log a mod | Photo grid, part search, date picker, privacy chips |
| `/log/edit` | Edit mod | Same density as new |
| `/vehicle/[id]` | Build profile | Hero 16:9, stats row, timeline |
| `/vehicle/edit` | Edit build | For-sale toggle, cover upload |
| `/vehicle/transfer` | Transfer | Handle lookup, confirm destructive |
| `/vehicle/plan` | Build plan | List + log mod CTA |
| `/build/[id]` | Public share | Logged-out buyer CTA, masked VIN |
| `/post/[id]` | Post detail | Composer sticky, comments |
| `/user/[handle]` | User profile | Follow/block, garage list |
| `/workshop/[handle]` | Workshop | Business fields, contact CTA |
| `/part/[id]` | Part detail | Stats grid, affiliate CTA |
| `/profile/subscription` | Tiers | Current badge, upgrade buttons |
| `/profile/verify` | Identity | Verified state vs start flow |
| `/profile/workshop` | Workshop edit | is_workshop toggle |
| `/wishlist` | Wishlist | Grouped by vehicle |
| `/notifications` | Inbox | Read state, tap targets |
| `/settings/notifications` | Prefs | Switches per type |
| `/settings/saved-searches` | Saved searches | List + delete |
| `/admin/moderation` | Admin | Pending parts approve |
| `/legal/privacy` | Privacy | Readable prose |
| `/legal/terms` | Terms | Readable prose |

## Component standards

- Section label: `text-accent text-xs font-semibold tracking-[3px]`
- Primary button: `rounded-xl bg-accent` + `text-ink-950 font-semibold`
- Cards: `rounded-2xl border border-ink-700 bg-ink-900`
- Min touch target: 44pt (`py-3` minimum on pressables)

## Web parity

Public `/build/[id]` must match mobile share: hero, owner card, mods timeline, for-sale banner.

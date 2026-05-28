# Wired Build

The social network and structured record-keeping app for 4WD owners. Every modification
a user makes to their vehicle is logged against the VIN — part, brand, cost, install date,
who did the work — and the resulting build profile becomes a permanent, transferable, and
monetisable asset.

App 03 of the Wired Automotive Group ecosystem. See `WiredBuild_BuildSpec.docx` for the
full spec; this README only covers running the codebase.

## Stack

- **App:** Expo (React Native) + TypeScript + expo-router
- **Styling:** NativeWind (Tailwind for React Native) — palette in `tailwind.config.js`
- **Backend:** Supabase (Postgres + Auth + Storage + RLS)
- **Migrations:** SQL files under `supabase/migrations/`, applied with `supabase db push`

## Project structure

```
src/
  app/
    _layout.tsx              Root layout + auth gate
    (auth)/                  Sign-in / sign-up stack
    (tabs)/                  5-tab app (Feed, Explore, Log, Garage, Profile)
    garage/add-vehicle.tsx   Manual vehicle entry off the Garage tab
    log/new.tsx              The Log-a-Mod form (Spec §4.1) — opens with ?vehicleId=
    vehicle/[id].tsx         Build profile: hero, stats, spend breakdown, mod timeline
  lib/
    supabase.ts              Typed Supabase client (uses AsyncStorage for sessions)
    auth-context.tsx         Session state + sign-in / sign-up / sign-out
    parts.ts                 searchParts() + submitCustomPart() helpers
    mods.ts                  listVehicleMods() with joined part info
  types/
    database.ts              Hand-typed Database type (regenerate from CLI when ready)
supabase/
  config.toml                Supabase CLI config
  migrations/
    20260528000001_init_core.sql   users, vehicles, parts, mods, media + enums + indexes
    20260528000002_rls.sql         RLS policies per Spec §3.3
    20260528000003_mod_aggregates.sql  Triggers: vehicles.total_spend + parts.install_count
  seed.sql                   ~30 popular AU 4WD parts so autocomplete has content
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env` and fill in the values for your Supabase project. The
project this repo was scaffolded against:

- Project ref: `oappihyoqodqaylqsoqy`
- API URL: `https://oappihyoqodqaylqsoqy.supabase.co`

`.env` is git-ignored. Keys with the `EXPO_PUBLIC_` prefix get inlined into the JS bundle
at build time, which is appropriate for Supabase publishable / anon keys (they are
protected by RLS).

### 3. Apply the database schema

The first time on this machine you need to authenticate the Supabase CLI:

```bash
npx supabase login                                  # opens a browser
npx supabase link --project-ref oappihyoqodqaylqsoqy
npx supabase db push                                # applies all migrations
psql "$(npx supabase status --output env | grep DB_URL | cut -d= -f2-)" \
  -f supabase/seed.sql                              # optional: seed parts catalogue
```

If you would rather avoid the CLI, paste each file in `supabase/migrations/` into the
Supabase Studio SQL editor in order (oldest first), then optionally paste `seed.sql`.
RLS is enabled on every table.

### 4. (Optional) Regenerate the TypeScript types

Once the schema is live, replace the hand-written `src/types/database.ts` with the
generated version:

```bash
npx supabase gen types typescript --project-id oappihyoqodqaylqsoqy > src/types/database.ts
```

### 5. Run the app

```bash
npm run ios       # iOS Simulator
npm run android   # Android emulator
npm run web       # Browser (fastest to iterate; some native features stub out)
```

> Use `npm run` (not `npx expo start`) — `npx` will resolve a *fresh* global copy of
> `expo` instead of the local one and fail with "Cannot determine the project's Expo
> SDK version". The npm scripts call the local `node_modules/.bin/expo` correctly.

## What works today

### Step 1 — Foundations (Spec §9 Step 1)

- Email sign-up / sign-in / sign-out backed by Supabase Auth
- App shell with a 5-tab layout (Feed, Explore, Log, Garage, Profile)
- Manual "Add vehicle" flow that writes to `vehicles` with VIN validation
- Garage tab lists vehicles owned by the signed-in user
- Profile tab shows the current user's profile row (auto-created by trigger)
- Core 5 tables with RLS so users can only read/write what they're allowed to

### Step 2 — The core loop (Spec §9 Step 2)

- **Log-a-Mod flow** (Spec §4.1) — single dense screen, target under 90s capture:
  part picker with live autocomplete, "+ Add custom part" fallback that submits
  to the moderation queue, category chips, cost (with approximate flag),
  installer type, install date, notes, privacy
- **Build profile** at `/vehicle/[id]` (Spec §4.3 lite) — hero with VIN/year/make/model,
  stats (mods / spent / build value), spend-by-category breakdown, reverse-chronological
  mod timeline with installer and date
- **Garage tab** shows mod count per vehicle and links to the build profile
- **SQL triggers** that keep `vehicles.total_spend` and `parts.install_count` in sync
  whenever a mod is inserted, updated, or deleted (Spec §5.16)
- **Seeded parts catalogue** (~30 popular AU 4WD parts) so the autocomplete works
  from day one

## What's next

- **Photo upload** — `expo-image-picker` + Supabase Storage buckets (deferred from Step 2)
- **Step 3** — Plan / wishlist tables and screens
- **Step 4** — Social: posts, comments, reactions, follows, notifications
- **Step 5** — Subscriptions, badges, public web share pages
- **Step 6** — Cross-app hooks, VIN scanning, valuation API, search index

## Conventions

- VIN is the canonical identifier. `vehicles.vin` is unique and checked for length 17.
- Ownership transfers update `current_owner_id` and append to `ownership_chain`; history
  never disappears.
- Subscription state lives on `public.users.subscription_tier`, updated server-side
  only (Stripe / app-store webhooks). Never trust the client.
- Receipts and other sensitive media live in a separate bucket; `media.is_sensitive`
  marks rows that should never be public.

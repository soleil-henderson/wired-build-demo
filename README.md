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
    garage/                  Stack screens off the Garage tab (e.g. add-vehicle)
  lib/
    supabase.ts              Typed Supabase client (uses AsyncStorage for sessions)
    auth-context.tsx         Session state + sign-in / sign-up / sign-out
  types/
    database.ts              Hand-typed Database type (regenerate from CLI when ready)
supabase/
  config.toml                Supabase CLI config
  migrations/
    20260528000001_init_core.sql   users, vehicles, parts, mods, media + enums + indexes
    20260528000002_rls.sql         RLS policies per Spec §3.3
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
npx supabase db push                                # applies both migrations
```

If you would rather avoid the CLI, paste each file in `supabase/migrations/` into the
Supabase Studio SQL editor in order (oldest first). RLS is enabled on every table.

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

## What works today (Step 1 — Foundations, per Spec §9)

- Email sign-up / sign-in / sign-out backed by Supabase Auth
- App shell with a 5-tab layout (Feed, Explore, Log, Garage, Profile)
- Manual "Add vehicle" flow that writes to `vehicles` with VIN validation
- Garage tab lists vehicles owned by the signed-in user
- Profile tab shows the current user's profile row (auto-created by trigger)
- Core 5 tables with RLS so users can only read/write what they're allowed to

## What's next

- **Step 2** — Log-a-mod flow (camera, parts search, cost, confirm)
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

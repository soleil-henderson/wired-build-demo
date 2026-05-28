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
    post/[id].tsx            Post detail: post card + comment thread + composer
    user/[handle].tsx        Public user profile: hero, stats, follow, garage
    notifications.tsx        Inbox: follows / reactions / comments, mark-all-read on open
    wishlist/new.tsx         Quick-add form for planned parts (?vehicleId= optional)
  lib/
    supabase.ts              Typed Supabase client (uses AsyncStorage for sessions)
    auth-context.tsx         Session state + sign-in / sign-up / sign-out
    parts.ts                 searchParts() + submitCustomPart() helpers
    mods.ts                  listVehicleMods() with joined part info + first photo
    storage.ts               uploadModPhoto() — reads file URI -> uploads to mod-photos bucket
    feed.ts                  listFeed() / getPost() / togglePostLike()
    comments.ts              listComments() + addComment()
    follows.ts               isFollowing / toggleFollow / getFollowCounts
    users.ts                 getUserByHandle / getUserById / listUserVehicles
    notifications.ts         listNotifications / getUnreadCount / markAllRead
    wishlist.ts              listVehicleWishlist / addWishlistItem / removeWishlistItem
  types/
    database.ts              Hand-typed Database type (regenerate from CLI when ready)
supabase/
  config.toml                Supabase CLI config
  migrations/
    20260528000001_init_core.sql              users, vehicles, parts, mods, media + enums + indexes
    20260528000002_rls.sql                    RLS policies per Spec §3.3
    20260528000003_mod_aggregates.sql         Triggers: vehicles.total_spend + parts.install_count
    20260528000004_seed_parts_catalogue.sql   ~30 popular AU 4WD parts
    20260528000005_storage.sql                mod-photos / receipts buckets + storage.objects policies
    20260528000006_social.sql                 posts, comments, reactions, follows, notifications + indexes
    20260528000007_social_rls_triggers.sql    Social RLS + auto-post-on-public-mod + reaction_count trigger
    20260528000008_notifications_triggers.sql Emit notifications on follow / reaction / comment
    20260528000009_wishlist.sql               wishlist_items table + priority enum + own-only RLS
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
```

`db push` runs every migration in `supabase/migrations/` — schema, RLS, mod
aggregate triggers, the seeded parts catalogue, **and** the storage buckets and
their access policies. If you'd rather avoid the CLI, paste each migration file
into the Supabase Studio SQL editor in order (oldest first). RLS is enabled on
every public table; the storage buckets get matching policies on
`storage.objects`.

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
  - **Photo step**: take with camera or pick from library (up to 8), with thumbnails
    and per-photo remove
  - Part picker with live autocomplete and "+ Add custom part" fallback that submits
    to the moderation queue
  - Category chips, cost (with approximate flag), installer type, install date
    (with approximate flag), notes, privacy
  - Photos upload to the `mod-photos` Supabase Storage bucket *after* the mod is
    saved, so a flaky network can't lose the mod itself
- **Build profile** at `/vehicle/[id]` (Spec §4.3 lite) — hero with VIN/year/make/model,
  stats (mods / spent / build value), spend-by-category breakdown, reverse-chronological
  mod timeline with the first attached photo as a cover image
- **Garage tab** shows mod count per vehicle and links to the build profile
- **SQL triggers** that keep `vehicles.total_spend` and `parts.install_count` in sync
  whenever a mod is inserted, updated, or deleted (Spec §5.16)
- **Seeded parts catalogue** (~30 popular AU 4WD parts) so the autocomplete works
  from day one
- **Two storage buckets** with owner-only writes and bucket-appropriate reads
  (`mod-photos` is public for the CDN; `receipts` is restricted per Spec §7.1)

### Step 4 — Social (Spec §9 Step 4, MVP slice)

- **Feed tab** is real: reverse-chronological list of recent public posts across
  the network, each card with author, vehicle, mod photo + part + cost, and a
  tap-target that opens the build profile
- **Posts auto-create on public mods** via a Postgres trigger — Spec §4.1's
  "a posts row if public" is enforced server-side so the social layer can never
  drift from the underlying mods
- **Likes**: heart button on each post card with optimistic UI; a server-side
  trigger keeps `posts.reaction_count` in sync regardless of the client. RLS
  guarantees a user can only insert/delete their own reaction.
- **Post detail** at `/post/[id]` — full post + threaded comments + a sticky
  composer at the bottom. `comment_count` stays in sync via a Postgres trigger.
- **User profiles** at `/user/[handle]` — avatar, bio, vehicle / follower /
  following counts, public garage, **Follow / Following** toggle (with
  optimistic updates and self-follow blocked). Feed cards and comment author
  rows tap-through to the right user.
- **Profile tab** shows the signed-in user's real follower / following / vehicle
  counts and links to their own public profile.
- **Notifications** at `/notifications` — follows, reactions and comments land
  here in real time. Server-side Postgres triggers emit them (so the social
  layer can never drift from the database), payloads are denormalised for fast
  rendering, self-actions are skipped, and unliking / unfollowing cleans up the
  matching notification. Visiting the inbox marks everything as read; the bell
  in the Feed header shows an unread count.
- **Feed mode toggle** — segmented "For you" / "Following" control at the top
  of the Feed. Following-mode lists posts authored by users the viewer follows
  (one extra round-trip to fetch followee ids); empty state nudges them to
  follow someone.

### Step 3 — Plan / Wishlist (Spec §9 Step 3)

- **Wishlist** (Spec §4.5) — owner-only "what's next" list on each build
  profile. Quick-add form at `/wishlist/new` accepts a catalogue part or
  custom name, target cost (AUD), category, priority (low / medium / high)
  and free-text notes. Rows are sorted by priority then recency on the build
  profile, can be removed inline (optimistic), and are kept strictly private
  by RLS — RLS rejects writes that target a vehicle the user doesn't own.
- **Promote wishlist → mod** — tap **Log it** on any wishlist row to open
  the Log-a-Mod form pre-filled with the part, category, target cost
  (flagged approximate) and notes. The wishlist row is deleted only after
  the mod insert and photo uploads succeed, so a save failure leaves the
  wishlist intact.

## What's next

- **Trending feed slice** scoped to the viewer's make (Spec §4.4 bonus)
- **General wishlist** — a tab outside any specific vehicle profile for
  cross-build planning (the schema already supports `vehicle_id = null`)
- **Explore tab** — populate with the parts catalogue + popular-mods-by-vehicle
- **Step 3** — Plan / wishlist tables and screens
- **Step 5** — Subscriptions, badges, public web share pages
- **Step 6** — Cross-app hooks, VIN scanning, valuation API, search index
- **Polish** — image resizing/AVIF conversion background job (Spec §7.2), OCR for
  receipts, OAuth (Apple/Google) sign-in

## Conventions

- VIN is the canonical identifier. `vehicles.vin` is unique and checked for length 17.
- Ownership transfers update `current_owner_id` and append to `ownership_chain`; history
  never disappears.
- Subscription state lives on `public.users.subscription_tier`, updated server-side
  only (Stripe / app-store webhooks). Never trust the client.
- Receipts and other sensitive media live in a separate bucket; `media.is_sensitive`
  marks rows that should never be public.

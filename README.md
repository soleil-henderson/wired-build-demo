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
    garage/add-vehicle.tsx   Vehicle entry off the Garage tab (with VIN scan)
    garage/scan-vin.tsx      Camera barcode scanner — Code 39 / 128 / QR
    log/new.tsx              The Log-a-Mod form (Spec §4.1) — opens with ?vehicleId=
    vehicle/[id].tsx         Build profile: hero, stats, spend breakdown, mod timeline
    post/[id].tsx            Post detail: post card + comment thread + composer
    user/[handle].tsx        Public user profile: hero, stats, follow, garage
    notifications.tsx        Inbox: follows / reactions / comments, mark-all-read on open
    part/[id].tsx            Part detail: stats, recent installs, +Wishlist
    profile/subscription.tsx Tier comparison (Free / Member / Pro / Workshop)
    profile/verify.tsx       Identity verification placeholder (Stripe Identity / Onfido)
    vehicle/transfer.tsx     Ownership transfer flow (handle lookup + confirm)
    build/[id].tsx           Public share page (no auth required, web + native)
    wishlist/index.tsx       User's complete wishlist grouped by build + General
    wishlist/new.tsx         Quick-add form for planned parts (?vehicleId= optional)
  components/
    UserBadges.tsx           Verified / Pro / Workshop pills, two sizes
  lib/
    supabase.ts              Typed Supabase client (uses AsyncStorage for sessions)
    auth-context.tsx         Session state + sign-in / sign-up / sign-out
    parts.ts                 searchParts() + submitCustomPart() helpers
    mods.ts                  listVehicleMods() with joined part info + first photo
    storage.ts               uploadModPhoto() — resize + re-encode to JPEG, then uploads to mod-photos bucket
    feed.ts                  listFeed() / getPost() / togglePostLike()
    comments.ts              listComments() + addComment()
    follows.ts               isFollowing / toggleFollow / getFollowCounts
    users.ts                 getUserByHandle / getUserById / listUserVehicles
    notifications.ts         listNotifications / getUnreadCount / markAllRead
    wishlist.ts              listVehicleWishlist / listUserWishlist / addWishlistItem
    explore.ts               searchUsers / searchPartsForExplore / listPopularParts / listTrendingPosts
    ownership.ts             transferVehicleOwnership (RPC) / findRecipientByHandle / listOwnershipHistory
    public-build.ts          getPublicBuild() + publicBuildUrl() for the share page
    vin-handoff.ts           In-memory channel for scanned VIN -> Add-Vehicle
    vin-decode.ts            NHTSA vPIC lookup: VIN -> {year,make,model,trim}
    push-notifications.ts    Expo Push token registration + tap routing
    reviews.ts               list / getMine / upsert / delete + recordPartClick
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
    20260528000010_ownership_transfer.sql     ownership_transfers audit table + transfer_vehicle_ownership() RPC
    20260528000011_push_notifications.sql     pg_net trigger -> Expo Push API on notifications insert
    20260528000012_part_reviews.sql           part_reviews + part_clicks tables, parts.review_count + avg_rating aggregate trigger
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
- **My wishlist** at `/wishlist` — top-level screen that lists every
  wishlist item the signed-in user owns, grouped by vehicle with a
  separate "General" group for items not yet assigned to a build. Reached
  from the Profile tab. Each row keeps the same **Log it** / **Remove**
  affordances as the per-vehicle wishlist; the **Log it** button is hidden
  for General items (no vehicle to log against yet).

### Explore tab (Spec §4.7)

- **Search bar** at the top: debounced live search across people (by handle
  or display name) and parts (by brand or name). Results are split into
  "People" and "Parts" sections; tapping a person opens their public
  profile, tapping a part offers **+ Wishlist** straight from the row.
- **Popular parts** — top 12 parts in the catalogue by `install_count`,
  with a one-tap **+ Wishlist** that saves to the user's General wishlist
  (since there's no vehicle context on Explore).
- **Trending this month** — top 6 public posts in the last 30 days,
  ordered by reaction count then recency. Tap-through opens the full post
  detail with comments.
- **Part detail** at `/part/[id]` — drill into any catalogue part to see
  its install count, average cost, total spent across the community,
  DIY-vs-workshop split, last-installed timestamp, and a recent-installs
  feed (each row links to the build and to the owner's profile). Reached
  by tapping a popular-parts row, a part label on the post detail, or any
  catalogued part in a build profile's mod timeline. **+ Save to wishlist**
  saves to the user's General wishlist with one tap.

### Step 5 — Subscription tiers + identity (Spec §9 Step 5)

- **Status badges everywhere** — three small pills (`✓ Verified`, `PRO`,
  `WORKSHOP`) shown next to the user's name on the profile hero, Profile
  tab, Feed cards, post detail, comments, Explore people search, and the
  part detail's recent installs. Source-of-truth is the user row:
  `is_identity_verified`, `subscription_tier` and `is_workshop` — all
  server-controlled, never trusted from the client.
- **Subscription tiers** at `/profile/subscription` — Free / Member / Pro /
  Workshop with their perks side-by-side and a placeholder upgrade button
  per tier. The Alert explains that checkout will route through
  Stripe / App Store webhooks and that `subscription_tier` only flips
  server-side.
- **Identity verification** at `/profile/verify` — placeholder for a
  Stripe Identity / Onfido flow. Explains what the partner will ask for,
  emphasises we only persist the boolean (no documents), and shows the
  verified state when `is_identity_verified = true`.

### Public share page (Spec §3.2, §4.3 "transferable, monetisable asset")

- **`/build/[id]`** is reachable without an account — the root auth gate
  exempts the `build` segment so the URL works for a logged-out buyer
  evaluating the build. Expo Router serves the same file on web
  (`wiredbuild.app/build/<uuid>`) and native (deep-link), with one
  helper (`getPublicBuild`) doing all three queries (vehicle + mods +
  ownership history) in parallel.
- Page composition: hero (year/make/model, masked VIN, mod count, total
  spent, build value), owner card with badges and tap-through to
  `/user/[handle]`, spend-by-category breakdown, full public mods
  timeline (links to `/part/[id]`), and the **ownership chain**
  rendered straight from `ownership_transfers`. For logged-out viewers
  the page wraps a "Sign up" banner top and a marketplace-pitch CTA at
  the bottom; logged-in viewers see a clean profile.
- Native **Share** button on `/vehicle/[id]` (owner or public-viewer)
  invokes the OS share sheet with the canonical share URL via
  `EXPO_PUBLIC_SITE_URL` (defaults to `https://wiredbuild.app`).
- RLS does the heavy lifting: anon can only read vehicles flagged
  `is_public`, their owners (`users` allow anon read), public mods,
  non-sensitive public-mod media, and ownership transfers — so the
  page literally cannot leak a private build.

### On-device image processing (Spec §7.2 slice)

- **Resize + re-encode before upload** — every mod photo runs through
  `expo-image-manipulator` in `uploadModPhoto`: if the longer edge is
  over 1920px we downscale (preserving aspect ratio), then re-encode to
  JPEG at quality 0.85. A typical 5-8MB iPhone HEIC ends up 300-600KB.
- **EXIF stripped** — re-encoding through ImageManipulator drops the
  embedded EXIF, including GPS coordinates, so we never accidentally
  leak where the photo was taken.
- **Format normalised** — storage keys always end in `.jpg` with
  `Content-Type: image/jpeg`. The CDN doesn't have to negotiate HEIC
  support and feed cards render fast on any client (including the web
  share page).
- **Actual dimensions persisted** — the `media` row's width / height
  reflect the resized image, not the picker's original numbers, so
  downstream layout (aspect-ratio placeholders) is accurate.
- AVIF + multi-resolution variants are still on the "What's next" list
  (would need a Supabase Edge Function on bucket events) — the
  client-side pass above is the 80/20 win without any new infra.

### Part reviews + affiliate links (Spec §4.7, §8 revenue surface)

- **One review per user per part** — `part_reviews` has a UNIQUE on
  `(part_id, user_id)`, so the composer always `upsert`s the same row.
  Public read RLS lets anyone (including the public share page) see
  community sentiment; writes are gated by `user_id = auth.uid()`.
- **Aggregate trigger** — `part_reviews_after_change()` keeps
  `parts.avg_rating` (`numeric(3,2)`) and the new `parts.review_count`
  in sync after every insert / update / delete. Means the stats row at
  the top of `/part/[id]` is a one-row read, not a `GROUP BY`.
- **Reviews UI on `/part/[id]`** — composer collapses inline, prefills
  with the user's existing review when present, validates 1-5 stars,
  optional notes. Each review card links to the author's profile and
  renders their `UserBadges` so a Workshop's review carries the right
  weight visually.
- **Affiliate links** — `parts.affiliate_links` is free-form JSON; we
  recognise a `{ "url": "...", "label": "..." }` shape (extendable
  later for multi-region or per-retailer links). A "Buy from {brand}"
  CTA appears at the top of the part page when set. Tap → opens via
  `Linking.openURL` AND inserts a row into `part_clicks` for analytics.
- **`part_clicks` table** — insert-only from the client (anon or auth);
  no select policy means analytics queries run via the service role.
  `user_id` is nullable so a logged-out viewer clicking through from a
  public share page still gets counted.
- **Wiring affiliate URLs**: until there's an admin UI, set them via
  SQL:

  ```sql
  update public.parts
  set affiliate_links = jsonb_build_object(
    'url', 'https://shop.arb.com.au/bull-bar-200-series',
    'label', 'Shop at ARB'
  )
  where brand = 'ARB' and name = 'Sahara Bar';
  ```

### Push notifications (Spec §4.6 follow-on)

- **Server-side trigger** (`20260528000011_push_notifications.sql`) —
  after every insert on `public.notifications` a `SECURITY DEFINER`
  function reads the recipient's `push_token`, builds a type-specific
  title/body/deep-link, and POSTs to
  `https://exp.host/--/api/v2/push/send` via the `pg_net` extension.
  The HTTP call is async (pg_net returns a request id and dispatches
  out-of-band), so a slow Expo Push request never blocks the
  originating insert. A `begin/exception` wrapper means a push hiccup
  also never aborts the notification row itself.
- **Wording matches the in-app inbox** — same actor name / preview
  text, so the push body and the row at `/notifications` say the same
  thing.
- **Client registration** — `registerForPushNotificationsAsync()` runs
  in the auth context when a session lands: requests permission, gets
  an Expo push token (`getExpoPushTokenAsync`), and writes it to
  `users.push_token`. Re-fires only on user-id change so token-refresh
  events don't thrash. Sign-out clears the token first (still in
  session, RLS allows the update), so an old device never keeps
  receiving pushes after sign-out.
- **Tap routing** — every push carries `data.url` with the app's
  custom scheme (`wiredbuilddemo://…`). The root layout subscribes via
  `addNotificationResponseReceivedListener`, strips the scheme, and
  hands the path to the Expo Router. Open the app from a "Jamie liked
  your post" push → land on `/post/<id>` directly.
- **No EAS / native build required for the demo** — Expo Go ships with
  the right entitlements; `getExpoPushTokenAsync` returns a real
  `ExponentPushToken[...]` against the Expo Push Service. Production
  builds need an `eas.projectId` (set via `eas init`) and APNs / FCM
  credentials.

### VIN-decode autofill (Spec §4.2 follow-on)

- **Auto-lookup on 17 valid chars** — the moment `vin` matches
  `VIN_PATTERN`, Add-Vehicle calls the NHTSA vPIC `DecodeVinValues`
  endpoint (public, no auth). Year / make / model / trim that come
  back land in the empty fields; anything the user already typed is
  preserved (we never clobber manual input).
- **Idempotent** — a ref-guarded effect tracks the last decoded VIN so
  rapid character edits don't re-fire the request. Network failure /
  offline / unknown VIN silently falls back to manual entry; a green
  "Auto-filled from VIN — review and edit anything that's wrong"
  inline hint confirms when it worked.
- **AU-friendly** — VIN is an ISO standard, so make / year are
  reliable even for Australian vehicles. Model + trim hit rates are
  lower for AU-only variants, which is exactly why we never block
  submit on what NHTSA returns.

### VIN scanning (Spec §4.2, §9 Step 6)

- **Camera barcode scanner** at `/garage/scan-vin` — full-screen
  `CameraView` from `expo-camera`, listens for **Code 39**, **Code 128**
  and **QR** payloads (the three formats found on door-jamb stickers
  and windshield placards on Australian / US 4WDs). A scanned payload
  is run through `extractVinFromBarcode()` which strips checksum chars
  / JSON wrappers and returns the first 17-char run that matches the
  VIN alphabet.
- **Permission UX** — first-launch prompt, friendly explainer
  ("we never store the photo, only the decoded string"), graceful
  fallback to the manual-entry field if camera access is denied.
- **Add-Vehicle handoff** — `setPendingVin` writes the scanned VIN to
  an in-memory channel and `router.back()`s; Add-Vehicle reads it via
  `consumePendingVin()` in a `useFocusEffect`, so any other fields the
  user already typed are preserved. The handoff is one-shot — refocusing
  the form later won't apply the same VIN twice.
- **Why no OCR (yet)** — the door-jamb sticker and windshield placard
  always carry a barcode, decoded on-device in Expo Go without a model
  download or cloud round-trip. OCR is a polish follow-up for vehicles
  with damaged stickers.

### Step 6 — Ownership transfer (Spec §3.2, §9 Step 6 slice)

- **Atomic transfer RPC** — `transfer_vehicle_ownership(vehicle_id,
  new_owner_id, note?)` is a `SECURITY DEFINER` function that swaps
  `current_owner_id`, appends to `ownership_chain`, writes an audit row,
  and emits a notification to the new owner — all in one transaction.
  Direct UPDATEs that try to change `current_owner_id` away from the
  caller still fail RLS by design, so the RPC is the only path.
- **Transfer flow** at `/vehicle/transfer?vehicleId=…` — owner-only.
  Handle lookup (with @ stripping), recipient preview card (with
  badges), optional public note, destructive-styled confirmation alert
  ("This cannot be undone from the app"). On success the user lands
  back in their Garage (since they no longer own this build).
- **Ownership history** section on every build profile — flat audit
  feed from `ownership_transfers`, joined to user rows so it renders
  with @handle tap-throughs and optional public notes. For a public
  build, anyone can audit the chain of custody (buyers vetting a build
  before purchase — the spec's "transferable, monetisable asset" pitch).
- **Notifications inbox** picks up the new `ownership_transfer` type —
  a tap routes to the build that just landed in your garage.

## What's next

- **VIN scanning** via `expo-camera` + OCR — populate the Add-Vehicle form
  from the dashboard plate; biggest Step 6 win for daily UX
- **Valuation API** — populate `vehicles.build_value` server-side
  (Spec §9 Step 6, marketplace credibility)
- **Trending feed slice scoped to viewer's make** (Spec §4.4 bonus)
- **Multi-resolution image variants** — Supabase Edge Function on
  `mod-photos` bucket events to generate AVIF thumbnails (the
  client-side single-resize is shipped; the variants story is the next
  step up)
- **Polish** — OCR fallback for VIN scan (damaged stickers), OCR for
  receipts, OAuth (Apple / Google) sign-in

## Conventions

- VIN is the canonical identifier. `vehicles.vin` is unique and checked for length 17.
- Ownership transfers update `current_owner_id` and append to `ownership_chain`; history
  never disappears.
- Subscription state lives on `public.users.subscription_tier`, updated server-side
  only (Stripe / app-store webhooks). Never trust the client.
- Receipts and other sensitive media live in a separate bucket; `media.is_sensitive`
  marks rows that should never be public.

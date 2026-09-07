# Tripboard — Project Overview (AI handoff doc)

A context dump for an AI assistant that has never seen this repo. Everything below is derived from the actual source, not aspiration.

Live: https://room-design-lovat.vercel.app

---

## 1. What the app does

**Tripboard is a shared visual trip board.** People collect travel recommendations in scattered places — Instagram saves, TikToks, articles, group chats, notes apps — and lose them. Tripboard is where those saves become a usable plan.

The loop is:

1. **Save the place, not the post.** Search a place by name, pick a category, write the note explaining *why* it was worth saving, and optionally paste the source link (the Instagram post, the article).
2. **See it on one shared map.** Every save lands as a pin on a Mapbox map alongside a scrollable list of place cards. Filter by category, scope to a city, tap a pin to focus a card.
3. **Turn the shortlist into a day.** Assign places to specific days of the trip, add free-text day notes, reorder, and page through the itinerary day by day.
4. **Leave with a route.** Preview a walking/cycling/driving route through the day's stops (distance + duration via Mapbox Directions), then hand off to Google Maps or Apple Maps for live turn-by-turn.
5. **Plan together.** Invite collaborators by email or by share link; they join as editors on the same board.

It is a PWA (installable, app shell cached offline), designed mobile-first with a list/map toggle on small screens.

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16.3.3, App Router, React 19.2 |
| Language | TypeScript (strict), Zod 4 for all input validation |
| Styling | Tailwind CSS v4 (via `@tailwindcss/postcss`) + a large hand-written `src/app/globals.css` design system |
| Icons | `lucide-react` |
| Fonts | `Instrument_Sans` (body), `Kalam` (handwritten accent) via `next/font/google` |
| Database | Neon Postgres (`@neondatabase/serverless`) + Drizzle ORM (`neon-http` driver) |
| Auth | Neon Auth (`@neondatabase/auth`) — email/password + Google social |
| Maps | Mapbox GL JS (rendering) + Mapbox Directions API (route previews) |
| Places | Google Places API (New) primary; Foursquare Places as fallback |
| Client data fetching | TanStack React Query (used for place/city search only) |
| Tests | Vitest + Testing Library + jsdom |
| Hosting | Vercel |

The Next.js app lives in **`frontend/`**. The repo root holds only the README and `.vercel`.

---

## 3. Directory map

```
frontend/
├── drizzle/                     # 6 SQL migrations (0000–0005) + meta
├── drizzle.config.ts
├── public/
│   ├── sw.js                    # hand-written service worker (app shell cache)
│   └── tripboard-mark.svg
├── src/
│   ├── proxy.ts                 # Next.js middleware (named `proxy` in Next 16)
│   ├── app/
│   │   ├── layout.tsx           # fonts, providers, offline banner, PWA register
│   │   ├── page.tsx             # marketing landing page
│   │   ├── manifest.ts          # PWA manifest
│   │   ├── globals.css          # the whole design system
│   │   ├── sign-in/, sign-up/, auth/callback/
│   │   ├── account/page.tsx
│   │   ├── invite/[token]/page.tsx
│   │   ├── trips/
│   │   │   ├── page.tsx         # trip index
│   │   │   ├── new/page.tsx     # create trip
│   │   │   ├── [tripId]/page.tsx# the workspace
│   │   │   └── actions.ts       # ALL mutations (server actions) — 617 lines
│   │   └── api/
│   │       ├── auth/[...path]/  # Neon Auth handler
│   │       ├── places/autocomplete, [fsqPlaceId], [fsqPlaceId]/photos
│   │       ├── cities/autocomplete, cities/geocode
│   │       └── routes/          # Mapbox Directions proxy
│   ├── components/              # 22 components; trip-workspace.tsx is the big one (1014 lines)
│   └── lib/
│       ├── db/{index,schema}.ts
│       ├── auth.ts, auth-actions.ts, google-auth.ts
│       ├── trips.ts             # all read queries → domain objects
│       ├── types.ts             # domain types
│       ├── validators.ts        # every Zod schema
│       ├── invitations.ts       # token crypto + status
│       ├── google-maps.ts       # Google Places/Geocoding client
│       ├── cities.ts, dates.ts, navigation.ts, invite-data.ts
│       └── demo-data.ts         # the Lisbon demo trip
```

---

## 4. Data model (`src/lib/db/schema.ts`)

Enums: `member_role` = `owner | editor`; `invitation_kind` = `email | share`.

- **`trips`** — `id`, `ownerId` (text, from auth), `title`, `destination`, `startDate`, `endDate`, timestamps.
- **`trip_members`** — `(tripId, userId)` unique; `role`, `displayName`, `image`. Membership is the access-control table; every read joins through it.
- **`trip_invitations`** — `kind`, `email` (null for share links), `tokenHash` (unique), `role`, `invitedBy`, `expiresAt`, `acceptedAt`, `revokedAt/By`.
- **`trip_invitation_acceptances`** — audit of who accepted which invite (share links can be accepted many times).
- **`trip_cities`** — a trip is a list of city stops (`name`, `country`, optional `startDate`/`endDate`, `sortOrder`). `(tripId, sortOrder)` is unique.
- **`trip_places`** — the core row: `fsqPlaceId` (provider place id — Google or Foursquare, the column name is historical), `cityId`, cached `name`/`address`/`neighborhood`/`lat`/`lng`, user-authored `category`/`note`/`sourceUrl`, `saved` flag, `sortOrder`, and the day-planning fields `plannedDate` + `daySortOrder`. `(tripId, fsqPlaceId)` is unique — the same place can't be added twice to a trip.
- **`trip_day_notes`** — free-text notes attached to a `(trip, plannedDate)` with optional `cityId` and `sortOrder`.

Cascades: everything hangs off `trips` with `onDelete: cascade`; `cityId` foreign keys are `set null`.

**Domain types** (`src/lib/types.ts`): `Place`, `CityStop`, `DayNote`, `Collaborator`, `Trip`, `TripViewer`, `PlaceSearchResult`, `TravelMode` (`walking | cycling | driving`), and `PLACE_CATEGORIES = ["Eat","Drink","See","Shop","Stay","Other"]`. Coordinates are always `[longitude, latitude]` tuples.

---

## 5. Routes

### Pages
| Path | Purpose |
|---|---|
| `/` | Marketing landing — hero, animated `LandingMap`, three-step method section, CTA. |
| `/sign-in`, `/sign-up` | Email/password forms + Google button; both honour a `?returnTo=` param. |
| `/auth/callback` | Google popup callback; posts a session verifier back to the opener via BroadcastChannel. |
| `/trips` | Index of the viewer's trips (via `trip_members`) + "start a trip" empty state. |
| `/trips/new` | Create-trip form: title, destination (city autocomplete), start/end dates. |
| `/trips/[tripId]` | **The workspace.** Everything below in §6. |
| `/invite/[token]` | Ticket-styled invite landing: shows trip, inviter, expiry, and Join / Sign in / blocked-status states. |
| `/account` | Change display name; sign out. |

### API routes (all `no-store`)
| Route | Behaviour |
|---|---|
| `GET /api/places/autocomplete?q=&near=` | Google Places `searchText` → Foursquare → demo fixtures. Returns `PlaceSearchResult[]` with an auto-inferred category. |
| `GET /api/places/[fsqPlaceId]` | Foursquare place details (hours, rating). |
| `GET /api/places/[fsqPlaceId]/photos?name=` | Google Places photo → Foursquare photo → `null`. |
| `GET /api/cities/autocomplete?q=` | Google city autocomplete → Mapbox geocoding → demo city list. |
| `GET /api/cities/geocode?q=` | Google Geocoding → Mapbox → demo. Returns `coordinates` + a `bbox` **rejected if either span exceeds 4°** (keeps a city search from zooming out to a whole country). |
| `POST /api/routes` | Proxies Mapbox Directions (2–12 coordinates, mode enum). Without a token it returns a plausible synthetic distance/duration and a straight-line geometry. |
| `GET/POST /api/auth/[...path]` | Neon Auth handler; 503 when auth isn't configured. |

### Mutations
All writes are **server actions in `src/app/trips/actions.ts`** — no mutation API routes. Every action: `requireViewer()` → Zod parse → `requireEditor(tripId, userId)` (or `requireOwner` for invite management) → write → `revalidatePath`.

Actions: `createTrip`, `updateTrip`, `addPlace`, `updatePlace` (save toggle), `updatePlacePlanning` (day + city assignment), `removePlace`, `addTripCity`, `updateTripCity`, `removeTripCity`, `addDayNote`, `updateDayNote`, `removeDayNote`, `listTripInvites`, `createEmailInvite`, `createShareInvite`, `revokeInvite`, `inviteCollaborator`, `acceptInvitation(+Form)`.

---

## 6. The workspace (`src/components/trip-workspace.tsx`)

The single largest component and the heart of the product. A two-pane layout: place list on the left, map on the right; on mobile a tab switch between **List** and **Map** with a floating add button and a "place peek" bar over the map.

**Two modes** (`workspaceMode`):
- **Saved** — the full shortlist as numbered cards on an itinerary rail. Category filter pills (All/Eat/Drink/See/Shop/Stay/Other). Each card shows category tag, neighborhood, address (with a Google Maps deep link), the user's note, who added it, the original source link, plus save-toggle and delete controls, and inline "Day / City" selects for scheduling.
- **Day** — a paginated day plan built from the trip's date range (capped at 45 days). Per day: a note composer with an editable note list, the places planned for that day, and a "Map all days" toggle. A trailing **Unscheduled / Saved for later** section holds places with no day.

**City strip** — "All cities" plus a chip per `trip_cities` stop, with add and remove. Selecting a city scopes both the list and the map.

**Route preview** — pick walking / cycling / driving; the component POSTs the visible pins to `/api/routes`, draws the geometry on the map, and shows `N stops · X km · Y min` in a route dock. "Start" opens a handoff dialog with **Open Google Maps** (origin/waypoints/destination URL) and **Open Apple Maps** links.

**Optimistic persistence** — every mutation updates local state immediately, then enqueues the server action onto a serial `persistChain` promise so writes land in order. Failures roll the local state back. A `saveState` (`idle | saving | saved | error`) drives a `beforeunload` warning while a write is in flight. Locally-created ids look like `local-…` / `local-city-…` and are swapped for real UUIDs once the server responds (`persistedIds` map).

**Other dialogs**: `AddPlaceDialog` (two-step: search → categorize + note + optional day + optional source URL), `InviteDialog`, `TripLogisticsDialog` (edit title/destination/dates), an add-city dialog.

**Map** (`trip-map.tsx`) — lazily imports `mapbox-gl`, `light-v11` style, custom marker elements with hover preview popups (place photo via `/api/places/.../photos`), fits bounds to the city bbox from `/api/cities/geocode`, and renders the route line.

---

## 7. Auth, access control, invites

- `getViewer()` returns the Neon Auth session user. **If `NEON_AUTH_BASE_URL`/`NEON_AUTH_COOKIE_SECRET` are missing it returns a hardcoded demo user** — this is what makes demo mode work.
- `src/proxy.ts` is the Next 16 middleware. It guards `/trips`, `/trips/new`, `/trips/:path*`, `/account*` and redirects to `/sign-in`. `/trips/lisbon-weekender` is explicitly public (the demo trip).
- Access is membership-based: `requireEditor` checks `trip_members`; `requireOwner` checks `trips.ownerId`. Only owners create or revoke invites.
- **Invite tokens**: 32 random bytes base64url, **SHA-256 hashed at rest**, 7-day TTL, `editor` role. Email invites are bound to the invited address (sign-in email must match, case-insensitive) and are single-use; share links can be redeemed repeatedly until expiry or revocation. Status resolves to `active | expired | revoked | accepted | invalid`.
- `returnTo` params are validated by `isSafeReturnTo` (must start with `/`, not `//`, no backslashes) to prevent open redirects.

---

## 8. Demo mode (important — it shapes a lot of the code)

With **no environment variables at all**, the app runs fully interactively:
- `getViewer()` → a demo user; `getDatabase()` → `null`.
- Every server action short-circuits with `{ demo: true }` and persists nothing.
- `/trips/lisbon-weekender` renders the fixture trip from `src/lib/demo-data.ts` (Lisbon places, cities, day notes).
- Search/geocode routes fall back to demo fixtures; `/api/routes` returns synthetic distances.
- The UI gates persistence on `isPersistedTripId(trip.id)` — a UUID check — so demo trips never attempt writes.

---

## 9. Data-handling policy (deliberate, keep it)

- Tripboard persists a **provider place ID** plus **user-authored** content (category, note, source link, ordering, collaborator metadata) and a light cached name/address/coords snapshot for map rendering.
- Live provider fields — ratings, hours, photos — are fetched per request with `Cache-Control: no-store` and are **never written to Postgres**.
- The service worker (`public/sw.js`) explicitly **skips** `/api/*`, Mapbox, Google, and Foursquare requests; it caches only the app shell and same-origin static assets, network-first with a cache fallback.
- Only `NEXT_PUBLIC_MAPBOX_TOKEN` is browser-exposed; the Google key is server-only and must never get a `NEXT_PUBLIC_` prefix.
- Mapbox Directions is a *planning preview*; Google/Apple Maps handle live navigation.

---

## 10. Environment variables

```bash
DATABASE_URL=                 # Neon Postgres
NEON_AUTH_BASE_URL=           # Neon Auth (Google configured in the Neon console)
NEON_AUTH_COOKIE_SECRET=
NEXT_PUBLIC_MAPBOX_TOKEN=     # map rendering (public by design)
MAPBOX_ACCESS_TOKEN=          # server-side Directions
GOOGLE_MAPS_API_KEY=          # Places API (New) + Geocoding API. SERVER ONLY.
FOURSQUARE_API_KEY=           # fallback place search/photos
```

`vercel env pull .env.local` is the fast path on a linked project. Drizzle's CLI reads `.env.local`.

---

## 11. Commands

```bash
npm run dev        # next dev
npm run build
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
npm test           # vitest run
npm run db:generate / db:push   # drizzle-kit
```

Tests exist for `cities`, `dates`, `google-maps`, `invitations`, `navigation`, `validators` — pure helper functions only; there are no component or integration tests.

---

## 12. Conventions and gotchas for anyone editing this

- **Next.js 16 specifics**: middleware file is `src/proxy.ts` exporting `proxy`; `params` in pages/route handlers is a `Promise` and must be awaited; pages use `LayoutProps<"/">`-style generated types. `frontend/AGENTS.md` warns that this Next version differs from older training data — check `node_modules/next/dist/docs/` before assuming an API.
- **All mutations go through `actions.ts`.** Don't add mutation API routes.
- **Every input is Zod-parsed** in `src/lib/validators.ts`. Add the schema there, not inline.
- **Defensive migration handling**: `actions.ts` and `trips.ts` catch "relation/column does not exist" errors for the day-planning and invite tables (`isPlanningSchemaMissing`, `isInviteSchemaMissing`) and either degrade gracefully or throw a friendly "needs the latest migration" message. This is why a lot of reads are wrapped in try/catch — it's intentional, not accidental.
- **`fsqPlaceId` is a misnomer.** It holds whichever provider's ID was used (Google IDs in practice now). Don't assume Foursquare.
- **Provider fallback order is consistent**: Google → Mapbox/Foursquare → demo fixtures. Preserve it when touching search routes.
- **Coordinates are `[lng, lat]`** everywhere (Mapbox convention). Google responses are `{latitude, longitude}` and get flipped at the boundary.
- **Trips auto-heal a primary city**: `getViewerTrip` inserts a `sortOrder: 0` city derived from `trips.destination` if none exists, and back-fills `cityId` on orphaned places.
- Copy style is quiet and editorial ("Your saved places, finally on the map", "Save less vaguely. Travel more deliberately."). Match it in new UI strings.

---

## 13. What is *not* built

- No place reordering by drag-and-drop (ordering is by `sortOrder` set at insert).
- No real-time collaboration — collaborators see each other's changes on reload/revalidate, not live.
- No email delivery for invites; `createEmailInvite` returns a URL the owner copies and sends manually.
- No trip deletion, no member removal, no role changes (everyone invited is an `editor`).
- No component/E2E test coverage.
- No offline write queue — the service worker caches the shell only; mutations require connectivity.

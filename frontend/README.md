# Tripboard

Tripboard turns travel finds from social posts, articles, notes, and group chats into a shared visual trip board with route previews.

Live: [tripboard-lovat.vercel.app](https://tripboard-lovat.vercel.app)

## Start locally

```bash
npm install
npm run dev
```

The product opens in demo mode with no credentials, including interactive place saving, filters, route previews, mobile bottom sheet, and navigation handoff.

Copy `.env.example` to `.env.local` to connect live services:

- `DATABASE_URL`: Neon Postgres for user-owned trip data.
- `NEON_AUTH_BASE_URL` and `NEON_AUTH_COOKIE_SECRET`: Neon Auth. Configure Google as the only social provider in the Neon console.
- `NEXT_PUBLIC_MAPBOX_TOKEN` and `MAPBOX_ACCESS_TOKEN`: Mapbox map rendering and Directions.
- `GOOGLE_MAPS_API_KEY`: Google Places (New) and Geocoding for city search, place search, and photos. Server-only.
- `FOURSQUARE_API_KEY`: Fallback place search if the Google key is missing.

Create the Google key in [Google Cloud Console](https://console.cloud.google.com/google/maps-apis). Enable **Places API (New)** and **Geocoding API**, restrict the key to those APIs, and paste it into `frontend/.env.local` as `GOOGLE_MAPS_API_KEY`. Do not prefix it with `NEXT_PUBLIC_`. Restart `npm run dev` after adding it.

For a linked Vercel project, `vercel env pull .env.local` is the quickest setup path. Secrets stay server-only; the only browser-exposed value is the intentionally public `NEXT_PUBLIC_MAPBOX_TOKEN`. Drizzle loads `.env.local` for its CLI commands.

## Data boundaries

Provider data is treated deliberately:

- Tripboard persists a provider place ID plus user-authored category, note, source link, ordering, and collaborator metadata.
- Place search/details routes use `Cache-Control: no-store`; names, addresses, ratings, hours, and coordinates are fetched live and are not stored in Postgres.
- The PWA service worker excludes `/api`, Mapbox, Google, and Foursquare requests. It caches only the app shell and same-origin static assets.
- Mapbox Directions is used for planning previews. Google Maps and Apple Maps are external navigation handoffs for live guidance.

## Commands

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run db:generate
```

The database schema lives in `src/lib/db/schema.ts`. Invitation tokens are random, SHA-256 hashed at rest, email-bound, single-use, and expire after seven days.

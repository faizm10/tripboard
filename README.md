# Tripboard

Tripboard turns travel finds from social posts, articles, notes, and group chats into a shared visual trip board with route previews.

Live: [usetripboard.vercel.app](https://usetripboard.vercel.app)

## Start locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

The product opens in demo mode with no credentials, including interactive place saving, filters, route previews, mobile bottom sheet, and navigation handoff.

Fill in `.env.local` (or run `vercel env pull .env.local`) to connect live services:

- `DATABASE_URL`: Neon Postgres for user-owned trip data.
- `NEON_AUTH_BASE_URL` and `NEON_AUTH_COOKIE_SECRET`: Neon Auth. Configure Google as the only social provider in the Neon console.
- `ADMIN_EMAIL`: server-only email allowed to use the `/admin` control tower. Set it to the verified Tripboard administrator email.
- `NEXT_PUBLIC_MAPBOX_TOKEN` and `MAPBOX_ACCESS_TOKEN`: Mapbox map rendering and Directions.
- `GOOGLE_MAPS_API_KEY`: Google Places (New) and Geocoding for city search, place search, and photos. Server-only.
- `FOURSQUARE_API_KEY`: Fallback place search if the Google key is missing.
- `OPENROUTER_API_KEY`: the trip assistant sidebar ("Ask AI" on a trip). Server-only. Create a free key at [openrouter.ai/keys](https://openrouter.ai/keys).
- `GCP_PROJECT_ID` and `GCP_SERVICE_ACCOUNT_KEY` (optional): read-only Google Cloud Monitoring access for the uptime history on `/status`. See [`GCP_INTEGRATION.md`](GCP_INTEGRATION.md).
- `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID` (optional): deployment history on `/admin/platform`. See [`GCP_INTEGRATION.md`](GCP_INTEGRATION.md#platform-analytics-adminplatform).
- `OPENROUTER_MODELS` (optional): comma-separated OpenRouter model ids, tried in order. Defaults to free tool-calling models in `src/lib/assistant/models.ts`. When a free model is retired, swap it here without a code change. Pick models tagged with tool support at [openrouter.ai/models](https://openrouter.ai/models?supported_parameters=tools&max_price=0).

Create the Google key in [Google Cloud Console](https://console.cloud.google.com/google/maps-apis). Enable **Places API (New)** and **Geocoding API**, restrict the key to those APIs, and paste it into `.env.local` as `GOOGLE_MAPS_API_KEY`. Do not prefix it with `NEXT_PUBLIC_`. Restart `npm run dev` after adding it.

For a linked Vercel project, `vercel env pull .env.local` fills in the non-secret values. Vercel won't download secrets, so it writes `[SENSITIVE]` for them (including `DATABASE_URL` and `NEON_AUTH_COOKIE_SECRET`). Tripboard treats `[SENSITIVE]`, blank values, and a cookie secret shorter than 32 characters as "not set" and stays in demo mode, logging a warning that says which one. Paste real values from the Neon console to connect live data. Secrets stay server-only; the only browser-exposed value is the intentionally public `NEXT_PUBLIC_MAPBOX_TOKEN`. Drizzle loads `.env.local` for its CLI commands.

## Database migrations

Schema changes live in `src/lib/db/schema.ts`. Run `npm run db:generate -- --name <change>` to write a new SQL file in `drizzle/`. Migrations are **not** applied on deploy. After merging one, run the new SQL file on the production branch, either in the Neon SQL editor or with `DATABASE_URL='<direct url>' npx drizzle-kit push`. If the database falls behind the code, `/admin` shows a warning listing the missing tables and columns.

## Checks

GitHub Actions runs `npm run typecheck`, `npm run lint`, and `npm test` on every pull request. Run the same three locally before pushing.

## Administration

`/admin` is a first-party operations dashboard for the email in `ADMIN_EMAIL`. Only that account can open it, and only once its email is verified; everyone else gets a 404. The Platform tab charts Google API traffic, Places quota use, uptime, Vercel deployments and Neon table sizes. It reads aggregated account, session, trip, place, and invitation data from Neon, and lets the administrator restrict or restore a user’s access with an audit trail. It does not include third-party tracking, trip notes, source URLs, or deletion controls.

## Status and uptime

`GET /api/health` reports on the app, Neon, the schema, Neon Auth, and which provider keys are set. It returns 503 only when the app, database, or sign-in is down, and `?scope=app` skips the outside calls. `/status` is the public view and `/admin/status` adds error details. Uptime history comes from Google Cloud Monitoring uptime checks that probe `/api/health`; setup is in [`GCP_INTEGRATION.md`](GCP_INTEGRATION.md).

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

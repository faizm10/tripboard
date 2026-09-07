# Tripboard

A shared visual trip board. Save places from notes and links, see them on a map, and turn the shortlist into a route.

Live: [room-design-lovat.vercel.app](https://room-design-lovat.vercel.app)

The Next.js app lives in `frontend/`.

## Local setup

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

It runs in demo mode with no credentials. Fill in `.env.local` (or run `vercel env pull .env.local`) to connect Neon, Mapbox, and Foursquare.

See `frontend/README.md` for env vars, data boundaries, and extra commands.

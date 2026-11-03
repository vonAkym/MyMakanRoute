# MyMakanRoute

A guide for smart food hopping and discovery in Malaysia. Final year project (CAT405), School of Computer Sciences, Universiti Sains Malaysia.

Author: Danial Hakim bin Kamal Azwa
Supervisor: Dr. Zarul Fitri Zaaba

## Modules

| Module                | Submodules                                                                                            |
| --------------------- | ----------------------------------------------------------------------------------------------------- |
| User Management       | Registration, Login, Profile and Preference Setup                                                     |
| Food Discovery        | Food Place Searching, Hidden Gem Highlighting, Food Place Visualisation                               |
| Food Hopping          | Itinerary Planner, Route Planner, Itinerary Review and Customisation, Past Food Hopping Visualisation |
| Food Stalls Analytics | Food Places Visualisation, Food Places Analysis, Food Place Suggestion                                |

Filtering (halal, budget, cuisine, dietary needs) is applied inside the modules above.

## Structure

```
backend/   Node.js + Express API (src/, db/ migrations and seeds, scripts/, tests/)
web/       React web app (admin and user). Planned, folder is empty
mobile/    React Native app. Planned, folder is empty
data/      OpenStreetMap snapshot of Penang food places (osm-penang.json)
docs/      PLAN.md (development plan)
CLAUDE.md  Project rules for Claude Code and the helper agents
```

## Getting started (backend, Windows)

### Prerequisites

- **Node.js 20 or newer** (22 recommended)
- **A Supabase project.** Supabase hosts the PostgreSQL database. The first migration turns on **PostGIS** (a PostgreSQL add-on that understands map coordinates, so it can answer "which places are within 1 km?").

### 1. Settings file

Copy `backend/.env.example` to `backend/.env` and fill in:

- `DATABASE_URL`: in Supabase, click **Connect** and copy a connection string. Use the **Session pooler** string if the direct connection fails (the direct one needs IPv6, which many home networks do not have).
- `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`: from Supabase **Project Settings > API Keys**. Use the publishable (anon) key, never the secret key.

The other values have working defaults. `.env` is ignored by git; never commit it.

### 2. Install, set up the database and run

```
cd backend
npm.cmd install
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run dev
```

- `db:migrate` applies the numbered SQL files in `backend/db/migrations/`. A **migration** is a file that changes the database structure; each one runs only once, so running the command again is safe.
- `db:seed` loads the 55 SAMPLE places (see Data below).
- Optional: `npm.cmd run import:osm` imports about 1,241 real food places from OpenStreetMap.

**Why `npm.cmd`?** PowerShell may block `npm` with "running scripts is disabled on this system". Either type `npm.cmd` as above, or run this once and then use plain `npm`:

```
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

### 3. Check it works

The API starts on http://localhost:3000.

- http://localhost:3000/health returns `{"success":true,"data":{"status":"ok","app":"MyMakanRoute"}}`
- http://localhost:3000/health/db returns `{"success":true,"data":{"status":"ok","database":"connected","places":55}}` (the count depends on what you loaded)

### Tests and code style

```
npm.cmd test              # unit and API tests (no database, internet or secrets needed)
npm.cmd run lint          # ESLint: finds likely mistakes
npm.cmd run format:check  # Prettier: checks formatting
npm.cmd run format        # Prettier: fixes formatting
```

## Data

- **Sample data (55 places):** real Penang place names and coordinates from OpenStreetMap, with **invented** ratings, review counts, prices, halal flags and opening hours. They are for testing only and are **not real reviews**. In the database they are marked `source='sample'` and `is_sample=true`.
- **Optional full import:** `npm run import:osm` loads about 1,241 food places (Gelugor/USM to George Town). Data © OpenStreetMap contributors, licensed under ODbL (Open Database License).
- **Landing page photos:** the food photos in `web/src/assets/landing/photos/` were supplied by the student. Their licence must be confirmed before any public release. They are illustrative (they show the dish, not the actual stall).
- **Finding:** OpenStreetMap has **no ratings or review counts** and only about 2% of places have a halal tag. The hidden gem rule needs ratings, so it cannot run on OpenStreetMap data alone. That is why the sample data exists.

## Status

- **Phase 1, Foundation: done.** Settings loading and checking, database connection, migrations, sample data, input validation, standard responses and error handling, linting, tests.
- **Phase 2A, Core backend: planned.** Hidden gem rule, place search with filters, route planner (Dijkstra for travel times, Ant Colony Optimisation for visiting order), feasibility report.
- **Later (planned):** login and profiles with Supabase Auth, itineraries, analytics, then the web and mobile apps. See `docs/PLAN.md`.

### Planned: web and mobile apps

These will be created in Phase 2C and 2D:

```
npm create vite@latest web -- --template react
npx create-expo-app@latest mobile
```

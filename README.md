# MyMakanRoute

A guide for smart food hopping and discovery in Malaysia, starting with Penang. It helps tourists and locals find **hidden gem** food stalls near famous places, then plans a multi-stop food trip ("food hopping"). Final year project (CAT405), School of Computer Sciences, Universiti Sains Malaysia.

Author: Danial Hakim bin Kamal Azwa
Supervisor: Dr. Zarul Fitri Zaaba

## Modules

| Module                | Submodules                                                                                            |
| --------------------- | ----------------------------------------------------------------------------------------------------- |
| User Management       | Registration, Login, Profile and Preference Setup                                                     |
| Food Discovery        | Food Place Searching, Hidden Gem Highlighting, Food Place Visualisation                               |
| Food Hopping          | Itinerary Planner, Route Planner, Itinerary Review and Customisation, Past Food Hopping Visualisation |
| Food Stalls Analytics | Food Places Visualisation, Food Places Analysis, Food Place Suggestion                                |

Filtering (halal, budget, cuisine, dietary needs, open now) is applied inside Food Discovery and Food Hopping.

## Documentation

| File | What it holds |
| --- | --- |
| [docs/PLAN.md](docs/PLAN.md) | Development plan, decisions, phases |
| [docs/FEASIBILITY.md](docs/FEASIBILITY.md) | Feasibility report: data findings, hidden gem rule, route planner benchmark (Dijkstra + ACO) |
| [docs/architecture.md](docs/architecture.md) | System architecture, "plan a food hop" sequence, layers and folders |
| [docs/erd.md](docs/erd.md) | Database diagram (ERD) and data dictionary |
| [docs/use-case.md](docs/use-case.md) | Use case diagram and table |
| [docs/module-status.md](docs/module-status.md) | Module diagram with built / partial / planned status and evidence |
| `docs/diagrams/` | PNG versions of the diagrams |

## Structure

```
backend/   Node.js + Express API (src/modules per module, db/ migrations and seeds, scripts/, tests/)
web/       React web app (Vite): landing page, Discover, Trip, Trips, Analytics, Login/Register/Profile
mobile/    React Native app (planned, folder is empty)
data/      OpenStreetMap snapshots: osm-penang.json (places), road-graph-penang.json (roads)
docs/      Plan, feasibility report, diagrams
CLAUDE.md  Project rules for Claude Code and the helper agents
```

## Getting started (Windows)

### Prerequisites

- **Node.js 20 or newer** (22 recommended)
- **A Supabase project.** Supabase hosts the PostgreSQL database. The first migration turns on **PostGIS** (a PostgreSQL add-on that understands map coordinates, so it can answer "which places are within 1 km?").

### 1. Settings files

Copy `backend/.env.example` to `backend/.env` and fill in:

- `DATABASE_URL`: in Supabase, click **Connect** and copy a connection string. Use the **Session pooler** string if the direct connection fails (the direct one needs IPv6, which many home networks do not have).
- `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`: from Supabase **Project Settings > API Keys**. Use the publishable (anon) key, never the secret key.

The other values have working defaults. `.env` is ignored by git; never commit it.

The web app works without a settings file (it calls `http://localhost:3000`). To change that, copy `web/.env.example` to `web/.env` and edit `VITE_API_URL`.

### 2. Backend: install, set up the database, run

Terminal 1:

```
cd backend
npm.cmd install
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run dev
```

- `db:migrate` applies the numbered SQL files in `backend/db/migrations/`. A **migration** is a file that changes the database structure; each one runs only once, so running the command again is safe.
- `db:seed` loads the 55 SAMPLE places (see Data below).
- Optional: `npm.cmd run import:osm` imports the named OpenStreetMap food places. The database then holds 1,241 places: 1,186 stored as `source='osm'` plus 55 of the same places kept as SAMPLE rows with invented ratings.
- Optional: `npm.cmd run build:road-graph` rebuilds `data/road-graph-penang.json` (the road network used by the route planner). It is already in the repository, so this is only needed to refresh it.

The API starts on http://localhost:3000. Check:

- http://localhost:3000/health returns `{"success":true,"data":{"status":"ok","app":"MyMakanRoute"}}`
- http://localhost:3000/health/db returns `{"success":true,"data":{"status":"ok","database":"connected","places":...}}` (the count depends on what you loaded)

### 3. Web app: install and run

Terminal 2 (keep the backend running):

```
cd web
npm.cmd install
npm.cmd run dev
```

Open http://localhost:5173. The backend only accepts browser requests from this address (and from `http://localhost:8081` for the future mobile app); change `CORS_ORIGINS` in `backend/.env` if you use another one.

**Why `npm.cmd`?** PowerShell may block `npm` with "running scripts is disabled on this system". Either type `npm.cmd` as above, or run this once and then use plain `npm`:

```
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

### API endpoints (built)

| Method and path | Submodule |
| --- | --- |
| `GET /api/discovery/places?lat&lng&radius&halal&maxPrice&cuisine&dietary&openNow&label&limit` | Food Place Searching, Hidden Gem Highlighting |
| `GET /api/discovery/places/:id` | Food Place Visualisation |
| `POST /api/hopping/route` | Route Planner (Dijkstra + Ant Colony Optimisation) |
| `GET /api/analytics/overview` | Food Places Visualisation, Analysis, Suggestion |

### Tests, code style and feasibility study

Backend (inside `backend/`):

```
npm.cmd test                 # unit and API tests (no database, internet or secrets needed)
npm.cmd run lint             # ESLint: finds likely mistakes
npm.cmd run format:check     # Prettier: checks formatting
npm.cmd run format           # Prettier: fixes formatting
npm.cmd run feasibility      # feasibility study on the real database; writes docs/feasibility-results.json
```

Web (inside `web/`):

```
npm.cmd test                 # Vitest component and API-client tests
npm.cmd run lint
npm.cmd run build            # production build into web/dist
```

## Data

- **Sample data (55 places):** real Penang place names and coordinates from OpenStreetMap, with **invented** ratings, review counts, prices, halal flags, opening hours and dietary tags. They are for testing only and are **not real reviews**. In the database they are marked `source='sample'` and `is_sample=true`, and the web app shows a sample-data notice.
- **OpenStreetMap import:** `npm run import:osm` loads the 1,241 named food places of the snapshot (Gelugor/USM to George Town); 55 of them are kept as the SAMPLE rows, so 1,186 are stored as `source='osm'`. Data © OpenStreetMap contributors, licensed under ODbL (Open Database License). The road graph comes from the same source.
- **Finding:** OpenStreetMap has **no ratings or review counts** and only about 2% of places have a halal tag. The hidden gem rule needs ratings, so it cannot run on OpenStreetMap data alone. That is why the sample data exists. Real Google ratings for the 55 sample places are planned (step 2.9a). See `docs/FEASIBILITY.md`.
- **Landing page photos:** the food photos in `web/src/assets/landing/photos/` were supplied by the student. Their licence must be confirmed before any public release. They are illustrative (they show the dish, not the actual stall). The testimonials on the landing page are marked SAMPLE.

## Status (5 Nov 2026)

- **Phase 1, Foundation: done.** Settings loading and checking, database connection, migrations, sample data, input validation, standard responses and error handling, linting, tests.
- **Phase 2A, Core backend + web app: built, under review.**
  - Backend: hidden gem rule, place search with filters, route planner (OpenStreetMap road graph, Dijkstra travel times, Ant Colony Optimisation visiting order, compared with nearest neighbour and brute force), analytics overview, feasibility study.
  - Web app: Discover (list + map), Trip (plan route, reorder, save), Trips (past trips), Analytics dashboard.
  - Landing page redesigned (4 Nov 2026); the other pages will be restyled to match after the student's review.
- **Demo mode (until Phase 2B):** login, registration and profile run only in the browser; saved and past trips are stored in the browser (localStorage).
- **Planned:**
  - Phase 2B: real accounts with Supabase Auth through our backend, and the itinerary API.
  - Step 2.9a: Google ratings for the sample places.
  - Phase 2D: mobile app (React Native + Expo).
  - Phase 3: GitHub Actions CI, API description, final feasibility results.

  See `docs/PLAN.md` and `docs/module-status.md`.

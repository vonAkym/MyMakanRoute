# CLAUDE.md: MyMakanRoute

Rules and context for Claude Code and the project helpers (`.claude/agents/`). The full plan is in `docs/PLAN.md`.

## Project

MyMakanRoute is a final year project (CAT405, School of Computer Sciences, Universiti Sains Malaysia, Intelligent Computing major) by Danial Hakim bin Kamal Azwa, supervised by Dr. Zarul Fitri Zaaba. It is a food hopping and food discovery planner for Malaysia, starting with Penang. It helps tourists and locals find **hidden gem** food stalls near famous places, then plans a multi-stop food trip ("food hopping").

## Stack

- **Backend:** Node 20+ (22 recommended) + Express 4, plain JavaScript (CommonJS, `require`). Lives in `backend/`.
- **Database:** PostgreSQL + PostGIS (map/distance add-on), hosted on Supabase. Accessed with the `pg` library and plain SQL, not supabase-js.
- **Login (planned, Phase 2B):** Supabase Auth, called only through our own backend endpoints (`/api/auth/register`, `/login`, `/refresh`). Apps never hold a Supabase key.
- **Web (built, Phase 2C in progress):** React with Vite, in `web/` (React Router, Leaflet map, Recharts). **Mobile (planned, Phase 2D):** React Native with Expo, in `mobile/`. Both use the same backend API.

## Modules (fixed, from the project proposal)

| Module | Submodules |
| --- | --- |
| User Management | Registration, Login, Profile and Preference Setup |
| Food Discovery | Food Place Searching, Hidden Gem Highlighting, Food Place Visualisation |
| Food Hopping | Itinerary Planner, Route Planner, Itinerary Review and Customisation, Past Food Hopping Visualisation |
| Food Stalls Analytics | Food Places Visualisation, Food Places Analysis, Food Place Suggestion |

- Do not add, remove or rename modules or submodules.
- Filtering (halal, budget, cuisine, dietary, opening hours) is not a module. It lives inside Food Discovery and Food Hopping.
- Every feature maps to exactly one submodule (see `docs/PLAN.md` section 3). Name files and functions after it, e.g. `searchFoodPlaces()`, `labelHiddenGem()`, `planRoute()`.

## Key logic (built, Phase 2A)

- **Hidden gem rule** (Hidden Gem Highlighting, `food-discovery/hiddenGem.js`, pure function `labelHiddenGem()`): three outcomes.
  - **Hidden Gem:** `avg_rating >= HIDDEN_GEM_MIN_RATING` (default 4.3) **and** 1 to `HIDDEN_GEM_MAX_REVIEWS` (default 100) reviews.
  - **Popular:** more than `POPULAR_MIN_REVIEWS` (default 100) reviews, whatever the rating.
  - **No label:** everything else (no rating, 0 reviews, or few reviews with a lower rating).
  - Ranking (`rankFoodPlaces()`): Hidden Gems first, then Popular, then no label; nearest first inside each group, higher rating breaks ties. Thresholds come from config.
- **Route planner** (Route Planner): the travel graph (`travelGraph.js`) loads the OSM road graph `data/road-graph-penang.json` into memory and snaps each place to its nearest road node (fallback if the file is missing: 4-nearest-neighbour graph, straight line x 1.3). **Dijkstra** (`dijkstra.js`) builds the travel time matrix for all stops. **Ant Colony Optimisation (ACO)** (`antColony.js`) picks the visiting order. Nearest neighbour and brute force (up to 8 stops) are computed for comparison (`routeBaselines.js`). Open route (start at the first or chosen stop, no return). Walking by default (1.4 m/s), driving speeds per road type. ACO uses a seeded random number generator so tests are repeatable.

## Endpoints (built)

| Method and path | Submodule |
| --- | --- |
| `GET /health`, `GET /health/db` | server and database check |
| `GET /api/discovery/places?lat&lng&radius&halal&maxPrice&cuisine&dietary&openNow&label&limit` | Food Place Searching + Hidden Gem Highlighting |
| `GET /api/discovery/places/:id` | Food Place Visualisation |
| `POST /api/hopping/route` body `{ placeIds (2-10), travelMode, startPlaceId?, seed? }` | Route Planner |
| `GET /api/analytics/overview` | Food Places Visualisation, Analysis, Suggestion |

Planned (Phase 2B): `/api/auth/register`, `/login`, `/refresh`, profile/preferences and itinerary endpoints. Until then the web app runs login, registration, profile and saved trips in **demo mode** in the browser (`web/src/api/userManagement.js`, `foodHopping.js`).

## Folder structure

Current (5 Nov 2026):

```
backend/
  src/app.js           builds the Express app (tests import this)
  src/index.js         starts the server (only file that calls listen)
  src/config/          index.js loads .env; loadConfig.js checks values with zod
  src/lib/             db.js (pg pool), response.js (success, AppError, asyncHandler)
  src/middleware/      validate.js, errorHandler.js, notFound.js
  src/modules/
    food-discovery/        routes, controller, service, model + hiddenGem.js, openingHours.js
    food-hopping/          routes, controller, service, model + travelGraph.js, dijkstra.js,
                           antColony.js, routeBaselines.js
    food-stalls-analytics/ routes, controller, service, model + findings.js
    user-management/       empty (Phase 2B)
  db/migrations/       001_places.sql, 002_users.sql, 003_itineraries.sql, 004_lock_down_public_api.sql
  db/seeds/            sample-places.json (55 SAMPLE places) + seed.js
  db/migrate.js        tiny migration runner (records applied files in schema_migrations)
  scripts/             import-osm.js, build-road-graph.js, feasibility.js (+ feasibility-helpers.js)
  tests/unit/, tests/api/, tests/helpers/
web/
  src/App.jsx          page routes (/, /discover, /trip, /trips, /analytics, /login, /register, /profile)
  src/api/             client.js + one file per module (foodDiscovery, foodHopping,
                       foodStallsAnalytics, userManagement = demo mode until 2B)
  src/pages/           one page per route (+ .css and tests)
  src/components/      shared UI (PlaceMap, FilterPanel, LabelBadge, AlgorithmComparisonCard ...);
                       landing/ holds the landing page sections
  src/context/         AuthContext (demo user), TripBasketContext (trip basket)
  src/hooks/, src/lib/ (storage.js = localStorage helpers, format.js, constants.js), src/data/
  src/assets/landing/  landing page images (photos supplied by the student, licence to confirm)
mobile/                empty, planned (Phase 2D)
data/                  osm-penang.json (OSM places), road-graph-penang.json (OSM roads)
docs/                  PLAN.md, FEASIBILITY.md (+ feasibility-results.json), architecture.md, erd.md,
                       use-case.md, module-status.md, plans/, diagrams/ (PNG renders)
```

Module layout: `src/modules/<module>/{routes,controller,service,model}.js`, where routes = URLs and input checks, controller = reads the request and sends the response, service = the logic, model = SQL queries. Extra logic files sit beside them.

## Conventions

- **Response format:** success `{ success: true, data }`; failure `{ success: false, error: { code, message, details } }`. Use `success()` from `src/lib/response.js`.
- Throw `AppError(status, code, message, details)` for expected problems (e.g. 404 `NOT_FOUND`). The `errorHandler` turns anything else into 500 `INTERNAL_ERROR` without leaking stack traces or SQL.
- Wrap every async route handler with `asyncHandler` (Express 4 does not catch rejected promises).
- Validate request input with a zod schema through the `validate` middleware (bad input gives 400 `VALIDATION_ERROR`).
- SQL: parameterised queries only (`$1, $2`), never string-joined user input.
- Never hard-code secrets. Never read, print or commit `backend/.env`. Only `backend/.env.example` (placeholders) is tracked.
- Read settings only from `src/config` (never `process.env` elsewhere). New settings go into `loadConfig.js` and `.env.example`.
- Database changes = a **new** numbered migration file. Never edit a migration that has already been applied.
- Seed or sample data must be clearly marked SAMPLE (`source='sample'`, `is_sample=true`). It has invented ratings; never present it as real.
- No new library without saying why, and add it to `docs/PLAN.md` section 8.
- Tests must run without a database, internet or secrets (mock `db` and Supabase). `NODE_ENV=test` ignores `.env`.
- Style: Prettier (double quotes, semicolons, width 100, trailing commas) and ESLint. Keep code small and readable with short comments.

## Commands (run inside `backend/`)

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the API with auto-restart on http://localhost:3000 |
| `npm test` | Run Jest unit and API tests |
| `npm run lint` | ESLint check |
| `npm run format` / `npm run format:check` | Fix / check Prettier formatting |
| `npm run db:migrate` | Apply new migrations |
| `npm run db:seed` | Load the 55 SAMPLE places |
| `npm run import:osm` | Optional: import the OpenStreetMap places (1,241 named = 1,186 stored as `source='osm'` + 55 kept as SAMPLE rows) |
| `npm run build:road-graph` | Download the OSM road network and write `data/road-graph-penang.json` (used by the Route Planner) |
| `npm run feasibility` | Feasibility study on the real database; writes `docs/feasibility-results.json` (`-- --trials=50` for more trials) |

Web app (inside `web/`): `npm run dev` (http://localhost:5173), `npm test` (Vitest), `npm run lint`, `npm run build`.

**Windows note:** PowerShell may block `npm` ("running scripts is disabled", because of `npm.ps1`). Use `npm.cmd run dev` etc., or run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once.

## Team workflow

1. **planner** breaks work into steps mapped to submodules.
2. **code-writer** implements one step with tests.
3. **tester** writes and runs tests.
4. **code-reviewer** reviews; must-fix items go back to code-writer.
5. **security-reviewer** audits at the end of each phase.
6. **docs-writer** updates README and docs last.

- Commit only when tests pass and there are no must-fix items.
- One branch per phase (e.g. `feature/foundation`), merged to `main` after the phase passes.
- Never push to GitHub without the student's say-so.
- Never document a feature that is not built yet; mark it as planned.

## Student context

The student is learning. Keep explanations simple and short, and explain any technical term (jargon) the first time it is used.

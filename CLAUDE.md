# CLAUDE.md: MyMakanRoute

Rules and context for Claude Code and the project helpers (`.claude/agents/`). The full plan is in `docs/PLAN.md`.

## Project

MyMakanRoute is a final year project (CAT405, School of Computer Sciences, Universiti Sains Malaysia, Intelligent Computing major) by Danial Hakim bin Kamal Azwa, supervised by Dr. Zarul Fitri Zaaba. It is a food hopping and food discovery planner for Malaysia, starting with Penang. It helps tourists and locals find **hidden gem** food stalls near famous places, then plans a multi-stop food trip ("food hopping").

## Stack

- **Backend:** Node 20+ (22 recommended) + Express 4, plain JavaScript (CommonJS, `require`). Lives in `backend/`.
- **Database:** PostgreSQL + PostGIS (map/distance add-on), hosted on Supabase. Accessed with the `pg` library and plain SQL, not supabase-js.
- **Login (planned, Phase 2B):** Supabase Auth, called only through our own backend endpoints (`/api/auth/register`, `/login`, `/refresh`). Apps never hold a Supabase key.
- **Web (planned, Phase 2C):** React with Vite, in `web/`. **Mobile (planned, Phase 2D):** React Native with Expo, in `mobile/`. Both use the same backend API.

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

## Key logic (planned, Phase 2A)

- **Hidden gem rule** (Hidden Gem Highlighting): a place with `rating >= HIDDEN_GEM_MIN_RATING` (default 4.3) **and** `review_count <= HIDDEN_GEM_MAX_REVIEWS` (default 100) is labelled "Hidden Gem" and ranked higher; otherwise "Popular". Thresholds come from config. Write it as a pure function (no database, easy to test).
- **Route planner** (Route Planner): **Dijkstra** finds the shortest travel time between two places on a road graph (from OpenStreetMap). This builds a time matrix for all stops. **Ant Colony Optimisation (ACO)** then picks the visiting order from that matrix. Open route (start at the first stop, no return). Walking speed by default. ACO uses a seeded random number generator so tests are repeatable.

## Folder structure

Current (Phase 1):

```
backend/
  src/app.js           builds the Express app (tests import this)
  src/index.js         starts the server (only file that calls listen)
  src/config/          index.js loads .env; loadConfig.js checks values with zod
  src/lib/             db.js (pg pool), response.js (success, AppError, asyncHandler)
  src/middleware/      validate.js, errorHandler.js, notFound.js
  src/modules/         one empty folder per module (filled from Phase 2A)
  db/migrations/       001_places.sql, 002_users.sql, 003_itineraries.sql ...
  db/seeds/            sample-places.json + seed.js
  db/migrate.js        tiny migration runner (records applied files in schema_migrations)
  scripts/             import-osm.js
  tests/unit/, tests/api/
data/                  osm-penang.json (OpenStreetMap snapshot)
docs/                  PLAN.md
web/, mobile/          empty, planned
```

Planned module layout: `src/modules/<module>/{routes,controller,service,model}.js`, where routes = URLs, controller = reads the request and sends the response, service = the logic, model = SQL queries. Extra logic files sit beside them (e.g. `food-discovery/hiddenGem.js`, `food-hopping/dijkstra.js`, `antColony.js`).

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
| `npm run import:osm` | Optional: import ~1,241 OpenStreetMap places |

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

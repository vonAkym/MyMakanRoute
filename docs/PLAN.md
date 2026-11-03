# MyMakanRoute: Development Plan (Phases 1 to 3)

Written by: planner helper, 3 Nov 2026. Status: **approved 3 Nov 2026.**

**Decisions (student's answers to section 10):** all recommended defaults, **except Q2: login uses Supabase Auth** instead of our own bcrypt + JWT.

What the Supabase Auth decision means:

- Supabase stores the email and password (already hashed) and issues the login token (a JWT). We do not write password hashing ourselves.
- Our backend still owns the **Registration** and **Login** submodules: `POST /api/auth/register` and `POST /api/auth/login` (plus `/api/auth/refresh`) call Supabase Auth and return the tokens. So both apps only talk to our backend and never hold a Supabase key.
- An `auth` middleware checks the token on protected routes (verified against Supabase's public signing keys) and puts the user id and role on the request.
- Our own `profiles` table (id = the Supabase user id, display name, `role` user/admin) and `preferences` table hold everything else. No foreign key to Supabase's internal `auth.users`, so the same migrations also run on the CI test database.
- The backend only needs the **publishable (anon) key** for this, not the service_role key, which is safer.
- In automated tests the Supabase Auth calls are replaced by a fake (mock), so tests need no internet or secrets.

**Hidden gem labels (decided 3 Nov 2026): three labels**, not two. **Hidden Gem** = rating >= 4.3 and review_count <= 100; **Popular** = review_count > 100; places with fewer reviews and a lower rating, or no rating at all, get **no label**. All thresholds are configurable.

**Real ratings (decided 3 Nov 2026):** after Phase 2A, cross-match the 55 sample places with Google Places ratings (step 2.9a). Not the full 1,241 for now.

## 1. Goal and what the supervisor wants

MyMakanRoute helps tourists and locals in Penang find hidden gem food stalls near famous places and then plan a multi-stop food trip ("food hopping").

The supervisor asked: *"test whether your proposed work is feasible, start developing, it will reaffirm the module diagram; meet early next week"* (meeting around **9 to 10 Nov 2026**).

So the first thing to deliver is a **feasibility proof**, not a pretty app. Feasibility will be shown by:

1. A database of ~50 Penang sample places (with ratings and review counts) that the API can search by distance.
2. The **hidden gem rule** labelling places correctly, with unit tests.
3. The **route planner** working on those places: Dijkstra finds travel times, Ant Colony Optimisation picks the visiting order, with unit tests and a comparison against simpler methods.
4. `docs/FEASIBILITY.md` showing real sample output from steps 1 to 3, plus the data findings from OpenStreetMap.

The web and mobile apps come after the meeting.

## 2. Where we are today (Day 1, uncommitted)

| Already built | Notes |
| --- | --- |
| `backend/src/index.js` | Express server with `/health` and `/health/db` |
| `backend/src/db/supabase.js` | Connects with the supabase-js library and the service_role key |
| `backend/sql/001_places.sql`, `002_places_osm.sql` | `places` table with PostGIS location, `nearby_places()` function, OSM columns |
| `backend/scripts/import-osm.js` | Imports food places from OpenStreetMap (`npm run import:osm`) |
| `data/osm-penang.json` | Raw OSM snapshot (Gelugor/USM to George Town) |
| Hosted Supabase project | PostgreSQL + PostGIS, Singapore region, 1,241 OSM places loaded |

**PostGIS** = an add-on for PostgreSQL that understands map coordinates, so the database can answer "which places are within 1 km of here?".

**OSM data finding (evidence for the feasibility report):** of the imported places about 97% have a name, 42% a cuisine, 25% opening hours, only 2% a halal tag, and **0% have ratings or review counts**. The hidden gem rule needs ratings, so it cannot run on OSM data alone. This is why we need sample seed data, and it is a risk to report honestly.

**Security note found while reading:** `backend/.env.example` is not in the folder right now; only `backend/.env` exists (ignored by git, good). Earlier the real Supabase secret key was inside `.env.example`. Step 1.1 below re-creates `.env.example` with placeholders only, and the key should be **rotated in Supabase** (Settings > API) in case it was copied anywhere.

## 3. Mapping: deliverable to module and submodule

Filtering (halal, budget, cuisine, dietary, opening hours) is not a module. It is code inside Food Discovery and Food Hopping.

| Deliverable | Module | Submodule |
| --- | --- | --- |
| Register endpoint + screen | User Management | Registration |
| Login endpoint, token, screen | User Management | Login |
| Profile + preferences (halal, budget, cuisine, dietary) | User Management | Profile and Preference Setup |
| Radius search + filters | Food Discovery | Food Place Searching |
| Hidden gem rule, label and ranking | Food Discovery | Hidden Gem Highlighting |
| Discovery list + map | Food Discovery | Food Place Visualisation |
| Create itinerary from chosen places | Food Hopping | Itinerary Planner |
| Dijkstra travel times + ACO visiting order | Food Hopping | Route Planner |
| Edit stops, reorder, save | Food Hopping | Itinerary Review and Customisation |
| List past trips, show on map | Food Hopping | Past Food Hopping Visualisation |
| Chart data (counts, averages) | Food Stalls Analytics | Food Places Visualisation |
| Written findings (e.g. avg rating by area and cuisine) | Food Stalls Analytics | Food Places Analysis |
| Suggested places | Food Stalls Analytics | Food Place Suggestion |
| Seed data, migrations, config, errors, lint, CI, docs | (shared foundation) | supports all modules |

## 4. Proposed folder structure

```
MyMakanRoute/
  CLAUDE.md                  project summary and rules for the helpers
  .prettierrc                shared formatting rules
  .github/workflows/ci.yml   lint + tests on every push
  backend/
    src/
      app.js                 builds the Express app (used by tests)
      index.js               starts the server
      config/index.js        reads .env, checks required values
      lib/response.js        success()/fail() helpers, AppError class
      lib/db.js              database connection pool
      middleware/            auth.js, validate.js, errorHandler.js, notFound.js
      modules/
        user-management/     routes.js, controller.js, service.js, model.js
        food-discovery/      ... + hiddenGem.js
        food-hopping/        ... + dijkstra.js, antColony.js, travelGraph.js
        food-stalls-analytics/ ...
    db/
      migrations/            001_..., 002_... numbered .sql files
      seeds/                 sample-places.json + seed script
      migrate.js             tiny migration runner
    scripts/                 import-osm.js, build-road-graph.js
    tests/                   unit/ and api/
  data/                      osm-penang.json, road graph snapshot
  web/                       Vite + React app
  mobile/                    Expo app
  docs/                      PLAN.md, FEASIBILITY.md, openapi.yaml, architecture.md
```

Each module folder has the same four files: **routes** (URLs), **controller** (reads the request, sends the response), **service** (the actual logic), **model** (SQL queries). Files and functions are named after the submodule, e.g. `searchFoodPlaces()`, `labelHiddenGem()`, `planRoute()`.

## 5. API response format and error handling

Every endpoint answers in the same shape, so the web and mobile apps handle responses one way:

```
Success: { "success": true,  "data": { ... } }
Failure: { "success": false, "error": { "code": "VALIDATION_ERROR", "message": "radius must be 100-5000", "details": [...] } }
```

- Input is checked by a `validate` middleware before the controller runs. Bad input gives HTTP 400 `VALIDATION_ERROR`.
- Services throw an `AppError(status, code, message)` for expected problems (404 `NOT_FOUND`, 401 `UNAUTHORISED`, 409 `EMAIL_TAKEN`).
- One `errorHandler` at the end catches everything. Unexpected errors return 500 `INTERNAL_ERROR` with no stack trace or SQL shown to the user; details go to the server log only.

## 6. Phases and steps

Helpers: **P** planner, **CW** code-writer, **T** tester, **CR** code-reviewer, **SR** security-reviewer, **DW** docs-writer.
Every step follows: CW writes it, T tests it, CR reviews (must-fix items go back to CW). SR runs at the end of each phase, DW last. A phase is committed only when tests pass and there are no must-fix items.

### Phase 1: Foundation (backend first)

| # | What | Main files | Helper | How to test |
| --- | --- | --- | --- | --- |
| 1.1 | Secrets clean-up: `.env.example` with placeholders only; check no key appears in any tracked file; student rotates the Supabase key | `backend/.env.example`, `.gitignore` | CW, SR | `git grep` for key patterns finds nothing |
| 1.2 | `CLAUDE.md`: summary, stack, folder rules, commands, conventions, Windows `npm` note | `CLAUDE.md` | DW | Read-through by student |
| 1.3 | Config loading (fails fast if a value is missing), split `app.js` / `index.js` | `src/config/index.js`, `src/app.js` | CW | Start server with and without `.env` |
| 1.4 | Database access via `pg` + `DATABASE_URL` (see Q1); `/health/db` uses it | `src/lib/db.js` | CW | `/health/db` returns place count |
| 1.5 | Migration runner; fold 001/002 into it; add `profiles` (id = Supabase user id, `role`), `preferences`, `itineraries`, `itinerary_stops` tables; `source`/`is_sample` on places | `db/migrate.js`, `db/migrations/*.sql` | CW | Run twice: second run applies nothing |
| 1.6 | ~50 SAMPLE Penang places + seed script (see Q4, Q13) | `db/seeds/sample-places.json`, `db/seeds/seed.js` | CW | Count = 50, all `source='sample'` |
| 1.7 | Response helpers, `AppError`, validation and error middleware | `src/lib/response.js`, `src/middleware/*` | CW, T | Unknown URL gives 404 in standard shape |
| 1.8 | ESLint + Prettier for backend (web/mobile get theirs when created) | `eslint.config.js`, `.prettierrc` | CW | `npm run lint` passes |
| 1.9 | Jest + Supertest set up, first test for `/health` | `backend/tests/` | T | `npm test` passes |
| 1.10 | SR audit, README update, **commit Phase 1** | `README.md` | SR, DW | |

A **migration** is a numbered SQL file that changes the database structure. Running them in order rebuilds the same database anywhere (Supabase, a laptop, or GitHub's test machine).

### Phase 2A: Core backend (before the meeting)

| # | What | Submodule | Helper | How to test |
| --- | --- | --- | --- | --- |
| 2.1 | Hidden gem rule as a pure function, thresholds from config (Q7) | Hidden Gem Highlighting | CW, T | Unit tests: on the threshold, just above/below, no rating |
| 2.2 | `GET /api/discovery/places?lat&lng&radius&halal&maxPrice&cuisine&dietary&openNow` with gem label, gems ranked first | Food Place Searching | CW, T | API tests: filters return only matching places |
| 2.3 | Travel graph: road network snapshot for the bbox (Q5) + nearest-road-point lookup | Route Planner | CW | Script prints node/edge count |
| 2.4 | Dijkstra: shortest travel time between two places; builds a time matrix for all stops | Route Planner | CW, T | Unit tests on a small hand-drawn graph with known answers |
| 2.5 | ACO: best visiting order from the time matrix (Q6) | Route Planner | CW, T | Every stop once; seeded run repeatable; matches brute force on small cases |
| 2.6 | `POST /api/hopping/route` (no login needed, for the demo) | Route Planner | CW, T | API test with 5 sample places |
| 2.7 | `scripts/feasibility.js` prints results; DW drafts `docs/FEASIBILITY.md` | (evidence) | CW, DW | Student reads it |
| 2.8 | CR + SR, **commit Phase 2A** | | CR, SR | |

### Step 2.9a: Real ratings from Google (right after 2A, added 3 Nov 2026)

| # | What | Submodule | Helper | How to test |
| --- | --- | --- | --- | --- |
| 2.9a | `npm run import:ratings`: for the **55 sample places only**, look up each place in the Google Places API (New) by name + location, accept a match only if the names are similar and the locations are within ~100 m, then store Google's rating, review count and place ID. Unmatched places keep their sample values and are listed. Show "Ratings from Google" where used. Report the match rate in FEASIBILITY.md | Hidden Gem Highlighting | CW, T, SR | Unit tests for the name/distance matching with fake responses (no network); dry-run mode prints matches before writing |

Needs from the student: a Google Cloud project with Places API (New) enabled and an API key (`GOOGLE_PLACES_API_KEY` in `backend/.env`, billing account required even for the free quota). Google's terms only allow the place ID to be stored permanently, so ratings are refreshed by re-running the script; note this in FEASIBILITY.md. The other 1,186 OSM places are out of scope for now.

**Dijkstra** = a classic algorithm that finds the quickest path between two points on a network of roads (nodes = junctions, edges = road pieces with a travel time).
**Ant Colony Optimisation (ACO)** = a nature-inspired method: many simulated "ants" build visiting orders, good orders leave more "pheromone", so later ants prefer them. After many rounds a short order emerges. It suits the Intelligent Computing major.

### Phase 2B: Rest of the backend (after the meeting)

| # | What | Submodule | How to test |
| --- | --- | --- | --- |
| 2.9 | Register: `POST /api/auth/register` calls Supabase Auth sign-up, then creates the `profiles` row (role `user`) | Registration | Duplicate email gives 409; password never returned or logged (Supabase mocked in tests) |
| 2.10 | Login: `POST /api/auth/login` and `/refresh` via Supabase Auth; `auth` middleware verifies the Supabase token | Login | Wrong password gives 401; missing, invalid or expired token rejected |
| 2.11 | Get/update profile and preferences | Profile and Preference Setup | Only own profile; validation errors |
| 2.12 | Create itinerary (uses route planner), list, get one | Itinerary Planner | User A cannot read user B's trips |
| 2.13 | Edit stops, reorder, re-plan, save | Itinerary Review and Customisation | Order stays valid after edit |
| 2.14 | Past trips with stop coordinates for the map | Past Food Hopping Visualisation | Returns only own trips |
| 2.15 | Analytics: aggregates for charts, findings text, suggestions | Food Places Visualisation / Analysis / Suggestion | Numbers match hand-counted seed data |
| 2.16 | Discovery uses saved preferences as default filters | Food Place Searching | Logged-in search respects halal preference |

**JWT (JSON Web Token)** = a signed string Supabase Auth gives after login; the app sends it with each request to prove who the user is. Supabase stores passwords as salted hashes, so they cannot be read back.

### Phase 2C: Web app, then 2D: mobile app

| # | Web (`web/`) | Mobile (`mobile/`) |
| --- | --- | --- |
| 1 | Vite + React set up, ESLint/Prettier, API client using `VITE_API_URL` | Expo set up, ESLint/Prettier, API client using `EXPO_PUBLIC_API_URL` |
| 2 | Navigation + login/register screens | React Navigation + login/register screens |
| 3 | Discovery list + map with gem badge and filters | Same on phone |
| 4 | Itinerary screen: pick places, plan route, reorder, save, past trips | Same on phone |
| 5 | Analytics dashboard: charts, findings, suggestions | Simple version |

Commit after web works, then after mobile works.

### Phase 3: Quality

| # | What | Helper |
| --- | --- | --- |
| 3.1 | Fill test gaps: per-module API tests (success, validation, unauthorised), filter tests | T |
| 3.2 | GitHub Actions: lint all three apps + backend tests against a `postgis/postgis` service container | CW |
| 3.3 | `docs/openapi.yaml` (API description) + `docs/architecture.md` with diagram | DW |
| 3.4 | Final `docs/FEASIBILITY.md` with updated results | DW |
| 3.5 | Full SR audit (`npm audit`, CORS, helmet, rate limit on login), **commit Phase 3** | SR |

**GitHub Actions** = GitHub runs lint and tests automatically on every push, so broken code is caught early. A **service container** gives it a throwaway PostgreSQL, so no Supabase secret is needed in CI.

## 7. Proposed timeline (a proposal, adjust freely)

| Date | Target |
| --- | --- |
| Tue 3 Nov | This plan; student answers open questions |
| Wed 4 Nov | Phase 1 steps 1.1 to 1.6 (secrets, config, db, migrations, seed) |
| Thu 5 Nov | Steps 1.7 to 1.10; commit Phase 1. Start 2.1, 2.2 (hidden gem, search) |
| Fri 6 Nov | 2.3, 2.4 (road graph, Dijkstra) |
| Sat 7 Nov | 2.5, 2.6 (ACO, route endpoint) |
| Sun 8 Nov | 2.7, 2.8: FEASIBILITY.md draft, commit Phase 2A. Buffer: fall back to graph option 5b if 2.3 is late |
| Mon 9 / Tue 10 Nov | **Supervisor meeting**: show FEASIBILITY.md, module diagram, live API demo |
| 11 to 20 Nov | Phase 2B (auth, itineraries, analytics) |
| 21 Nov to early Dec | Phase 2C web, 2D mobile |
| Following 1 to 2 weeks | Phase 3 |

## 8. Libraries (each with why)

| Library | Where | Why |
| --- | --- | --- |
| express, cors, dotenv | backend | Already used: web server, allow app requests, read `.env` |
| pg | backend | Plain SQL to PostgreSQL; works the same on Supabase, laptop and CI (Q1) |
| @supabase/supabase-js | backend | Already installed: calls Supabase Auth for register, login and token checks (Q2). Not used for data queries |
| zod | backend | One readable schema per request; gives clear error details (Q9) |
| helmet | backend | Sets safe HTTP headers in one line |
| express-rate-limit | backend | Slows password guessing on login |
| jest, supertest | backend (dev) | Most common Node test tool; supertest calls the API without starting a real server |
| eslint, prettier | all (dev) | Catch mistakes; same code style everywhere |
| vite, react, react-router | web | Fast dev server; standard React page navigation |
| leaflet, react-leaflet | web | Free maps with OpenStreetMap tiles, no API key |
| recharts | web | Simple React charts for the dashboard |
| vitest, @testing-library/react | web (dev) | Test runner that fits Vite |
| expo, @react-navigation/native | mobile | Easiest React Native start; standard navigation |
| react-native-maps | mobile | Native map component that works in Expo Go |
| react-native-gifted-charts (or victory-native) | mobile | Charts on phone; decide in Phase 2D |

`@supabase/supabase-js` stays for Auth only; all data queries go through `pg` (Q1). No library is added without being listed here first.

## 9. Risks

| Risk | Effect | Plan |
| --- | --- | --- |
| OSM has no ratings, only 2% halal tags | Hidden gem rule cannot use OSM data | Sample seed data, clearly marked; report as a finding; real ratings are future work |
| Overpass API busy or down | Road graph / OSM import fails | Save snapshots in `data/`; scripts already retry several servers |
| Supabase free tier pauses after ~1 week idle | Demo fails on meeting day | Open the dashboard the day before; CI uses its own database |
| Secret key was in `.env.example` | Key leak if committed or shared | Step 1.1 placeholders + rotate key; SR checks before every commit |
| PowerShell blocks `npm` (Restricted policy) | Commands fail | Run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once, or use `npm.cmd`; note in README and CLAUDE.md |
| Road graph too big or slow | Route planner late | Limit to the bbox and drivable/walkable roads; fallback graph option 5b |
| Expo / Android emulator setup time | Mobile phase slips | Use Expo Go on a real phone; mobile is last |
| Too much scope before the meeting | Rushed, buggy demo | Only Phase 1 + 2A before the meeting |

## 10. Open questions (recommended default in bold)

Reply like "1 yes, 2 yes, 5b, 6 open".

1. **Database access:** switch from supabase-js to plain SQL with `pg` and a `DATABASE_URL` (the Supabase connection string)? Supabase stays as the host. Why: real SQL migrations, same code on a laptop or GitHub Actions without Supabase secrets, easier to explain. **Default: yes.**
2. **Auth:** own auth in Express (bcrypt + JWT) instead of Supabase Auth? **Answer: no, use Supabase Auth** (see Decisions at the top).
3. **Migrations:** tiny home-made runner (numbered `.sql` files, recorded in a `schema_migrations` table) instead of a heavy tool; existing 001/002 folded in. **Default: yes.**
4. **Seed data:** (a) real Penang place names and coordinates taken from the OSM snapshot, with *invented* ratings, review counts and prices, marked `source='sample'` and noted in README and FEASIBILITY; or (b) fully fictional names. The 1,241 OSM places stay as an optional import. **Default: (a).**
5. **Dijkstra graph:** (a) real road network from OSM for the bbox, saved in `data/`; (b) k-nearest-neighbour graph between places with estimated times (simpler, less realistic); (c) external routing API (then Dijkstra is not yours). **Default: (a), fall back to (b) if late before the meeting.** Also: travel mode? **Default: walking (about 5 km/h) for food hopping, with driving speed as a config option.**
6. **ACO:** small readable version with configurable ants, iterations, alpha, beta, evaporation; seeded random for repeatable tests; compared with nearest-neighbour and brute force (up to 8 stops) in FEASIBILITY. Route type: **Default: open route (start at the first chosen stop, no return)**, round trip as an option later?
7. **Hidden gem thresholds:** **Default: rating >= 4.3 and review_count <= 100**, changeable in config/env.
8. **Testing tools:** **Default: Jest + Supertest (backend), Vitest (web).** Linting: ESLint flat config + Prettier, one shared `.prettierrc` at the root.
9. **Validation library:** **Default: zod** (one schema per request, clear messages) over express-validator.
10. **Apps:** web = Vite + React + react-router + react-leaflet + Recharts; mobile = Expo + React Navigation + react-native-maps + a chart library. Each app has its own `package.json`; no npm workspaces (they clash with Expo). **Default: yes.**
11. **Git:** one branch per phase (e.g. `feature/foundation`), merge to `main` after the phase passes; commit after each phase; never push without your say-so. Should we push to GitHub after each phase? **Default: yes, after you confirm each time.**
12. **Language:** stay with JavaScript (CommonJS, like the current code) instead of TypeScript? **Default: JavaScript.**
13. **Opening hours:** seed data uses a simple format, e.g. `{"mon":[["08:00","15:00"]], ...}`; OSM strings are kept but not used by the "open now" filter. **Default: yes.**
14. **Admin role:** the README says the web app is for "admin and user". Is an admin role needed (e.g. only admins see Food Stalls Analytics)? **Default: simple `role` column (user/admin) on `profiles`, created in 1.5 and used from 2.9; analytics open to all logged-in users for now.**

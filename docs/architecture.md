# MyMakanRoute: Architecture

How the parts of MyMakanRoute fit together, as of 5 Nov 2026 (branch `feature/feasibility-core`).
Solid boxes and lines are **built**. Dashed boxes and lines are **planned** (not built yet).

Terms used on this page:

- **Client:** the app the user sees (web page or phone app). It asks the server for data.
- **REST API:** the backend's list of web addresses (endpoints, e.g. `GET /api/discovery/places`) that clients call. Answers are JSON (structured text).
- **Middleware:** a small step every request passes through before it reaches the module code (for example a security check).
- **PostGIS:** an add-on for PostgreSQL that understands map coordinates, so the database can answer "which places are within 1.5 km?".
- **OSM (OpenStreetMap):** a free, community-made world map. We use its food places and its roads.

## 1. System architecture

```mermaid
flowchart LR
  classDef planned stroke-dasharray: 6 4,stroke:#888,color:#555,fill:#f6f6f6
  classDef built fill:#e3f2e3,stroke:#2e7d32,color:#1a1a1a
  classDef data fill:#e8eef7,stroke:#1f5fae,color:#1a1a1a
  classDef ext fill:#fff7e6,stroke:#b26a00,color:#1a1a1a

  subgraph Clients["Clients"]
    direction TB
    WEB["React web app<br/>(Vite, React Router,<br/>Leaflet map, Recharts)"]:::built
    MOB["React Native mobile app<br/>(Expo) - planned"]:::planned
  end

  subgraph API["Express REST API (backend/, Node.js)"]
    direction TB
    MW["Middleware<br/>helmet (safe headers) - CORS (allowed origins)<br/>JSON body limit 100 kb - zod validation"]:::built
    subgraph Routers["4 module routers"]
      direction TB
      R1["Food Discovery<br/>/api/discovery"]:::built
      R2["Food Hopping<br/>/api/hopping"]:::built
      R3["Food Stalls Analytics<br/>/api/analytics"]:::built
      R4["User Management<br/>/api/auth - planned"]:::planned
    end
    EH["notFound + errorHandler<br/>(standard error JSON)"]:::built
    MW --> Routers --> EH
  end

  subgraph Storage["Data"]
    direction TB
    DB[("Supabase PostgreSQL<br/>+ PostGIS<br/>(via pg, plain SQL)")]:::data
    GRAPH[["data/road-graph-penang.json<br/>OSM road graph,<br/>loaded into memory"]]:::data
    AUTH["Supabase Auth<br/>- planned (Phase 2B)"]:::planned
  end

  subgraph External["External data sources (used by import scripts, not at run time)"]
    direction TB
    OVER["OSM Overpass API"]:::ext
    GPL["Google Places API<br/>- planned (step 2.9a)"]:::planned
  end

  TILES["OpenStreetMap<br/>map tiles"]:::ext

  WEB -- "HTTPS JSON (fetch)" --> MW
  MOB -.-> MW
  WEB -- "map images" --> TILES
  R1 --> DB
  R2 --> DB
  R2 --> GRAPH
  R3 --> DB
  R4 -.-> AUTH
  R4 -.-> DB
  DB --- |"loaded from, by npm run import:osm"| OVER
  GRAPH --- |"built from, by npm run build:road-graph"| OVER
  DB -.- |"ratings from (planned)"| GPL
```

**In plain words**

- The **React web app** is the only client today. It talks to our backend only, using `fetch` and the address in `VITE_API_URL`. The **mobile app** (React Native with Expo) is planned and will call the same API.
- Every request first passes the **middleware**: `helmet` adds safe HTTP headers, **CORS** (Cross-Origin Resource Sharing, the browser rule about which websites may call the API) only allows our own dev origins, and `validate` checks the input with **zod** (a schema library) and answers `400 VALIDATION_ERROR` if it is wrong.
- Then one of the **module routers** handles it. Three are built: Food Discovery, Food Hopping and Food Stalls Analytics. The User Management router (`/api/auth/...` with Supabase Auth) is planned for Phase 2B. Until then, login, registration and profile run in **demo mode** inside the browser (see `docs/module-status.md`).
- Unknown URLs and errors end at `notFound` and `errorHandler`, which always answer `{ success: false, error: { code, message, details } }` and never show stack traces or SQL.
- Data lives in **Supabase PostgreSQL + PostGIS**. The backend uses the `pg` library with parameterised SQL (values sent as `$1, $2`, never pasted into the SQL text).
- The **road graph** file (`data/road-graph-penang.json`, about 2.5 MB) is built once from OSM by `npm run build:road-graph`. The route planner loads it into memory the first time a route is planned. If the file is missing, it falls back to a simple graph that links each place to its 4 nearest places (straight-line distance x 1.3).
- **OSM Overpass** (the OSM download service) is used only by the two import scripts, never while the app is running (the lines on the right have no arrow because they are one-off imports, not live calls). The web map loads its background images (tiles) from OpenStreetMap directly.
- **Google Places** ratings (step 2.9a) are planned, to replace the invented ratings of the 55 sample places.

## 2. Sequence: "Plan a food hop"

A **sequence diagram** shows who talks to whom, in time order (top to bottom).

```mermaid
sequenceDiagram
  autonumber
  actor U as User
  participant W as Web Trip page (/trip)
  participant A as Express API<br/>POST /api/hopping/route
  participant M as model.js (SQL)
  participant DB as PostgreSQL + PostGIS
  participant G as travelGraph.js<br/>(road graph in memory)
  participant D as dijkstra.js
  participant C as antColony.js +<br/>routeBaselines.js

  U->>W: Pick 2-10 places on Discover (trip basket),<br/>choose start stop and walking/driving, click Plan
  W->>A: POST { placeIds, travelMode, startPlaceId? }
  A->>A: helmet, CORS, zod validation (400 if bad)
  A->>M: findPlacesForRoute(placeIds)
  M->>DB: select id, name, lat, lng ... where id = any($1)
  DB-->>M: place rows
  M-->>A: places (404 NOT_FOUND if any id is missing)
  A->>G: snap each place to its nearest road node
  G-->>A: snapped nodes (+ snap distance in metres)
  A->>D: buildTimeMatrix(places, travelMode)
  D-->>A: travel time (s) and distance (m) for every pair,<br/>plus the road path (422 if unreachable)
  A->>C: planVisitingOrderACO(matrix, seed)
  C-->>A: best visiting order (open route)
  A->>C: nearestNeighbourOrder + bruteForceOrder (up to 8 stops)
  C-->>A: comparison orders, total times, run times
  A-->>W: { order, legs[path], totalTimeS, totalDistanceM,<br/>comparison, algorithm, graph }
  W->>U: Map draws the route line and numbered stops,<br/>leg list and algorithm comparison card
```

**In plain words**

1. The user adds places to a **trip basket** on the Discover page (kept in the browser), then opens the Trip page and clicks Plan.
2. The API checks the request (2 to 10 different place ids, travel mode, optional start).
3. The model loads the places from the database.
4. Each place is **snapped** to the nearest point on the road graph (a place is rarely exactly on a road).
5. **Dijkstra** (a classic shortest-path algorithm) finds the quickest road path between every pair of places. This gives a **time matrix** (a table: "from A to B takes N seconds").
6. **Ant Colony Optimisation (ACO)** (many simulated "ants" try visiting orders; good orders leave more "pheromone" so later ants prefer them) picks the visiting order. It uses a fixed **seed** (starting value for the random numbers), so the same input gives the same answer.
7. For comparison, the API also runs **nearest neighbour** (always go to the closest unvisited place) and **brute force** (try every order; only up to 8 stops because it gets slow).
8. The web page draws the route on the map and shows the comparison. Saving the trip is done in the browser for now (the itinerary API is planned for Phase 2B).

## 3. Layers and folders

Each module follows the same four layers, so a request always travels the same way:

| Layer | File | Job | Example (Food Hopping) |
| --- | --- | --- | --- |
| Routes | `routes.js` | Lists the URLs and their zod input checks | `POST /route` with `planRouteSchema` |
| Controller | `controller.js` | Reads the request, calls the service, sends the response with `success()` | `planRouteHandler` |
| Service | `service.js` (+ logic files) | The actual logic, no HTTP and no SQL | `planRoute()` using `dijkstra.js`, `antColony.js`, `routeBaselines.js`, `travelGraph.js` |
| Model | `model.js` | SQL queries only (parameterised) | `findPlacesForRoute()` |

Built endpoints (all answer `{ success: true, data }`):

| Method and path | Module, submodule |
| --- | --- |
| `GET /health`, `GET /health/db` | (shared) server and database check |
| `GET /api/discovery/places?lat&lng&radius&halal&maxPrice&cuisine&dietary&openNow&label&limit` | Food Discovery: Food Place Searching + Hidden Gem Highlighting |
| `GET /api/discovery/places/:id` | Food Discovery: Food Place Visualisation (detail panel) |
| `POST /api/hopping/route` | Food Hopping: Route Planner |
| `GET /api/analytics/overview` | Food Stalls Analytics: all three submodules |

Folder structure (main parts only):

```
MyMakanRoute/
  backend/
    src/
      app.js                 builds the Express app (tests import it)
      index.js               starts the server (only file that calls listen)
      config/                index.js reads .env; loadConfig.js checks values with zod
      lib/                   db.js (pg connection pool), response.js (success, AppError, asyncHandler)
      middleware/            validate.js, errorHandler.js, notFound.js
      modules/
        food-discovery/      routes, controller, service, model + hiddenGem.js, openingHours.js
        food-hopping/        routes, controller, service, model + travelGraph.js, dijkstra.js,
                             antColony.js, routeBaselines.js
        food-stalls-analytics/ routes, controller, service, model + findings.js
        user-management/     empty (planned, Phase 2B)
    db/
      migrations/            001_places.sql ... 004_lock_down_public_api.sql
      seeds/                 sample-places.json (55 SAMPLE places) + seed.js
      migrate.js             tiny migration runner
    scripts/                 import-osm.js, build-road-graph.js, feasibility.js
    tests/                   unit/ and api/ (Jest + Supertest, no database needed)
  web/
    src/
      App.jsx                page routes
      api/                   client.js + one file per module (foodDiscovery, foodHopping,
                             foodStallsAnalytics, userManagement)
      pages/                 one page per submodule group (Discover, Trip, Trips, Analytics,
                             Login, Register, Profile, Home)
      components/, context/, hooks/, lib/
  mobile/                    empty (planned, Phase 2D)
  data/                      osm-penang.json (OSM places), road-graph-penang.json (OSM roads)
  docs/                      PLAN.md, FEASIBILITY.md, architecture.md, erd.md, use-case.md, module-status.md
```

Web pages and their routes: `/` landing page, `/discover` Food Discovery, `/trip` Itinerary Planner + Route Planner + Itinerary Review and Customisation, `/trips` Past Food Hopping Visualisation, `/analytics` Food Stalls Analytics, `/login`, `/register`, `/profile` User Management (demo mode).

Images for slides: `docs/diagrams/architecture-1.png` (system architecture) and `docs/diagrams/architecture-2.png` (sequence diagram), made with mermaid-cli from the diagrams above.

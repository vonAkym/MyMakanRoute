# MyMakanRoute: Use Case Diagram

A **use case diagram** shows who uses the system (the **actors**) and what they can do with it (the **use cases**). The box "MyMakanRoute" is the **system boundary**: everything inside it is part of our system; actors stand outside.

Mermaid (the diagram language used here) has no real UML use case diagram, so it is drawn as a flowchart:

- Actors are on the left (people) and on the right (external systems).
- Use cases are the rounded boxes, grouped by the 4 modules (plus the data import scripts), with the exact submodule name in square brackets.
- **«include»** (dashed arrow with a label) means "this use case always also does that one".
- Solid green border = built. Yellow = partly built (demo mode or saved in the browser only). Grey dashed border with "(planned)" = not built yet.

```mermaid
flowchart LR
  classDef actor fill:#ffffff,stroke:#333,stroke-width:2px,font-weight:bold,color:#1a1a1a,font-size:16px
  classDef built fill:#e3f2e3,stroke:#2e7d32,stroke-width:2px,color:#1a1a1a,font-size:15px
  classDef partial fill:#fff3cd,stroke:#c79100,stroke-width:2px,color:#1a1a1a,font-size:15px
  classDef planned fill:#f6f6f6,stroke:#888,stroke-dasharray: 6 4,color:#555,font-size:15px
  classDef ext fill:#fff7e6,stroke:#b26a00,stroke-width:2px,color:#1a1a1a,font-size:16px

  GUEST["Tourist / Local user<br/>(Guest)"]:::actor
  REG["Registered user"]:::actor
  ADMIN["Admin"]:::actor

  subgraph SYS["MyMakanRoute"]
    direction TB

    subgraph UM["User Management"]
      direction TB
      UC1(["Register an account<br/>[Registration]"]):::partial
      UC2(["Log in<br/>[Login]"]):::partial
      UC3(["Set profile and food preferences<br/>[Profile and Preference Setup]"]):::partial
    end

    subgraph FD["Food Discovery"]
      direction TB
      UC4(["Search food places nearby<br/>[Food Place Searching]"]):::built
      UC5(["Apply filters: halal, budget,<br/>cuisine, dietary, open now, label"]):::built
      UC6(["See Hidden Gem / Popular labels<br/>[Hidden Gem Highlighting]"]):::built
      UC7(["View places on map and details<br/>[Food Place Visualisation]"]):::built
    end

    subgraph FH["Food Hopping"]
      direction TB
      UC8(["Pick places for a trip<br/>[Itinerary Planner]"]):::partial
      UC9(["Plan route<br/>[Route Planner]"]):::built
      UC10(["Calculate travel times<br/>(Dijkstra)"]):::built
      UC11(["Order stops<br/>(ACO)"]):::built
      UC12(["Reorder, remove, re-plan, save trip<br/>[Itinerary Review and Customisation]"]):::partial
      UC13(["View past trips on map<br/>[Past Food Hopping Visualisation]"]):::partial
    end

    subgraph FA["Food Stalls Analytics"]
      direction TB
      UC14(["View charts of food places<br/>[Food Places Visualisation]"]):::built
      UC15(["Read analysis findings<br/>[Food Places Analysis]"]):::built
      UC16(["See suggested places<br/>[Food Place Suggestion]"]):::built
    end

    subgraph DATA["Data import"]
      direction TB
      UC17(["Import OSM places and road graph<br/>(scripts)"]):::built
      UC18(["Import Google ratings<br/>(planned)"]):::planned
    end
  end

  OSM["OpenStreetMap"]:::ext
  SUPA["Supabase Auth<br/>(planned)"]:::planned
  GOOG["Google Places<br/>(planned)"]:::planned

  REG -- "is a" --> GUEST
  ADMIN -- "is a" --> REG

  GUEST --- UC1
  REG --- UC2
  REG --- UC3
  GUEST --- UC4
  GUEST --- UC7
  GUEST --- UC8
  GUEST --- UC9
  REG --- UC12
  REG --- UC13
  GUEST --- UC14
  GUEST --- UC15
  GUEST --- UC16
  ADMIN --- UC17
  ADMIN -.- UC18

  UC4 -. "«include»" .-> UC5
  UC4 -. "«include»" .-> UC6
  UC9 -. "«include»" .-> UC10
  UC9 -. "«include»" .-> UC11

  UC1 -.- SUPA
  UC2 -.- SUPA
  UC17 --- OSM
  UC18 -.- GOOG

  subgraph LEG["Legend"]
    direction LR
    L1(["Built"]):::built
    L2(["Partial: demo mode /<br/>browser only"]):::partial
    L3(["Planned"]):::planned
  end
  style LEG fill:#ffffff,stroke:#999,color:#333
  style SYS fill:#fbfbfd,stroke:#1f3a5f,stroke-width:3px,color:#1f3a5f
```

**In plain words**

- **Guest** (a tourist or local who has not logged in) can search for food places, see the hidden gem labels, view them on the map, pick places for a trip, plan the route and look at the analytics dashboard. In today's web app nothing is locked behind login.
- **Registered user** can do everything a Guest can ("is a" Guest), plus log in, set preferences and keep trips. The diagram shows the intended design: today reorder, save and past trips also work for guests, because nothing is locked behind login yet; login-only access is planned with Supabase Auth. Today these run in **demo mode**: the account, preferences and saved trips live only in this browser (localStorage). Real accounts through Supabase Auth and the itinerary API come in Phase 2B.
- **Admin** is a registered user with `role = 'admin'` in the `profiles` table. The role column exists, but no admin-only screen is built yet, so the analytics dashboard is open to everyone (drawn as Guest use cases). Admin-only analytics is a possible later step. The import scripts (`npm run import:osm`, `npm run build:road-graph`) are run by the developer/admin from the command line.
- **Search food places** always includes **Apply filters** and the **hidden gem labelling**. **Plan route** always includes **Calculate travel times (Dijkstra)** and **Order stops (ACO)**.
- **OpenStreetMap** provides the place data and the road graph (through the import scripts) and the web map's background tiles. **Supabase Auth** and **Google Places** are planned external systems.

## Use case table

| Use case | Actor | Submodule | Status | Where |
| --- | --- | --- | --- | --- |
| Register an account | Guest | Registration | Demo mode | Web `/register` (browser only). API `POST /api/auth/register` planned (2B) |
| Log in | Registered user | Login | Demo mode | Web `/login` (browser only, password not checked). API `POST /api/auth/login`, `/refresh` planned (2B) |
| Set profile and food preferences | Registered user | Profile and Preference Setup | Demo mode | Web `/profile`; preferences saved in the browser and used as starting filters on `/discover`. API planned (2B) |
| Search food places nearby | Guest | Food Place Searching | Built | `GET /api/discovery/places`; web `/discover` |
| Apply filters (halal, budget, cuisine, dietary, open now, label) | Guest | Food Place Searching (filtering inside Food Discovery) | Built | Query parameters of `GET /api/discovery/places`; filter panel on `/discover` |
| See Hidden Gem / Popular labels | Guest | Hidden Gem Highlighting | Built | `label` field in `/api/discovery/places`; badges and gems-first ranking on `/discover` |
| View places on map and details | Guest | Food Place Visualisation | Built | `GET /api/discovery/places/:id`; Leaflet map and detail panel on `/discover` |
| Pick places for a trip | Guest | Itinerary Planner | Partial (browser only) | Trip basket on `/discover` and `/trip` (kept in the browser). Itinerary API planned (2B) |
| Plan route | Guest | Route Planner | Built | `POST /api/hopping/route`; map and leg list on `/trip` |
| Calculate travel times (Dijkstra) | (included) | Route Planner | Built | `food-hopping/dijkstra.js`, `travelGraph.js` |
| Order stops (ACO) | (included) | Route Planner | Built | `food-hopping/antColony.js`; comparison with nearest neighbour and brute force in `routeBaselines.js` |
| Reorder, remove, re-plan, save trip | Registered user | Itinerary Review and Customisation | Partial (browser only) | Move up/down, remove, re-plan, save on `/trip`; saved in the browser. API planned (2B) |
| View past trips on map | Registered user | Past Food Hopping Visualisation | Partial (browser only) | Web `/trips` (trips saved in this browser). API planned (2B) |
| View charts of food places | Guest | Food Places Visualisation | Built | `GET /api/analytics/overview`; charts on `/analytics` |
| Read analysis findings | Guest (admin-only possible later) | Food Places Analysis | Built | `findings` in `/api/analytics/overview`; "Findings" on `/analytics` |
| See suggested places | Guest (admin-only possible later) | Food Place Suggestion | Built | `suggestions` in `/api/analytics/overview`; `/analytics` |
| Import OSM places and road graph | Admin / developer | (shared data foundation) | Built | `npm run import:osm`, `npm run build:road-graph` |
| Import Google ratings | Admin / developer | Hidden Gem Highlighting (data) | Planned (step 2.9a) | `npm run import:ratings` (not built) |

Image for slides: `docs/diagrams/use-case-1.png`, made with mermaid-cli from the diagram above.

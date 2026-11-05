# Supervisor meeting: Friday 6 Nov 2026, 2:30 pm

With Dr. Zarul Fitri Zaaba. Goal: show that the proposed work is feasible and reaffirm the module diagram. Full details: `docs/FEASIBILITY.md`.

## Agenda (10–15 min)

1. **Module diagram** (2 min): show `docs/diagrams/module-status-1.png`. 7 submodules built, 6 partial (demo mode / browser only), names unchanged from the proposal.
2. **Live demo** (5 min): the script below.
3. **Feasibility numbers** (3 min): data finding, hidden gem rule, ACO benchmark table in `FEASIBILITY.md` Result 3.
4. **Risks and next steps** (2 min): real ratings (Google, step 2.9a), Supabase Auth + itinerary API (Phase 2B), mobile app.
5. **Questions and the ACO settings decision** (rest).

Have open: the architecture, ERD and use-case PNGs in `docs/diagrams/`, in case he asks.

## Demo script (exact clicks)

1. Open http://localhost:5173. This is the **landing page**. Scroll once and point out that the ratings and testimonials are marked SAMPLE.
2. Click **Discover** (top menu). Choose the location preset **Komtar** (radius 1.5 km).
   - Say: "Hidden Gems come first, nearest first."
   - Optional: set the label filter to **Hidden Gems**, then switch on **halal** to show filtering.
3. Click a Hidden Gem, e.g. **Sister Yao's Char Koay Kak** (4.6, 48 reviews, about 275 m). The detail panel opens. Point at the badge and the map marker.
4. Clear the **Hidden Gems** label filter (and halal) before adding places, so the Popular places of the worked example appear. Press **Add to trip** on 4–6 places. To match the report's worked example (17.9 min, 1,505 m), use these if they appear:
   - Tok Tok Mee Bamboo Noodles (start here)
   - Tho Yuen Dim Sum
   - Hameediyah Tandoori House
   - Toh Soon Cafe
   - Chulia Street Night Hawker Stalls
   - Ali Bubur Kacang
5. Click **Trip**. Check that **Start at** is the first place and the mode is walking. Click **Plan route**.
   - Show the numbered stops and the route line on the map, then the leg list with minutes and metres.
6. Point at the **algorithm comparison card**: ACO vs nearest neighbour vs brute force, with total minutes and run time in ms. Say: "Dijkstra gives the time matrix, ACO picks the order, brute force proves it is optimal for small trips."
7. Optional: move a stop up or down, click **Re-plan with ACO**, then **Save trip** and open **My Trips** ("saved in the browser for now, the API comes in Phase 2B").
8. Click **Analytics**: charts, the "Findings" sentences and the suggested gems. Say: "Pipeline works; the ratings are sample data."

## Five numbers to say out loud

1. **0% of 1,186 OpenStreetMap places have ratings**, and only **2.3%** have a halal tag. That is why there are 55 sample places with invented ratings, and why real Google ratings come next.
2. **14 Hidden Gems, 35 Popular, 6 unlabelled** among the 55 sample places (rule: rating ≥ 4.3 and 1–100 reviews).
3. Road graph: **26,689 nodes, 34,732 edges**; 99% of walkable nodes are connected.
4. Improved ACO found the **exact optimum in 39 of 40 trips** (4–10 stops), including 19 of 20 at 8–10 stops (nearest neighbour: 3 of 20); worst gap 2.03%. Textbook ACO reached 60–70% at 8–10 stops. *Indicative only: 10 trips per size and one ACO seed. A larger evaluation (50+ trips, several seeds, 12–20 stops) is planned.*
5. **Nearest neighbour is about 9% longer** than optimal at 8–10 stops. A full 10-stop plan takes about **46 ms (Dijkstra) + 7 ms (ACO)**.

## Likely questions and short answers

- **"Why ACO if brute force is faster?"** For 10 stops or fewer, brute force with pruning is exact and fast, so I use it as ground truth. The number of orders grows as (n−1)!: 362,880 orders for 10 stops, 479 million for 13, about 87 billion for 15. ACO grows only polynomially, so it scales to longer and multi-day trips. It is also the Intelligent Computing part. Next I will test 12–20 stops.
- **"Why sample ratings?"** OpenStreetMap has no ratings at all. The sample places are real places with invented ratings, clearly marked, to test the method. Step 2.9a replaces them with Google Places ratings for the 55 places; user ratings come later.
- **"Is the halal data reliable?"** Not yet. Only 2.3% of OSM places are tagged, so the filter only shows places explicitly marked halal and treats the rest as unknown. Google data, manual checks and user reports will improve it. The app does not claim a place is non-halal.
- **"How is a hidden gem defined, and why those thresholds?"** A Hidden Gem is rated 4.3 or higher with 1 to 100 reviews: well liked but not widely known. A place with more than 100 reviews is Popular. The thresholds are settings, not hard-coded. A sensitivity table is in the report. They will be tuned once real Google review counts are in.
- **"How many runs is this based on?"** Indicative only: 10 trips per size and one ACO seed. A larger evaluation (50+ trips, several seeds, 12–20 stops) is planned.
- **"What's next / timeline?"** (dates are proposed)
  - Google ratings: right after this meeting.
  - Supabase Auth and the itinerary API: proposed about 11–20 Nov.
  - Restyle the pages, then the mobile app: proposed late Nov to early Dec.
  - CI and the larger ACO evaluation: Phase 3.
- **"How will you evaluate?"**
  - Route quality: optimality gap against brute force (small trips) and against other methods (large trips).
  - Run time, seeded and repeatable.
  - Data coverage after the Google match.
  - Later, a small user test of the web and mobile apps.

## Decision to ask for

- Confirm the **improved ACO settings** (elitist deposit + MAX-MIN limits, β = 2) as the default, with textbook ACO kept as a comparison only. The reason is solution quality (more often optimal at 8–10 stops), not speed: run times are single runs and vary by about ±2×.

## Pre-meeting checklist

- [ ] **Morning:** open the Supabase dashboard so the free-tier project is awake (it pauses when idle).
- [ ] Start the backend: `cd backend`, then `npm.cmd run dev`.
- [ ] Check http://localhost:3000/health/db: it should say `"database":"connected"` and `places: 1241`.
- [ ] Start the web app: `cd web`, then `npm.cmd run dev`. Open http://localhost:5173.
- [ ] Do one practice run of the demo script (it also warms up the road graph, about 0.2 s to load).
- [ ] Have `docs/diagrams/*.png` and `docs/FEASIBILITY.md` open in tabs.
- [ ] Laptop charged, and the phone hotspot ready in case campus Wi-Fi blocks the database port.

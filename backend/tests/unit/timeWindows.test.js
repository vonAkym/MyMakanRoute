// Route Planner with opening hours: time windows, the timetable of an order, ACO and brute
// force with time windows (travelling salesman problem with time windows).

const {
  windowsFor,
  arriveAt,
  simulateSchedule,
  formatClock,
  localDayAndSeconds,
  CLOSED_PENALTY_S,
} = require("../../src/modules/food-hopping/timeWindows");
const { planVisitingOrderACO } = require("../../src/modules/food-hopping/antColony");
const {
  bruteForceScheduleOrder,
  nearestNeighbourOrder,
} = require("../../src/modules/food-hopping/routeBaselines");

const H = 3600;

describe("windowsFor", () => {
  test("turns opening hours into windows in seconds, including past-midnight ranges", () => {
    const hours = { fri: [["18:00", "02:00"]], sat: [["11:00", "15:00"]] };
    expect(windowsFor(hours, "sat")).toEqual([
      [0, 2 * H], // Friday night's range continues after midnight
      [11 * H, 15 * H],
    ]);
    expect(windowsFor(hours, "fri")).toEqual([[18 * H, 26 * H]]);
    expect(windowsFor(hours, "mon")).toEqual([]); // known hours, closed that day
  });

  test("no day-by-day hours -> null (always open); 23:59 means midnight", () => {
    expect(windowsFor(null, "mon")).toBeNull();
    expect(windowsFor({ osm: "Mo-Fr 09:00-17:00" }, "mon")).toBeNull();
    expect(windowsFor({ mon: [["07:00", "23:59"]] }, "mon")).toEqual([[7 * H, 24 * H]]);
  });
});

describe("arriveAt", () => {
  const windows = [[11 * H, 15 * H]];
  test("early -> wait until it opens; inside -> no wait; after closing -> closed", () => {
    expect(arriveAt(windows, 10 * H)).toMatchObject({ waitS: H, closed: false, slackS: 4 * H });
    expect(arriveAt(windows, 14 * H)).toMatchObject({ waitS: 0, closed: false, slackS: H });
    expect(arriveAt(windows, 16 * H)).toMatchObject({ closed: true, lateS: H });
    expect(arriveAt(null, 3 * H)).toMatchObject({ waitS: 0, closed: false });
  });
});

describe("simulateSchedule", () => {
  test("adds travel, waiting and eating time, and penalises closed stops", () => {
    const matrix = [
      [0, 600, 600],
      [600, 0, 600],
      [600, 600, 0],
    ];
    const schedule = {
      startS: 9 * H,
      visitS: 1800,
      windows: [null, [[10 * H, 12 * H]], [[8 * H, 9.5 * H]]],
    };
    const sim = simulateSchedule(matrix, [0, 1, 2], schedule);
    // 09:00 eat until 09:30, 09:40 at stop 1, wait 20 min, eat 10:00-10:30,
    // 10:40 at stop 2: closed since 09:30.
    expect(sim.stops.map((s) => formatClock(s.arriveS))).toEqual(["09:00", "09:40", "10:40"]);
    expect(sim.waitS).toBe(1200);
    expect(sim.closedStops).toBe(1);
    expect(sim.durationS).toBe(H + 40 * 60);
    expect(sim.cost).toBe(sim.durationS + CLOSED_PENALTY_S + 70 * 60);
  });
});

describe("ACO and brute force with time windows", () => {
  // Stop 3 is far away but closes at 09:45; the shortest order visits it last.
  const matrix = [
    [0, 300, 360, 900],
    [300, 0, 300, 1000],
    [360, 300, 0, 1000],
    [900, 1000, 1000, 0],
  ];
  const schedule = {
    startS: 9 * H,
    visitS: 600,
    windows: [null, null, null, [[8 * H, 9.75 * H]]],
  };

  test("the shortest order (nearest neighbour) reaches stop 3 after it closed", () => {
    const nn = nearestNeighbourOrder(matrix, 0);
    expect(nn.order).toEqual([0, 1, 2, 3]);
    expect(simulateSchedule(matrix, nn.order, schedule).closedStops).toBe(1);
  });

  test("ACO and brute force go to stop 3 first and reach every stop while open", () => {
    const aco = planVisitingOrderACO(matrix, { startIndex: 0, schedule });
    const brute = bruteForceScheduleOrder(matrix, 0, schedule);
    expect(aco.order[1]).toBe(3);
    expect(brute.order[1]).toBe(3);
    expect(aco.cost).toBe(brute.cost);
    expect(simulateSchedule(matrix, aco.order, schedule).closedStops).toBe(0);
    // totalTime stays the travel time only.
    expect(aco.totalTime).toBe(simulateSchedule(matrix, aco.order, schedule).travelS);
  });

  test("ACO matches brute force on random 7-stop trips with time windows", () => {
    let seed = 7;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    let optimal = 0;
    for (let t = 0; t < 10; t++) {
      const points = Array.from({ length: 7 }, () => [random() * 3000, random() * 3000]);
      const m = points.map((p) => points.map((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) / 1.4));
      const windows = points.map((_, i) => {
        if (i === 0) return null;
        const open = (8 + Math.floor(random() * 6)) * H;
        return [[open, open + (2 + Math.floor(random() * 4)) * H]];
      });
      const s = { startS: 9 * H, visitS: 1800, windows };
      const aco = planVisitingOrderACO(m, { startIndex: 0, schedule: s });
      if (Math.abs(aco.cost - bruteForceScheduleOrder(m, 0, s).cost) < 1e-6) optimal += 1;
    }
    expect(optimal).toBeGreaterThanOrEqual(9);
  });
});

test("localDayAndSeconds uses Malaysian time", () => {
  // 2026-11-20 is a Friday; 12:30 UTC = 20:30 in Kuala Lumpur.
  expect(localDayAndSeconds(new Date("2026-11-20T12:30:00Z"))).toEqual({
    day: "fri",
    seconds: 20.5 * H,
  });
});

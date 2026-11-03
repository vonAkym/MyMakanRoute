const {
  isOpenAt,
  hasStructuredHours,
  localDayAndMinutes,
} = require("../../src/modules/food-discovery/openingHours");

// Malaysia is UTC+8 all year (no daylight saving).
// 2026-11-02 is a Monday, 2026-11-03 a Tuesday.
const myt = (isoLocal) => new Date(`${isoLocal}+08:00`);

describe("localDayAndMinutes", () => {
  test("uses Asia/Kuala_Lumpur, not the computer's time zone", () => {
    // 17:30 UTC on Monday is 01:30 on Tuesday in Malaysia.
    expect(localDayAndMinutes(new Date("2026-11-02T17:30:00Z"))).toEqual({
      day: "tue",
      minutes: 90,
    });
  });
});

describe("isOpenAt", () => {
  const weekdays = { mon: [["08:00", "15:00"]], tue: [["08:00", "15:00"]] };

  test("normal hours: open inside, closed before and at closing time", () => {
    expect(isOpenAt(weekdays, myt("2026-11-02T08:00:00"))).toBe(true);
    expect(isOpenAt(weekdays, myt("2026-11-02T14:59:00"))).toBe(true);
    expect(isOpenAt(weekdays, myt("2026-11-02T07:59:00"))).toBe(false);
    expect(isOpenAt(weekdays, myt("2026-11-02T15:00:00"))).toBe(false);
  });

  test("a day with no entry is closed", () => {
    // 2026-11-04 is a Wednesday.
    expect(isOpenAt(weekdays, myt("2026-11-04T10:00:00"))).toBe(false);
  });

  test("multiple ranges in one day (lunch and dinner)", () => {
    const hours = {
      mon: [
        ["12:00", "15:00"],
        ["18:00", "21:00"],
      ],
    };
    expect(isOpenAt(hours, myt("2026-11-02T13:00:00"))).toBe(true);
    expect(isOpenAt(hours, myt("2026-11-02T16:30:00"))).toBe(false);
    expect(isOpenAt(hours, myt("2026-11-02T20:59:00"))).toBe(true);
  });

  test('"23:59" closing means open until midnight', () => {
    const hours = { mon: [["18:00", "23:59"]] };
    expect(isOpenAt(hours, myt("2026-11-02T23:59:30"))).toBe(true);
    expect(isOpenAt(hours, myt("2026-11-03T00:00:30"))).toBe(false);
  });

  test("a range past midnight stays open early the next morning", () => {
    const hours = { mon: [["18:00", "02:00"]] };
    expect(isOpenAt(hours, myt("2026-11-02T23:00:00"))).toBe(true);
    expect(isOpenAt(hours, myt("2026-11-03T01:30:00"))).toBe(true);
    expect(isOpenAt(hours, myt("2026-11-03T02:00:00"))).toBe(false);
  });

  test("checks the time in Malaysia even when given a UTC time", () => {
    // 03:00 UTC Monday = 11:00 Monday in Malaysia (open); 08:00 UTC = 16:00 (closed).
    expect(isOpenAt(weekdays, new Date("2026-11-02T03:00:00Z"))).toBe(true);
    expect(isOpenAt(weekdays, new Date("2026-11-02T08:00:00Z"))).toBe(false);
  });

  test("no structured hours counts as not open", () => {
    expect(isOpenAt(null, myt("2026-11-02T10:00:00"))).toBe(false);
    expect(isOpenAt({ osm: "Mo-Fr 08:00-15:00" }, myt("2026-11-02T10:00:00"))).toBe(false);
    expect(hasStructuredHours({ osm: "24/7" })).toBe(false);
    expect(hasStructuredHours({ mon: [], osm: "x" })).toBe(true);
  });

  test("ignores badly formed ranges", () => {
    const hours = { mon: [["8am", "3pm"], ["10:00"], "x", ["09:00", "11:00"]] };
    expect(isOpenAt(hours, myt("2026-11-02T10:00:00"))).toBe(true);
    expect(isOpenAt(hours, myt("2026-11-02T12:00:00"))).toBe(false);
  });
});

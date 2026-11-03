import {
  getCurrentUser,
  getPreferences,
  loginUser,
  logoutUser,
  registerUser,
  savePreferences,
  validateRegistration,
} from "./userManagement";
import { toPlannedRoute } from "./foodHopping";

describe("userManagement (demo mode)", () => {
  test("validates registration input", () => {
    expect(validateRegistration({ displayName: "A", email: "bad", password: "short" })).toEqual({
      displayName: expect.any(String),
      email: expect.any(String),
      password: expect.any(String),
    });
    expect(
      validateRegistration({ displayName: "Aminah", email: "a@b.my", password: "longenough" }),
    ).toEqual({});
  });

  test("register logs in, never stores the password, and blocks duplicates", async () => {
    const user = await registerUser({
      displayName: "Aminah",
      email: " Aminah@Example.com ",
      password: "secret-pass-1",
    });
    expect(user).toEqual({ email: "aminah@example.com", displayName: "Aminah", role: "user" });
    expect(getCurrentUser()).toEqual(user);
    expect(JSON.stringify(window.localStorage)).not.toContain("secret-pass-1");

    await expect(
      registerUser({ displayName: "Other", email: "aminah@example.com", password: "12345678" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  test("login needs a demo account on this device; logout clears the session", async () => {
    await expect(loginUser({ email: "nobody@example.com", password: "x" })).rejects.toMatchObject({
      code: "UNAUTHORISED",
    });
    await registerUser({ displayName: "Ali", email: "ali@example.com", password: "12345678" });
    await logoutUser();
    expect(getCurrentUser()).toBeNull();
    await loginUser({ email: "ali@example.com", password: "anything" });
    expect(getCurrentUser().displayName).toBe("Ali");
  });

  test("preferences are cleaned before saving", async () => {
    const saved = await savePreferences({
      halalOnly: true,
      maxBudget: 9,
      cuisines: ["Malay"],
      dietary: ["VEGAN"],
    });
    expect(saved).toEqual({
      halalOnly: true,
      maxBudget: null,
      cuisines: ["malay"],
      dietary: ["vegan"],
    });
    expect(getPreferences()).toEqual(saved);
  });
});

describe("toPlannedRoute (food hopping response mapping)", () => {
  test("maps the backend route to the web shape", () => {
    const route = toPlannedRoute({
      travelMode: "driving",
      order: [{ id: "a", name: "A", lat: "5.4", lng: "100.3", avg_rating: 4.5, is_sample: true }],
      legs: [{ fromPlaceId: "a", toPlaceId: "b", timeS: 60, distanceM: 500, path: [[5.4, 100.3]] }],
      totalTimeS: 60,
      totalDistanceM: 500,
      comparison: { aco: { order: ["a"], totalTimeS: 60, runtimeMs: 1 }, bruteForce: null },
    });
    expect(route.stops[0]).toMatchObject({
      id: "a",
      lat: 5.4,
      lng: 100.3,
      avgRating: 4.5,
      isSample: true,
    });
    expect(route.legs[0]).toEqual({
      fromId: "a",
      toId: "b",
      timeS: 60,
      distanceM: 500,
      path: [[5.4, 100.3]],
    });
    expect(route.comparison.bruteForce).toBeNull();
    expect(route.comparison.nearestNeighbour).toBeNull();
  });
});

describe("stored data shape checks", () => {
  test("a demo session without a string email is dropped", () => {
    window.localStorage.setItem("mmr.demoSession.v1", JSON.stringify({ email: 42 }));
    expect(getCurrentUser()).toBeNull();
    expect(window.localStorage.getItem("mmr.demoSession.v1")).toBeNull();

    window.localStorage.setItem("mmr.demoSession.v1", JSON.stringify({ email: "a@b.my" }));
    expect(getCurrentUser()).toEqual({ email: "a@b.my" });
  });

  test("broken demo accounts are ignored at login", async () => {
    window.localStorage.setItem(
      "mmr.demoAccounts.v1",
      JSON.stringify([null, { email: 7 }, { email: "a@b.my", displayName: "Aminah" }]),
    );
    const user = await loginUser({ email: "a@b.my", password: "longenough" });
    expect(user.displayName).toBe("Aminah");
  });
});

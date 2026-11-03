// src/config/index.js and src/index.js: .env loading and fail-fast start-up.
// dotenv is mocked so the developer's real .env is never read.

const ORIGINAL_ENV = process.env;

afterEach(() => {
  process.env = ORIGINAL_ENV;
  jest.resetModules();
  jest.restoreAllMocks();
});

function loadConfigModule(env) {
  process.env = env;
  const dotenv = { config: jest.fn() };
  jest.doMock("dotenv", () => dotenv);
  let config;
  let error;
  jest.isolateModules(() => {
    try {
      config = require("../../src/config");
    } catch (err) {
      error = err;
    }
  });
  return { config, error, dotenv };
}

describe("src/config/index.js", () => {
  test("in test mode it does not read .env and still loads", () => {
    const { config, error, dotenv } = loadConfigModule({ NODE_ENV: "test" });
    expect(error).toBeUndefined();
    expect(dotenv.config).not.toHaveBeenCalled();
    expect(config.env).toBe("test");
  });

  test("outside test mode it reads backend/.env and fails fast listing missing values", () => {
    const { config, error, dotenv } = loadConfigModule({ NODE_ENV: "development" });
    expect(dotenv.config).toHaveBeenCalledTimes(1);
    expect(dotenv.config.mock.calls[0][0].path).toMatch(/backend[\\/]\.env$/);
    expect(config).toBeUndefined();
    expect(error.message).toMatch(/SUPABASE_URL: missing/);
    expect(error.message).toMatch(/SUPABASE_PUBLISHABLE_KEY: missing/);
  });
});

describe("src/index.js", () => {
  test("prints the readable config error and exits with code 1", () => {
    jest.doMock("../../src/config", () => {
      throw new Error("Invalid or missing settings in backend/.env:\n  - SUPABASE_URL: missing");
    });
    const listen = jest.fn();
    jest.doMock("../../src/app", () => ({ listen }));
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = jest.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    jest.isolateModules(() => {
      expect(() => require("../../src/index")).toThrow("process.exit called");
    });
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringMatching(/SUPABASE_URL: missing/));
    expect(listen).not.toHaveBeenCalled();
  });

  test("starts the app on the configured port", () => {
    jest.doMock("../../src/config", () => ({ port: 4321, env: "test" }));
    const listen = jest.fn((port, cb) => cb());
    jest.doMock("../../src/app", () => ({ listen }));
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    jest.isolateModules(() => require("../../src/index"));
    expect(listen).toHaveBeenCalledWith(4321, expect.any(Function));
    expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/4321/));
  });
});

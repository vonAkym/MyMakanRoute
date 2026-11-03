// Loads backend/.env once and exports the checked, frozen config object.
// Other files read settings from here, never from process.env directly.

const path = require("path");
const dotenv = require("dotenv");
const { loadConfig } = require("./loadConfig");

// In tests, never read the developer's real .env: tests must run the same everywhere.
if (process.env.NODE_ENV !== "test") {
  dotenv.config({ path: path.join(__dirname, "..", "..", ".env"), quiet: true });
}

module.exports = loadConfig(process.env);

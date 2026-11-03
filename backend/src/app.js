// Builds the Express app without starting it, so tests can call it through supertest.

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const config = require("./config");
const db = require("./lib/db");
const { success, asyncHandler } = require("./lib/response");
const { notFound } = require("./middleware/notFound");
const { errorHandler } = require("./middleware/errorHandler");

const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    // Browsers may only call the API from our own web/mobile dev origins.
    // Requests with no Origin header (curl, native mobile apps) are not affected by CORS.
    origin: config.corsOrigins,
  }),
);
app.use(express.json({ limit: "100kb" }));

app.get("/health", (req, res) => {
  success(res, { status: "ok", app: "MyMakanRoute" });
});

app.get(
  "/health/db",
  asyncHandler(async (req, res) => {
    const { rows } = await db.query("select count(*)::int as places from places");
    success(res, { status: "ok", database: "connected", places: rows[0].places });
  }),
);

app.use("/api/discovery", require("./modules/food-discovery/routes").router);
app.use("/api/hopping", require("./modules/food-hopping/routes").router);
app.use("/api/analytics", require("./modules/food-stalls-analytics/routes").router);

app.use(notFound);
app.use(errorHandler);

module.exports = app;

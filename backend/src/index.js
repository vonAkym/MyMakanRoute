// Starts the HTTP server. The app itself is built in app.js.

let config;
try {
  config = require("./config");
} catch (err) {
  // Bad or missing settings: show the readable list, not a stack trace.
  console.error(err.message);
  process.exit(1);
}

const app = require("./app");

app.listen(config.port, () => {
  console.log(`MyMakanRoute API on port ${config.port} (${config.env})`);
});

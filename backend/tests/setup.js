// Runs before every test file. Tests never read the real .env (see src/config/index.js)
// and never need a database or internet connection.
process.env.NODE_ENV = "test";

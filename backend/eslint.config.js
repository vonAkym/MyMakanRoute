// ESLint flat config for the backend (CommonJS, Node, Jest).
// eslint-config-prettier turns off style rules so ESLint and Prettier never disagree.

const js = require("@eslint/js");
const globals = require("globals");
const prettier = require("eslint-config-prettier");

module.exports = [
  { ignores: ["node_modules/", "coverage/"] },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "commonjs",
      globals: { ...globals.node },
    },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      eqeqeq: ["error", "always", { null: "ignore" }],
    },
  },
  {
    files: ["tests/**/*.js"],
    languageOptions: { globals: { ...globals.jest } },
  },
  prettier,
];

import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["node_modules/", "coverage/", "public/", "temp/", "load-tests/"],
  },

  js.configs.recommended,

  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },

    rules: {
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "no-undef": "error",
      "prefer-const": "warn",
      "eqeqeq": ["error", "always",{"null":"ignore"}],
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
      "consistent-return": "error",
      "curly": ["error", "all"],
      "complexity": ["warn", { "max": 12 }],
    },
  },

  // Relax some rules for test files
  {
    files: ["tests/**/*.js", "**/*.test.js", "**/__tests__/**/*.js"],
    rules: {
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "no-console": "off",
    },
  },
];
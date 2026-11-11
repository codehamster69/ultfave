/**
 * ESLint 9 flat config.
 *
 * eslint-config-next 15.x still ships legacy (eslintrc) presets, so they are
 * bridged through FlatCompat. Rules come from `next/core-web-vitals` (React,
 * hooks, a11y, Next) and `next/typescript` (typescript-eslint recommended).
 */
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      ".next-*/**",
      "out/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      ".agent/**",
      "next-env.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // `_`-prefixed bindings are intentional placeholders.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Node scripts and tests are plain Node code, not React.
    files: ["scripts/**/*.mjs", "tests/**/*.{ts,mjs}", "*.config.{mjs,ts}"],
    rules: {
      "import/no-anonymous-default-export": "off",
    },
  },
];

export default config;

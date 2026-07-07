import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Playwright end-to-end tests use their own toolchain and conventions
    // (e.g. the `use` fixture callback, which the React Hooks rules misread).
    // They are linted/typechecked by Playwright's own runner instead.
    "tests/e2e/**",
    "playwright.config.ts",
    // Generated Playwright artifacts (HTML report, traces, results).
    "playwright-report/**",
    "test-results/**",
    "blob-report/**",
  ]),
  {
    rules: {
      /*
       * We intentionally fetch data on mount inside useEffect using a small
       * `load()` helper that toggles a loading flag. The new react-hooks rule
       * flags the synchronous setState in that pattern, but for simple
       * client-side data fetching it is a deliberate and readable choice, so
       * we turn it off project-wide.
       */
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;

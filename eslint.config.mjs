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
    // Vendored Coocon NXiSAS bundle — verbatim vendor asset that
    // must not be re-linted, re-formatted, or transpiled (see
    // workspace CLAUDE.md "COOCON nxisas SCRAPING BUNDLE" — the
    // bundle is signed against NXiSAS.exe and any byte change can
    // break the engine handshake). public/ assets aren't part of
    // the app source set anyway; this just hides the vendor noise.
    "public/nxisas/**",
  ]),
]);

export default eslintConfig;

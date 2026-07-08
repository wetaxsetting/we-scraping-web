import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * Minimal Vitest harness for wecms-web component/regression tests.
 * jsdom environment + the React plugin so `.tsx` renders under
 * @testing-library/react. Path alias `@/*` → project root mirrors
 * tsconfig so imports resolve identically to the app build.
 */
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./", import.meta.url)),
        },
    },
    test: {
        environment: "jsdom",
        globals: true,
        setupFiles: ["./vitest.setup.ts"],
        include: ["components/**/*.test.{ts,tsx}", "lib/**/*.test.{ts,tsx}"],
    },
});

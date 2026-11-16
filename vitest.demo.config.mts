import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

/**
 * `npm run demo:flow` — runs src/test/demo/flow.demo.ts against DATABASE_URL
 * and prints a Markdown report of the whole attempt flow. Local database only,
 * unless DEMO_ALLOW_REMOTE=1 (see the file header).
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./src/test/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/test/demo/*.demo.ts"],
    env: loadEnv("test", process.cwd(), ""),
    testTimeout: 60_000,
    disableConsoleIntercept: true,
  },
});

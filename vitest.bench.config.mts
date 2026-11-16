import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

/** `npm run bench:flow` — times the student requests against DATABASE_URL (local database only). */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./src/test/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/test/bench/*.bench.ts"],
    env: loadEnv("test", process.cwd(), ""),
    testTimeout: 300_000,
    disableConsoleIntercept: true,
  },
});

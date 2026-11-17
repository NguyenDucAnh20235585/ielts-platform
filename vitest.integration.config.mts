import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

/**
 * Integration tests run the services against a real database that has the
 * migrations and seed applied (local Supabase: `npx supabase db reset`).
 * DATABASE_URL is read from .env.local. They create their own users and never
 * delete data, so run them only against a local database.
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
    include: ["src/**/*.int.test.ts"],
    env: loadEnv("test", process.cwd(), ""),
    fileParallelism: false,
    testTimeout: 30_000,
  },
});

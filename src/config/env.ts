import "server-only";
import { z } from "zod";

/**
 * Server-side environment. Parsed lazily (on first use) so that `next build`
 * does not need real secrets. Values are never logged — only the names of
 * missing/invalid variables.
 */
const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  DATABASE_URL: z
    .string()
    .regex(/^postgres(ql)?:\/\//, "must be a postgres:// connection string"),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(5),
  // APP_ORIGINS is read by src/server/http/route.ts directly, so the CSRF
  // guard keeps working even if the database variables are missing.
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  if (!cachedEnv) {
    const result = serverEnvSchema.safeParse(process.env);
    if (!result.success) {
      const names = result.error.issues.map((issue) => issue.path.join("."));
      throw new Error(
        `Invalid server environment variables: ${[...new Set(names)].join(", ")}`,
      );
    }
    cachedEnv = result.data;
  }
  return cachedEnv;
}

import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { serverEnv } from "@/config/env";

/**
 * Supabase client bound to the current request's cookies. Used only for
 * authentication (D-008): data access goes through `db()`.
 * Create a new one per request.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const env = serverEnv();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      // Called when Supabase refreshes the session. Route Handlers may set
      // cookies; the no-cache headers Supabase asks for are already set on
      // every /api response by withRoute().
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });
}

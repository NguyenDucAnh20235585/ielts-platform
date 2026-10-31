import "server-only";

import { db } from "@/server/db/client";
import { ApiError } from "@/server/http/errors";

import { createSupabaseServerClient } from "./supabase-server";

export type Role = "STUDENT" | "ADMIN";

export type CurrentUser = {
  id: string;
  email: string | null;
  role: Role;
  displayName: string | null;
  createdAt: Date;
};

export type AuthUser = { id: string; email: string | null };

export type ProfileRow = {
  role: "student" | "admin";
  display_name: string | null;
  disabled_at: Date | null;
  created_at: Date;
};

/** Injected so the rules below can be unit-tested without Supabase or a database. */
export type CurrentUserDeps = {
  getAuthUser: () => Promise<AuthUser | null>;
  loadProfile: (userId: string) => Promise<ProfileRow>;
};

/**
 * Who is calling, decided by the server only (Architacture_Boundary: the
 * client never decides its role). 401 without a valid session, 403 when the
 * account is disabled.
 */
export async function resolveCurrentUser(deps: CurrentUserDeps): Promise<CurrentUser> {
  const authUser = await deps.getAuthUser();
  if (!authUser) {
    throw new ApiError("UNAUTHORIZED", "Sign in required.");
  }
  const profile = await deps.loadProfile(authUser.id);
  if (profile.disabled_at) {
    throw new ApiError("ACCOUNT_DISABLED", "This account has been disabled.");
  }
  return {
    id: authUser.id,
    email: authUser.email,
    role: profile.role === "admin" ? "ADMIN" : "STUDENT",
    displayName: profile.display_name,
    createdAt: profile.created_at,
  };
}

export function assertAdmin(user: CurrentUser): void {
  if (user.role !== "ADMIN") {
    throw new ApiError("FORBIDDEN", "Admin role required.");
  }
}

/** The signed-in user of the current request. Throws 401/403 as ApiError. */
export async function requireUser(): Promise<CurrentUser> {
  return resolveCurrentUser({ getAuthUser: getSupabaseUser, loadProfile: loadOrCreateProfile });
}

/** Like requireUser(), and the user must be an admin (403 FORBIDDEN otherwise). */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  assertAdmin(user);
  return user;
}

async function getSupabaseUser(): Promise<AuthUser | null> {
  const supabase = await createSupabaseServerClient();
  // getUser() asks the Supabase Auth server to validate the session, so a
  // forged or revoked cookie is rejected (getSession() alone would trust it).
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    if (error.status !== undefined && error.status >= 500) {
      throw error; // Auth server problem → 500, not "signed out"
    }
    return null;
  }
  return data.user ? { id: data.user.id, email: data.user.email ?? null } : null;
}

async function loadOrCreateProfile(userId: string): Promise<ProfileRow> {
  const sql = db();
  const rows = await sql<ProfileRow[]>`
    select role, display_name, disabled_at, created_at
    from public.profiles
    where user_id = ${userId}
  `;
  if (rows[0]) {
    return rows[0];
  }
  // The on_auth_user_created trigger normally creates the profile; this covers
  // users created before the migration ran.
  const created = await sql<ProfileRow[]>`
    insert into public.profiles (user_id) values (${userId})
    on conflict (user_id) do update set user_id = excluded.user_id
    returning role, display_name, disabled_at, created_at
  `;
  const profile = created[0];
  if (!profile) {
    throw new Error("Profile could not be created.");
  }
  return profile;
}

import type { CurrentUser } from "@/server/auth/current-user";

/** Response body of GET /api/me (api-contract §3). */
export type MeResponse = {
  id: string;
  email: string | null;
  role: CurrentUser["role"];
  profile: { display_name: string | null };
  created_at: string;
};

export function toMeResponse(user: CurrentUser): MeResponse {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    profile: { display_name: user.displayName },
    created_at: user.createdAt.toISOString(),
  };
}

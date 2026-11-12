import { toMeResponse } from "@/features/auth/me-response";
import { requireUser } from "@/server/auth/current-user";
import { withRoute } from "@/server/http/route";

/** GET /api/me — the signed-in user (api-contract §3). */
export const GET = withRoute(async () => {
  const user = await requireUser();
  return Response.json(toMeResponse(user));
});

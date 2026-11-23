import { toMeResponse } from "@/shared/auth/me-response";
import { requireUser } from "@/backend/auth/current-user";
import { withRoute } from "@/backend/http/route";

/** GET /api/me — the signed-in user (api-contract §3). */
export const GET = withRoute(async () => {
  const user = await requireUser();
  return Response.json(toMeResponse(user));
});

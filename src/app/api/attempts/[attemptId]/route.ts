import { requireUser } from "@/backend/auth/current-user";
import { db } from "@/backend/db/client";
import { ApiError } from "@/backend/http/errors";
import { withRoute } from "@/backend/http/route";
import { parseUuidParam } from "@/backend/http/validation";
import { getAttempt } from "@/backend/services/attempt-lifecycle";

/** GET /api/attempts/:attemptId — resume / reload (api-contract §5). */
export const GET = withRoute(async (_request: Request, ctx: RouteContext<"/api/attempts/[attemptId]">) => {
  const user = await requireUser();
  const { attemptId } = await ctx.params;
  const id = parseUuidParam(attemptId, new ApiError("ATTEMPT_NOT_FOUND", "Attempt not found."));
  return Response.json(await getAttempt(db(), user, id, new Date()));
});

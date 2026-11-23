import { requireUser } from "@/server/auth/current-user";
import { db } from "@/server/db/client";
import { ApiError } from "@/server/http/errors";
import { withRoute } from "@/server/http/route";
import { parseUuidParam } from "@/server/http/validation";
import { getAttemptStatus } from "@/server/services/attempt-lifecycle";

/** GET /api/attempts/:attemptId/status — timer re-sync (api-contract §5). */
export const GET = withRoute(async (_request: Request, ctx: RouteContext<"/api/attempts/[attemptId]/status">) => {
  const user = await requireUser();
  const { attemptId } = await ctx.params;
  const id = parseUuidParam(attemptId, new ApiError("ATTEMPT_NOT_FOUND", "Attempt not found."));
  return Response.json(await getAttemptStatus(db(), user, id, new Date()));
});

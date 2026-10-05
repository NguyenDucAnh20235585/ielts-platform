import { requireUser } from "@/server/auth/current-user";
import { db } from "@/server/db/client";
import { ApiError } from "@/server/http/errors";
import { withRoute } from "@/server/http/route";
import { parseUuidParam } from "@/server/http/validation";
import { getResult } from "@/server/services/attempt-results";

/** GET /api/attempts/:attemptId/result (api-contract §5, §12.4). */
export const GET = withRoute(async (_request: Request, ctx: RouteContext<"/api/attempts/[attemptId]/result">) => {
  const user = await requireUser();
  const { attemptId } = await ctx.params;
  const id = parseUuidParam(attemptId, new ApiError("ATTEMPT_NOT_FOUND", "Attempt not found."));
  return Response.json(await getResult(db(), user, id, new Date()));
});

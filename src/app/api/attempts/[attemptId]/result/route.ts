import { requireUser } from "@/backend/auth/current-user";
import { db } from "@/backend/db/client";
import { ApiError } from "@/backend/http/errors";
import { withRoute } from "@/backend/http/route";
import { parseUuidParam } from "@/backend/http/validation";
import { getResult } from "@/backend/services/attempt-results";

/** GET /api/attempts/:attemptId/result (api-contract §5, §12.4). */
export const GET = withRoute(async (_request: Request, ctx: RouteContext<"/api/attempts/[attemptId]/result">) => {
  const user = await requireUser();
  const { attemptId } = await ctx.params;
  const id = parseUuidParam(attemptId, new ApiError("ATTEMPT_NOT_FOUND", "Attempt not found."));
  return Response.json(await getResult(db(), user, id, new Date()));
});

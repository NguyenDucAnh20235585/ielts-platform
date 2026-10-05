import { requireUser } from "@/server/auth/current-user";
import { db } from "@/server/db/client";
import { ApiError } from "@/server/http/errors";
import { withRoute } from "@/server/http/route";
import { parseUuidParam } from "@/server/http/validation";
import { getActiveAttemptForTest } from "@/server/services/test-catalogue";

/** GET /api/tests/:testId/active-attempt (api-contract §4, C-15). */
export const GET = withRoute(async (_request: Request, ctx: RouteContext<"/api/tests/[testId]/active-attempt">) => {
  const user = await requireUser();
  const { testId } = await ctx.params;
  const id = parseUuidParam(testId, new ApiError("TEST_NOT_FOUND", "Test not found."));
  return Response.json(await getActiveAttemptForTest(db(), user, id, new Date()));
});

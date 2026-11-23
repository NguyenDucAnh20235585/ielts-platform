import { requireUser } from "@/backend/auth/current-user";
import { db } from "@/backend/db/client";
import { ApiError } from "@/backend/http/errors";
import { withRoute } from "@/backend/http/route";
import { parseUuidParam } from "@/backend/http/validation";
import { getTestDetail } from "@/backend/services/test-catalogue";

/** GET /api/tests/:testId — test info before starting (api-contract §4). */
export const GET = withRoute(async (_request: Request, ctx: RouteContext<"/api/tests/[testId]">) => {
  const user = await requireUser();
  const { testId } = await ctx.params;
  const id = parseUuidParam(testId, new ApiError("TEST_NOT_FOUND", "Test not found."));
  return Response.json(await getTestDetail(db(), user, id, new Date()));
});

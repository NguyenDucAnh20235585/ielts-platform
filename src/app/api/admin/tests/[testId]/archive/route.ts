import { emptyBody } from "@/features/admin/request-schemas";
import { requireAdmin } from "@/server/auth/current-user";
import { db } from "@/server/db/client";
import { ApiError } from "@/server/http/errors";
import { withRoute } from "@/server/http/route";
import { parseJsonBody, parseUuidParam } from "@/server/http/validation";
import { archiveTest } from "@/server/services/admin-tests";

/** POST /api/admin/tests/:testId/archive (§6.11). */
export const POST = withRoute(async (request: Request, ctx: RouteContext<"/api/admin/tests/[testId]/archive">) => {
  const admin = await requireAdmin();
  const { testId } = await ctx.params;
  const id = parseUuidParam(testId, new ApiError("TEST_NOT_FOUND", "Test not found."));
  await parseJsonBody(request, emptyBody);
  return Response.json(await archiveTest(db(), admin, id));
});

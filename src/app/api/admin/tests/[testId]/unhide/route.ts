import { emptyBody } from "@/backend/admin/request-schemas";
import { requireAdmin } from "@/backend/auth/current-user";
import { db } from "@/backend/db/client";
import { ApiError } from "@/backend/http/errors";
import { withRoute } from "@/backend/http/route";
import { parseJsonBody, parseUuidParam } from "@/backend/http/validation";
import { setTestHidden } from "@/backend/services/admin-tests";

/** POST /api/admin/tests/:testId/unhide — show to students again (§6.10, D-015). */
export const POST = withRoute(async (request: Request, ctx: RouteContext<"/api/admin/tests/[testId]/unhide">) => {
  const admin = await requireAdmin();
  const { testId } = await ctx.params;
  const id = parseUuidParam(testId, new ApiError("TEST_NOT_FOUND", "Test not found."));
  await parseJsonBody(request, emptyBody);
  return Response.json(await setTestHidden(db(), admin, id, false));
});

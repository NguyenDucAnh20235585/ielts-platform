import { emptyBody } from "@/features/admin/request-schemas";
import { requireAdmin } from "@/server/auth/current-user";
import { db } from "@/server/db/client";
import { ApiError } from "@/server/http/errors";
import { withRoute } from "@/server/http/route";
import { parseJsonBody, parseUuidParam } from "@/server/http/validation";
import { setTestHidden } from "@/server/services/admin-tests";

/** POST /api/admin/tests/:testId/hide — hide from students; can be undone (§6.10, D-015). */
export const POST = withRoute(async (request: Request, ctx: RouteContext<"/api/admin/tests/[testId]/hide">) => {
  const admin = await requireAdmin();
  const { testId } = await ctx.params;
  const id = parseUuidParam(testId, new ApiError("TEST_NOT_FOUND", "Test not found."));
  await parseJsonBody(request, emptyBody);
  return Response.json(await setTestHidden(db(), admin, id, true));
});

import { updateTestBody } from "@/features/admin/request-schemas";
import { requireAdmin } from "@/backend/auth/current-user";
import { db } from "@/backend/db/client";
import { ApiError } from "@/backend/http/errors";
import { withRoute } from "@/backend/http/route";
import { parseJsonBody, parseUuidParam } from "@/backend/http/validation";
import { getAdminTest, updateAdminTest } from "@/backend/services/admin-tests";

type Context = RouteContext<"/api/admin/tests/[testId]">;

async function testIdOf(ctx: Context): Promise<string> {
  const { testId } = await ctx.params;
  return parseUuidParam(testId, new ApiError("TEST_NOT_FOUND", "Test not found."));
}

/** GET /api/admin/tests/:testId — the test and its versions (§6.3). */
export const GET = withRoute(async (_request: Request, ctx: Context) => {
  await requireAdmin();
  return Response.json(await getAdminTest(db(), await testIdOf(ctx)));
});

/** PATCH /api/admin/tests/:testId — title, description, type (§6.4). */
export const PATCH = withRoute(async (request: Request, ctx: Context) => {
  await requireAdmin();
  const testId = await testIdOf(ctx);
  const body = await parseJsonBody(request, updateTestBody);
  return Response.json(await updateAdminTest(db(), testId, body));
});

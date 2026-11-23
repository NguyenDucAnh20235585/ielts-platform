import { updateTestBody } from "@/features/admin/request-schemas";
import { requireAdmin } from "@/server/auth/current-user";
import { db } from "@/server/db/client";
import { ApiError } from "@/server/http/errors";
import { withRoute } from "@/server/http/route";
import { parseJsonBody, parseUuidParam } from "@/server/http/validation";
import { getAdminTest, updateAdminTest } from "@/server/services/admin-tests";

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

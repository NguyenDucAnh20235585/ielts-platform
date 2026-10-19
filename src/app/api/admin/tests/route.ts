import { adminTestsQuery, createTestBody } from "@/features/admin/request-schemas";
import { requireAdmin } from "@/server/auth/current-user";
import { db } from "@/server/db/client";
import { withRoute } from "@/server/http/route";
import { parseJsonBody, parseQuery } from "@/server/http/validation";
import { createAdminTest, listAdminTests } from "@/server/services/admin-tests";

/** GET /api/admin/tests — all tests, any status (api-contract §6.1). */
export const GET = withRoute(async (request: Request) => {
  await requireAdmin();
  const query = parseQuery(request, adminTestsQuery);
  return Response.json(await listAdminTests(db(), query));
});

/** POST /api/admin/tests — new DRAFT test with version 1 (§6.2). */
export const POST = withRoute(async (request: Request) => {
  const admin = await requireAdmin();
  const body = await parseJsonBody(request, createTestBody);
  return Response.json(await createAdminTest(db(), admin, body), { status: 201 });
});

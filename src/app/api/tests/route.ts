import { catalogueQuery } from "@/features/attempt/request-schemas";
import { requireUser } from "@/server/auth/current-user";
import { db } from "@/server/db/client";
import { withRoute } from "@/server/http/route";
import { parseQuery } from "@/server/http/validation";
import { listTests } from "@/server/services/test-catalogue";

/** GET /api/tests — published tests (api-contract §4). */
export const GET = withRoute(async (request: Request) => {
  const user = await requireUser();
  const query = parseQuery(request, catalogueQuery);
  return Response.json(await listTests(db(), user, query, new Date()));
});

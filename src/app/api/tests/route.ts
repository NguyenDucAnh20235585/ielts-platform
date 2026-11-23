import { catalogueQuery } from "@/features/attempt/request-schemas";
import { requireUser } from "@/backend/auth/current-user";
import { db } from "@/backend/db/client";
import { withRoute } from "@/backend/http/route";
import { parseQuery } from "@/backend/http/validation";
import { listTests } from "@/backend/services/test-catalogue";

/** GET /api/tests — published tests (api-contract §4). */
export const GET = withRoute(async (request: Request) => {
  const user = await requireUser();
  const query = parseQuery(request, catalogueQuery);
  return Response.json(await listTests(db(), user, query, new Date()));
});

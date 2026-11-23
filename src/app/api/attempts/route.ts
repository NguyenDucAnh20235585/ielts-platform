import { historyQuery } from "@/features/attempt/request-schemas";
import { requireUser } from "@/backend/auth/current-user";
import { db } from "@/backend/db/client";
import { withRoute } from "@/backend/http/route";
import { parseQuery } from "@/backend/http/validation";
import { listHistory } from "@/backend/services/attempt-results";

/** GET /api/attempts — the caller's attempt history (api-contract §5). */
export const GET = withRoute(async (request: Request) => {
  const user = await requireUser();
  const query = parseQuery(request, historyQuery);
  return Response.json(await listHistory(db(), user, query, new Date()));
});

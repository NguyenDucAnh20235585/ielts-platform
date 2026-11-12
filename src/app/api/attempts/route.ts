import { historyQuery } from "@/features/attempt/request-schemas";
import { requireUser } from "@/server/auth/current-user";
import { db } from "@/server/db/client";
import { withRoute } from "@/server/http/route";
import { parseQuery } from "@/server/http/validation";
import { listHistory } from "@/server/services/attempt-results";

/** GET /api/attempts — the caller's attempt history (api-contract §5). */
export const GET = withRoute(async (request: Request) => {
  const user = await requireUser();
  const query = parseQuery(request, historyQuery);
  return Response.json(await listHistory(db(), user, query, new Date()));
});

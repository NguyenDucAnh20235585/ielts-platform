import { z } from "zod";

import { requireUser } from "@/server/auth/current-user";
import { db } from "@/server/db/client";
import { ApiError } from "@/server/http/errors";
import { withRoute } from "@/server/http/route";
import { parseJsonBody, parseUuidParam } from "@/server/http/validation";
import { beginAttempt } from "@/server/services/attempt-lifecycle";

/** POST /api/attempts/:attemptId/begin — start the timer (api-contract §5, C-02). */
export const POST = withRoute(async (request: Request, ctx: RouteContext<"/api/attempts/[attemptId]/begin">) => {
  const user = await requireUser();
  const { attemptId } = await ctx.params;
  const id = parseUuidParam(attemptId, new ApiError("ATTEMPT_NOT_FOUND", "Attempt not found."));
  await parseJsonBody(request, z.strictObject({}));
  return Response.json(await beginAttempt(db(), user, id, new Date()));
});

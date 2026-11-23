import { z } from "zod";

import { requireUser } from "@/backend/auth/current-user";
import { db } from "@/backend/db/client";
import { ApiError } from "@/backend/http/errors";
import { withRoute } from "@/backend/http/route";
import { parseJsonBody, parseUuidParam } from "@/backend/http/validation";
import { beginAttempt } from "@/backend/services/attempt-lifecycle";

/** POST /api/attempts/:attemptId/begin — start the timer (api-contract §5, C-02). */
export const POST = withRoute(async (request: Request, ctx: RouteContext<"/api/attempts/[attemptId]/begin">) => {
  const user = await requireUser();
  const { attemptId } = await ctx.params;
  const id = parseUuidParam(attemptId, new ApiError("ATTEMPT_NOT_FOUND", "Attempt not found."));
  await parseJsonBody(request, z.strictObject({}));
  return Response.json(await beginAttempt(db(), user, id, new Date()));
});

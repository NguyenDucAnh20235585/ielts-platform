import { submitBody } from "@/features/attempt/request-schemas";
import { requireUser } from "@/server/auth/current-user";
import { db } from "@/server/db/client";
import { ApiError } from "@/server/http/errors";
import { withRoute } from "@/server/http/route";
import { parseJsonBody, parseUuidParam } from "@/server/http/validation";
import { submitAttempt } from "@/server/services/attempt-submit";

/** POST /api/attempts/:attemptId/submit — idempotent (api-contract §5, C-16). */
export const POST = withRoute(async (request: Request, ctx: RouteContext<"/api/attempts/[attemptId]/submit">) => {
  const user = await requireUser();
  const { attemptId } = await ctx.params;
  const id = parseUuidParam(attemptId, new ApiError("ATTEMPT_NOT_FOUND", "Attempt not found."));
  const body = await parseJsonBody(request, submitBody);
  return Response.json(await submitAttempt(db(), user, id, body.answers, new Date()));
});

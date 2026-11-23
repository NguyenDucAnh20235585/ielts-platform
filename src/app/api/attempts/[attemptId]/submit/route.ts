import { submitBody } from "@/backend/attempt/request-schemas";
import { requireUser } from "@/backend/auth/current-user";
import { db } from "@/backend/db/client";
import { ApiError } from "@/backend/http/errors";
import { withRoute } from "@/backend/http/route";
import { parseJsonBody, parseUuidParam } from "@/backend/http/validation";
import { submitAttempt } from "@/backend/services/attempt-submit";

/** POST /api/attempts/:attemptId/submit — idempotent (api-contract §5, C-16). */
export const POST = withRoute(async (request: Request, ctx: RouteContext<"/api/attempts/[attemptId]/submit">) => {
  const user = await requireUser();
  const { attemptId } = await ctx.params;
  const id = parseUuidParam(attemptId, new ApiError("ATTEMPT_NOT_FOUND", "Attempt not found."));
  const body = await parseJsonBody(request, submitBody);
  return Response.json(await submitAttempt(db(), user, id, body.answers, new Date()));
});

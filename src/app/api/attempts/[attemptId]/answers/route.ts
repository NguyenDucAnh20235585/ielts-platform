import { saveAnswersBody } from "@/backend/attempt/request-schemas";
import { requireUser } from "@/backend/auth/current-user";
import { db } from "@/backend/db/client";
import { ApiError } from "@/backend/http/errors";
import { withRoute } from "@/backend/http/route";
import { parseJsonBody, parseUuidParam } from "@/backend/http/validation";
import { saveAnswers } from "@/backend/services/attempt-answers";

/** PATCH /api/attempts/:attemptId/answers — autosave (api-contract §5). */
export const PATCH = withRoute(async (request: Request, ctx: RouteContext<"/api/attempts/[attemptId]/answers">) => {
  const user = await requireUser();
  const { attemptId } = await ctx.params;
  const id = parseUuidParam(attemptId, new ApiError("ATTEMPT_NOT_FOUND", "Attempt not found."));
  const body = await parseJsonBody(request, saveAnswersBody);
  return Response.json(await saveAnswers(db(), user, id, body.answers, new Date()));
});

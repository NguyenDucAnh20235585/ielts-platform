import { flagBody } from "@/features/attempt/request-schemas";
import { requireUser } from "@/server/auth/current-user";
import { db } from "@/server/db/client";
import { ApiError } from "@/server/http/errors";
import { withRoute } from "@/server/http/route";
import { parseJsonBody, parseUuidParam } from "@/server/http/validation";
import { setFlag } from "@/server/services/attempt-answers";

/** PATCH /api/attempts/:attemptId/questions/:questionId/flag (api-contract §5). */
export const PATCH = withRoute(
  async (request: Request, ctx: RouteContext<"/api/attempts/[attemptId]/questions/[questionId]/flag">) => {
    const user = await requireUser();
    const { attemptId, questionId } = await ctx.params;
    const attempt = parseUuidParam(attemptId, new ApiError("ATTEMPT_NOT_FOUND", "Attempt not found."));
    const question = parseUuidParam(questionId, new ApiError("QUESTION_NOT_FOUND", "Question not found."));
    const body = await parseJsonBody(request, flagBody);
    return Response.json(await setFlag(db(), user, attempt, question, body.flagged, new Date()));
  },
);

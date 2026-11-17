import { answerKeyBody } from "@/features/admin/request-schemas";
import { requireAdmin } from "@/server/auth/current-user";
import { db } from "@/server/db/client";
import { ApiError } from "@/server/http/errors";
import { withRoute } from "@/server/http/route";
import { parseJsonBody, parseUuidParam } from "@/server/http/validation";
import { putAnswerKey } from "@/server/services/admin-content";

/** PUT /api/admin/questions/:questionId/answer-key — create or replace (§7.4). */
export const PUT = withRoute(async (request: Request, ctx: RouteContext<"/api/admin/questions/[questionId]/answer-key">) => {
  const admin = await requireAdmin();
  const { questionId } = await ctx.params;
  const id = parseUuidParam(questionId, new ApiError("QUESTION_NOT_FOUND", "Question not found."));
  const body = await parseJsonBody(request, answerKeyBody);
  return Response.json(await putAnswerKey(db(), admin, id, body));
});

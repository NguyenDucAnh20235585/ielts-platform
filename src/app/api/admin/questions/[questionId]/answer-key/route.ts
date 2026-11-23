import { answerKeyBody } from "@/backend/admin/request-schemas";
import { requireAdmin } from "@/backend/auth/current-user";
import { db } from "@/backend/db/client";
import { ApiError } from "@/backend/http/errors";
import { withRoute } from "@/backend/http/route";
import { parseJsonBody, parseUuidParam } from "@/backend/http/validation";
import { putAnswerKey } from "@/backend/services/admin-content";

/** PUT /api/admin/questions/:questionId/answer-key — create or replace (§7.4). */
export const PUT = withRoute(async (request: Request, ctx: RouteContext<"/api/admin/questions/[questionId]/answer-key">) => {
  const admin = await requireAdmin();
  const { questionId } = await ctx.params;
  const id = parseUuidParam(questionId, new ApiError("QUESTION_NOT_FOUND", "Question not found."));
  const body = await parseJsonBody(request, answerKeyBody);
  return Response.json(await putAnswerKey(db(), admin, id, body));
});

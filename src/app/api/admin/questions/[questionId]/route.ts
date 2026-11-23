import { updateQuestionBody } from "@/features/admin/request-schemas";
import { requireAdmin } from "@/backend/auth/current-user";
import { db } from "@/backend/db/client";
import { ApiError } from "@/backend/http/errors";
import { withRoute } from "@/backend/http/route";
import { parseJsonBody, parseUuidParam } from "@/backend/http/validation";
import { deleteQuestion, updateQuestion } from "@/backend/services/admin-content";

type Context = RouteContext<"/api/admin/questions/[questionId]">;

async function questionIdOf(ctx: Context): Promise<string> {
  const { questionId } = await ctx.params;
  return parseUuidParam(questionId, new ApiError("QUESTION_NOT_FOUND", "Question not found."));
}

/** PATCH /api/admin/questions/:questionId (§7.3). */
export const PATCH = withRoute(async (request: Request, ctx: Context) => {
  const admin = await requireAdmin();
  const questionId = await questionIdOf(ctx);
  const body = await parseJsonBody(request, updateQuestionBody);
  return Response.json(await updateQuestion(db(), admin, questionId, body));
});

/** DELETE /api/admin/questions/:questionId (§7.3). */
export const DELETE = withRoute(async (_request: Request, ctx: Context) => {
  await requireAdmin();
  return Response.json(await deleteQuestion(db(), await questionIdOf(ctx)));
});

import { updateQuestionBody } from "@/features/admin/request-schemas";
import { requireAdmin } from "@/server/auth/current-user";
import { db } from "@/server/db/client";
import { ApiError } from "@/server/http/errors";
import { withRoute } from "@/server/http/route";
import { parseJsonBody, parseUuidParam } from "@/server/http/validation";
import { deleteQuestion, updateQuestion } from "@/server/services/admin-content";

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

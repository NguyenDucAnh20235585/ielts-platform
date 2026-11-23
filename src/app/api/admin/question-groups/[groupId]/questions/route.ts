import { createQuestionBody } from "@/features/admin/request-schemas";
import { requireAdmin } from "@/backend/auth/current-user";
import { db } from "@/backend/db/client";
import { ApiError } from "@/backend/http/errors";
import { withRoute } from "@/backend/http/route";
import { parseJsonBody, parseUuidParam } from "@/backend/http/validation";
import { createQuestion } from "@/backend/services/admin-content";

/** POST /api/admin/question-groups/:groupId/questions (§7.3). */
export const POST = withRoute(async (request: Request, ctx: RouteContext<"/api/admin/question-groups/[groupId]/questions">) => {
  await requireAdmin();
  const { groupId } = await ctx.params;
  const id = parseUuidParam(groupId, new ApiError("GROUP_NOT_FOUND", "Question group not found."));
  const body = await parseJsonBody(request, createQuestionBody);
  return Response.json(await createQuestion(db(), id, body), { status: 201 });
});
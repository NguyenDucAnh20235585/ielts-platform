import { createQuestionBody } from "@/features/admin/request-schemas";
import { requireAdmin } from "@/server/auth/current-user";
import { db } from "@/server/db/client";
import { ApiError } from "@/server/http/errors";
import { withRoute } from "@/server/http/route";
import { parseJsonBody, parseUuidParam } from "@/server/http/validation";
import { createQuestion } from "@/server/services/admin-content";

/** POST /api/admin/question-groups/:groupId/questions (§7.3). */
export const POST = withRoute(async (request: Request, ctx: RouteContext<"/api/admin/question-groups/[groupId]/questions">) => {
  await requireAdmin();
  const { groupId } = await ctx.params;
  const id = parseUuidParam(groupId, new ApiError("GROUP_NOT_FOUND", "Question group not found."));
  const body = await parseJsonBody(request, createQuestionBody);
  return Response.json(await createQuestion(db(), id, body), { status: 201 });
});

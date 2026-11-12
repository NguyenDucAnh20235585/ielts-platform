import { updateGroupBody } from "@/features/admin/request-schemas";
import { requireAdmin } from "@/server/auth/current-user";
import { db } from "@/server/db/client";
import { ApiError } from "@/server/http/errors";
import { withRoute } from "@/server/http/route";
import { parseJsonBody, parseUuidParam } from "@/server/http/validation";
import { deleteGroup, updateGroup } from "@/server/services/admin-content";

type Context = RouteContext<"/api/admin/question-groups/[groupId]">;

async function groupIdOf(ctx: Context): Promise<string> {
  const { groupId } = await ctx.params;
  return parseUuidParam(groupId, new ApiError("GROUP_NOT_FOUND", "Question group not found."));
}

/** PATCH /api/admin/question-groups/:groupId (§7.2). */
export const PATCH = withRoute(async (request: Request, ctx: Context) => {
  await requireAdmin();
  const groupId = await groupIdOf(ctx);
  const body = await parseJsonBody(request, updateGroupBody);
  return Response.json(await updateGroup(db(), groupId, body));
});

/** DELETE /api/admin/question-groups/:groupId — with its questions and keys (§7.2). */
export const DELETE = withRoute(async (_request: Request, ctx: Context) => {
  await requireAdmin();
  return Response.json(await deleteGroup(db(), await groupIdOf(ctx)));
});

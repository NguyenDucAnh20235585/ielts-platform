import { createGroupBody } from "@/features/admin/request-schemas";
import { requireAdmin } from "@/server/auth/current-user";
import { db } from "@/server/db/client";
import { ApiError } from "@/server/http/errors";
import { withRoute } from "@/server/http/route";
import { parseJsonBody, parseUuidParam } from "@/server/http/validation";
import { createGroup } from "@/server/services/admin-content";

/** POST /api/admin/sections/:sectionId/question-groups (§7.2). */
export const POST = withRoute(async (request: Request, ctx: RouteContext<"/api/admin/sections/[sectionId]/question-groups">) => {
  await requireAdmin();
  const { sectionId } = await ctx.params;
  const id = parseUuidParam(sectionId, new ApiError("SECTION_NOT_FOUND", "Section not found."));
  const body = await parseJsonBody(request, createGroupBody);
  return Response.json(await createGroup(db(), id, body), { status: 201 });
});

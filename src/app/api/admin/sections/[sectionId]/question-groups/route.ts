import { createGroupBody } from "@/features/admin/request-schemas";
import { requireAdmin } from "@/backend/auth/current-user";
import { db } from "@/backend/db/client";
import { ApiError } from "@/backend/http/errors";
import { withRoute } from "@/backend/http/route";
import { parseJsonBody, parseUuidParam } from "@/backend/http/validation";
import { createGroup } from "@/backend/services/admin-content";

/** POST /api/admin/sections/:sectionId/question-groups (§7.2). */
export const POST = withRoute(async (request: Request, ctx: RouteContext<"/api/admin/sections/[sectionId]/question-groups">) => {
  await requireAdmin();
  const { sectionId } = await ctx.params;
  const id = parseUuidParam(sectionId, new ApiError("SECTION_NOT_FOUND", "Section not found."));
  const body = await parseJsonBody(request, createGroupBody);
  return Response.json(await createGroup(db(), id, body), { status: 201 });
});

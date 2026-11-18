import { createSectionBody } from "@/features/admin/request-schemas";
import { requireAdmin } from "@/server/auth/current-user";
import { db } from "@/server/db/client";
import { ApiError } from "@/server/http/errors";
import { withRoute } from "@/server/http/route";
import { parseJsonBody, parseUuidParam } from "@/server/http/validation";
import { createSection } from "@/server/services/admin-content";

/** POST /api/admin/test-versions/:versionId/sections (§7.1). */
export const POST = withRoute(async (request: Request, ctx: RouteContext<"/api/admin/test-versions/[versionId]/sections">) => {
  await requireAdmin();
  const { versionId } = await ctx.params;
  const id = parseUuidParam(versionId, new ApiError("VERSION_NOT_FOUND", "Test version not found."));
  const body = await parseJsonBody(request, createSectionBody);
  return Response.json(await createSection(db(), id, body), { status: 201 });
});

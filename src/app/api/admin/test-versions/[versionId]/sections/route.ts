import { createSectionBody } from "@/features/admin/request-schemas";
import { requireAdmin } from "@/backend/auth/current-user";
import { db } from "@/backend/db/client";
import { ApiError } from "@/backend/http/errors";
import { withRoute } from "@/backend/http/route";
import { parseJsonBody, parseUuidParam } from "@/backend/http/validation";
import { createSection } from "@/backend/services/admin-content";

/** POST /api/admin/test-versions/:versionId/sections (§7.1). */
export const POST = withRoute(async (request: Request, ctx: RouteContext<"/api/admin/test-versions/[versionId]/sections">) => {
  await requireAdmin();
  const { versionId } = await ctx.params;
  const id = parseUuidParam(versionId, new ApiError("VERSION_NOT_FOUND", "Test version not found."));
  const body = await parseJsonBody(request, createSectionBody);
  return Response.json(await createSection(db(), id, body), { status: 201 });
});

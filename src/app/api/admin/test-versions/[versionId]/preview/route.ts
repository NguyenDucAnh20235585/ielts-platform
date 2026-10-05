import { requireAdmin } from "@/server/auth/current-user";
import { db } from "@/server/db/client";
import { ApiError } from "@/server/http/errors";
import { withRoute } from "@/server/http/route";
import { parseUuidParam } from "@/server/http/validation";
import { previewVersion } from "@/server/services/admin-versions";

/** GET /api/admin/test-versions/:versionId/preview — StudentContent, no answer keys (§6.8). */
export const GET = withRoute(async (_request: Request, ctx: RouteContext<"/api/admin/test-versions/[versionId]/preview">) => {
  await requireAdmin();
  const { versionId } = await ctx.params;
  const id = parseUuidParam(versionId, new ApiError("VERSION_NOT_FOUND", "Test version not found."));
  return Response.json(await previewVersion(db(), id));
});

import { previewQuery } from "@/backend/admin/request-schemas";
import { requireAdmin } from "@/backend/auth/current-user";
import { db } from "@/backend/db/client";
import { ApiError } from "@/backend/http/errors";
import { withRoute } from "@/backend/http/route";
import { parseQuery, parseUuidParam } from "@/backend/http/validation";
import { previewVersion } from "@/backend/services/admin-versions";

/** GET /api/admin/test-versions/:versionId/preview?mode= — StudentContent, no answer keys (§6.8). */
export const GET = withRoute(async (request: Request, ctx: RouteContext<"/api/admin/test-versions/[versionId]/preview">) => {
  await requireAdmin();
  const { versionId } = await ctx.params;
  const id = parseUuidParam(versionId, new ApiError("VERSION_NOT_FOUND", "Test version not found."));
  const query = parseQuery(request, previewQuery);
  return Response.json(await previewVersion(db(), id, query.mode));
});

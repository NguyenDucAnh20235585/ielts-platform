import { emptyBody } from "@/features/admin/request-schemas";
import { requireAdmin } from "@/server/auth/current-user";
import { db } from "@/server/db/client";
import { ApiError } from "@/server/http/errors";
import { withRoute } from "@/server/http/route";
import { parseJsonBody, parseUuidParam } from "@/server/http/validation";
import { publishVersion } from "@/server/services/admin-versions";

/** POST /api/admin/test-versions/:versionId/publish (§6.9). */
export const POST = withRoute(async (request: Request, ctx: RouteContext<"/api/admin/test-versions/[versionId]/publish">) => {
  const admin = await requireAdmin();
  const { versionId } = await ctx.params;
  const id = parseUuidParam(versionId, new ApiError("VERSION_NOT_FOUND", "Test version not found."));
  await parseJsonBody(request, emptyBody);
  return Response.json(await publishVersion(db(), admin, id, new Date()));
});

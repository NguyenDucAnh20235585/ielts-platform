import { emptyBody } from "@/features/admin/request-schemas";
import { requireAdmin } from "@/backend/auth/current-user";
import { db } from "@/backend/db/client";
import { ApiError } from "@/backend/http/errors";
import { withRoute } from "@/backend/http/route";
import { parseJsonBody, parseUuidParam } from "@/backend/http/validation";
import { publishVersion } from "@/backend/services/admin-versions";

/** POST /api/admin/test-versions/:versionId/publish (§6.9). */
export const POST = withRoute(async (request: Request, ctx: RouteContext<"/api/admin/test-versions/[versionId]/publish">) => {
  const admin = await requireAdmin();
  const { versionId } = await ctx.params;
  const id = parseUuidParam(versionId, new ApiError("VERSION_NOT_FOUND", "Test version not found."));
  await parseJsonBody(request, emptyBody);
  return Response.json(await publishVersion(db(), admin, id, new Date()));
});

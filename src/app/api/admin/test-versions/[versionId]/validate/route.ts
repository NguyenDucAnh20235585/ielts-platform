import { emptyBody } from "@/backend/admin/request-schemas";
import { requireAdmin } from "@/backend/auth/current-user";
import { db } from "@/backend/db/client";
import { ApiError } from "@/backend/http/errors";
import { withRoute } from "@/backend/http/route";
import { parseJsonBody, parseUuidParam } from "@/backend/http/validation";
import { validateVersion } from "@/backend/services/admin-versions";

/** POST /api/admin/test-versions/:versionId/validate — publish checks (§6.7). */
export const POST = withRoute(async (request: Request, ctx: RouteContext<"/api/admin/test-versions/[versionId]/validate">) => {
  await requireAdmin();
  const { versionId } = await ctx.params;
  const id = parseUuidParam(versionId, new ApiError("VERSION_NOT_FOUND", "Test version not found."));
  await parseJsonBody(request, emptyBody);
  return Response.json(await validateVersion(db(), id));
});

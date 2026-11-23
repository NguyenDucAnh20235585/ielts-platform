import { settingsPatchSchema } from "@/shared/admin/settings";
import { requireAdmin } from "@/backend/auth/current-user";
import { db } from "@/backend/db/client";
import { ApiError } from "@/backend/http/errors";
import { withRoute } from "@/backend/http/route";
import { parseJsonBody, parseUuidParam } from "@/backend/http/validation";
import { getVersionEditor, updateVersionSettings } from "@/backend/services/admin-versions";

type Context = RouteContext<"/api/admin/test-versions/[versionId]">;

async function versionIdOf(ctx: Context): Promise<string> {
  const { versionId } = await ctx.params;
  return parseUuidParam(versionId, new ApiError("VERSION_NOT_FOUND", "Test version not found."));
}

/** GET /api/admin/test-versions/:versionId — editor view with answer keys (§6.5). */
export const GET = withRoute(async (_request: Request, ctx: Context) => {
  await requireAdmin();
  return Response.json(await getVersionEditor(db(), await versionIdOf(ctx)));
});

/** PATCH /api/admin/test-versions/:versionId — settings of a DRAFT version (§6.6). */
export const PATCH = withRoute(async (request: Request, ctx: Context) => {
  const admin = await requireAdmin();
  const versionId = await versionIdOf(ctx);
  const body = await parseJsonBody(request, settingsPatchSchema);
  return Response.json(await updateVersionSettings(db(), admin, versionId, body));
});

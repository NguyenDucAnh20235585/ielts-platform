import { settingsPatchSchema } from "@/features/admin/settings";
import { requireAdmin } from "@/server/auth/current-user";
import { db } from "@/server/db/client";
import { ApiError } from "@/server/http/errors";
import { withRoute } from "@/server/http/route";
import { parseJsonBody, parseUuidParam } from "@/server/http/validation";
import { getVersionEditor, updateVersionSettings } from "@/server/services/admin-versions";

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

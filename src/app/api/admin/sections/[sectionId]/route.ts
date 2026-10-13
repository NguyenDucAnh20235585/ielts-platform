import { updateSectionBody } from "@/features/admin/request-schemas";
import { requireAdmin } from "@/server/auth/current-user";
import { db } from "@/server/db/client";
import { ApiError } from "@/server/http/errors";
import { withRoute } from "@/server/http/route";
import { parseJsonBody, parseUuidParam } from "@/server/http/validation";
import { deleteSection, updateSection } from "@/server/services/admin-content";

type Context = RouteContext<"/api/admin/sections/[sectionId]">;

async function sectionIdOf(ctx: Context): Promise<string> {
  const { sectionId } = await ctx.params;
  return parseUuidParam(sectionId, new ApiError("SECTION_NOT_FOUND", "Section not found."));
}

/** PATCH /api/admin/sections/:sectionId (§7.1). */
export const PATCH = withRoute(async (request: Request, ctx: Context) => {
  await requireAdmin();
  const sectionId = await sectionIdOf(ctx);
  const body = await parseJsonBody(request, updateSectionBody);
  return Response.json(await updateSection(db(), sectionId, body));
});

/** DELETE /api/admin/sections/:sectionId — with its groups, questions and keys (§7.1). */
export const DELETE = withRoute(async (_request: Request, ctx: Context) => {
  await requireAdmin();
  return Response.json(await deleteSection(db(), await sectionIdOf(ctx)));
});

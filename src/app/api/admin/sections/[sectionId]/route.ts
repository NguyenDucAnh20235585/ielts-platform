import { updateSectionBody } from "@/features/admin/request-schemas";
import { requireAdmin } from "@/backend/auth/current-user";
import { db } from "@/backend/db/client";
import { ApiError } from "@/backend/http/errors";
import { withRoute } from "@/backend/http/route";
import { parseJsonBody, parseUuidParam } from "@/backend/http/validation";
import { deleteSection, updateSection } from "@/backend/services/admin-content";

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

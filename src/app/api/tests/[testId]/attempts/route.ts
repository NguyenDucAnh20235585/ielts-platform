import { startAttemptBody } from "@/features/attempt/request-schemas";
import { requireUser } from "@/server/auth/current-user";
import { db } from "@/server/db/client";
import { ApiError } from "@/server/http/errors";
import { withRoute } from "@/server/http/route";
import { parseJsonBody, parseUuidParam } from "@/server/http/validation";
import { startAttempt } from "@/server/services/attempt-lifecycle";

/** POST /api/tests/:testId/attempts — start an attempt (api-contract §5, C-01, C-25). */
export const POST = withRoute(async (request: Request, ctx: RouteContext<"/api/tests/[testId]/attempts">) => {
  const user = await requireUser();
  const { testId } = await ctx.params;
  const id = parseUuidParam(testId, new ApiError("TEST_NOT_FOUND", "Test not found."));
  const body = await parseJsonBody(request, startAttemptBody);
  return Response.json(await startAttempt(db(), user, id, body.mode, new Date()), { status: 201 });
});

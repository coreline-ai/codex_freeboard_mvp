import { requireAuth } from "@/lib/api/auth";
import { handleRouteError } from "@/lib/api/errors";
import { ok } from "@/lib/api/response";

export async function GET(request: Request) {
  try {
    const ctx = await requireAuth(request.headers);
    return ok(ctx.profile);
  } catch (error) {
    return handleRouteError(error);
  }
}

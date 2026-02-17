import { z } from "zod";
import { requireAdmin, requireAuth } from "@/lib/api/auth";
import { handleRouteError } from "@/lib/api/errors";
import { createModerationLog } from "@/lib/api/moderation";
import { safeJson } from "@/lib/api/request";
import { ok } from "@/lib/api/response";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { adminUserSuspendSchema } from "@/types/schemas";

const paramsSchema = z.object({
  userId: z.string().uuid(),
});

export async function PATCH(request: Request, context: { params: Promise<{ userId: string }> }) {
  try {
    const ctx = await requireAuth(request.headers);
    requireAdmin(ctx);

    const body = adminUserSuspendSchema.parse(await safeJson(request));
    const { userId } = paramsSchema.parse(await context.params);

    const suspendedUntil = new Date(Date.now() + body.days * 24 * 60 * 60 * 1000).toISOString();
    const admin = getSupabaseAdminClient();

    const { data, error } = await admin
      .from("profiles")
      .update({
        suspended_until: suspendedUntil,
        suspend_reason: body.reason,
      })
      .eq("id", userId)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    await createModerationLog({
      adminId: ctx.userId,
      actionType: "suspend_user",
      targetType: "profile",
      targetId: userId,
      meta: {
        days: body.days,
        reason: body.reason,
        suspended_until: suspendedUntil,
      },
    });

    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}

import { z } from "zod";
import { requireAdmin, requireAuth } from "@/lib/api/auth";
import { handleRouteError } from "@/lib/api/errors";
import { createModerationLog } from "@/lib/api/moderation";
import { ok } from "@/lib/api/response";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const paramsSchema = z.object({
  userId: z.string().uuid(),
});

export async function PATCH(request: Request, context: { params: Promise<{ userId: string }> }) {
  try {
    const ctx = await requireAuth(request.headers);
    requireAdmin(ctx);

    const { userId } = paramsSchema.parse(await context.params);
    const admin = getSupabaseAdminClient();

    const { data, error } = await admin
      .from("profiles")
      .update({ suspended_until: null, suspend_reason: null })
      .eq("id", userId)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    await createModerationLog({
      adminId: ctx.userId,
      actionType: "restore_user",
      targetType: "profile",
      targetId: userId,
    });

    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}

import { z } from "zod";
import { requireAdmin, requireAuth } from "@/lib/api/auth";
import { handleRouteError } from "@/lib/api/errors";
import { createModerationLog } from "@/lib/api/moderation";
import { safeJson } from "@/lib/api/request";
import { ok } from "@/lib/api/response";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { adminUserRoleSchema } from "@/types/schemas";

const paramsSchema = z.object({
  userId: z.string().uuid(),
});

export async function PATCH(request: Request, context: { params: Promise<{ userId: string }> }) {
  try {
    const ctx = await requireAuth(request.headers);
    requireAdmin(ctx);

    const body = adminUserRoleSchema.parse(await safeJson(request));
    const { userId } = paramsSchema.parse(await context.params);

    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .update({ role: body.role })
      .eq("id", userId)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    await createModerationLog({
      adminId: ctx.userId,
      actionType: "set_role",
      targetType: "profile",
      targetId: userId,
      meta: { role: body.role },
    });

    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}

import { z } from "zod";
import { requireAdmin, requireAuth } from "@/lib/api/auth";
import { handleRouteError } from "@/lib/api/errors";
import { createModerationLog } from "@/lib/api/moderation";
import { safeJson } from "@/lib/api/request";
import { ok } from "@/lib/api/response";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { adminModerationSchema } from "@/types/schemas";

const paramsSchema = z.object({
  postId: z.string().uuid(),
});

export async function PATCH(request: Request, context: { params: Promise<{ postId: string }> }) {
  try {
    const ctx = await requireAuth(request.headers);
    requireAdmin(ctx);

    const { postId } = paramsSchema.parse(await context.params);
    const body = adminModerationSchema.parse(await safeJson(request));

    const admin = getSupabaseAdminClient();
    const updatePayload = {
      status: body.status,
      ...(body.status === "deleted"
        ? {
            deleted_at: new Date().toISOString(),
            deleted_by: ctx.userId,
          }
        : {
            deleted_at: null,
            deleted_by: null,
          }),
    };

    const { data, error } = await admin
      .from("posts")
      .update(updatePayload)
      .eq("id", postId)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    await createModerationLog({
      adminId: ctx.userId,
      actionType: `moderate_post_${body.status}`,
      targetType: "post",
      targetId: postId,
      meta: { reason: body.reason ?? null },
    });

    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}

import { z } from "zod";
import { requireAdmin, requireAuth } from "@/lib/api/auth";
import { handleRouteError } from "@/lib/api/errors";
import { createModerationLog } from "@/lib/api/moderation";
import { safeJson } from "@/lib/api/request";
import { ok } from "@/lib/api/response";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { adminModerationSchema } from "@/types/schemas";

const paramsSchema = z.object({
  commentId: z.string().uuid(),
});

export async function PATCH(request: Request, context: { params: Promise<{ commentId: string }> }) {
  try {
    const ctx = await requireAuth(request.headers);
    requireAdmin(ctx);

    const { commentId } = paramsSchema.parse(await context.params);
    const body = adminModerationSchema.parse(await safeJson(request));

    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from("comments")
      .update({
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
      })
      .eq("id", commentId)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    await createModerationLog({
      adminId: ctx.userId,
      actionType: `moderate_comment_${body.status}`,
      targetType: "comment",
      targetId: commentId,
      meta: { reason: body.reason ?? null },
    });

    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}

import { z } from "zod";
import { requireAdmin, requireAuth } from "@/lib/api/auth";
import { handleRouteError } from "@/lib/api/errors";
import { ok } from "@/lib/api/response";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const paramsSchema = z.object({
  userId: z.string().uuid(),
});

export async function GET(request: Request, context: { params: Promise<{ userId: string }> }) {
  try {
    const ctx = await requireAuth(request.headers);
    requireAdmin(ctx);

    const { userId } = paramsSchema.parse(await context.params);
    const admin = getSupabaseAdminClient();

    const [{ data: posts }, { data: comments }, { data: reports }, { data: moderationActions }] = await Promise.all([
      admin
        .from("posts")
        .select("id,title,status,created_at")
        .eq("author_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
      admin
        .from("comments")
        .select("id,post_id,status,created_at")
        .eq("author_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
      admin
        .from("reports")
        .select("id,target_type,target_id,status,created_at")
        .eq("reporter_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
      admin
        .from("moderation_actions")
        .select("id,action_type,target_type,target_id,created_at,meta")
        .eq("admin_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    return ok({
      posts: posts ?? [],
      comments: comments ?? [],
      reports: reports ?? [],
      moderation_actions: moderationActions ?? [],
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

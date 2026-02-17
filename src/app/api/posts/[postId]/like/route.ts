import { z } from "zod";
import { assertNotSuspended, requireAuth } from "@/lib/api/auth";
import { handleRouteError } from "@/lib/api/errors";
import { fail, ok } from "@/lib/api/response";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const paramsSchema = z.object({
  postId: z.string().uuid(),
});

export async function POST(request: Request, context: { params: Promise<{ postId: string }> }) {
  try {
    const ctx = await requireAuth(request.headers);
    assertNotSuspended(ctx.profile);

    const { postId } = paramsSchema.parse(await context.params);
    const admin = getSupabaseAdminClient();

    const { data: post } = await admin
      .from("posts")
      .select("id,status,deleted_at")
      .eq("id", postId)
      .maybeSingle();

    if (!post || post.deleted_at || post.status !== "published") {
      return fail(404, "Post not found");
    }

    const { data: liked, error: toggleError } = await admin.rpc("toggle_post_like", {
      p_post_id: postId,
      p_user_id: ctx.userId,
    });
    if (toggleError) {
      throw toggleError;
    }

    const { data: updatedPost } = await admin.from("posts").select("like_count").eq("id", postId).single();

    return ok({ liked: Boolean(liked), like_count: updatedPost?.like_count ?? 0 });
  } catch (error) {
    return handleRouteError(error);
  }
}

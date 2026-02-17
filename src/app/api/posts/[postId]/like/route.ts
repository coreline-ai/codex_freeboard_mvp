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

    const { data: existing } = await admin
      .from("post_likes")
      .select("post_id,user_id")
      .eq("post_id", postId)
      .eq("user_id", ctx.userId)
      .maybeSingle();

    let liked = false;

    if (existing) {
      const { error } = await admin
        .from("post_likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", ctx.userId);

      if (error) {
        throw error;
      }

      liked = false;
    } else {
      const { error } = await admin.from("post_likes").insert({ post_id: postId, user_id: ctx.userId });
      if (error) {
        throw error;
      }

      liked = true;
    }

    const { data: updatedPost } = await admin.from("posts").select("like_count").eq("id", postId).single();

    return ok({ liked, like_count: updatedPost?.like_count ?? 0 });
  } catch (error) {
    return handleRouteError(error);
  }
}

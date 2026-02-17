import { z } from "zod";
import { assertNotSuspended, requireAuth } from "@/lib/api/auth";
import { handleRouteError } from "@/lib/api/errors";
import { getRequestIp, hashActorKey } from "@/lib/api/netlify";
import { consumeRateLimit } from "@/lib/api/rate-limit";
import { safeJson } from "@/lib/api/request";
import { fail, ok } from "@/lib/api/response";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { createCommentSchema } from "@/types/schemas";

const paramsSchema = z.object({
  postId: z.string().uuid(),
});

export async function POST(request: Request, context: { params: Promise<{ postId: string }> }) {
  try {
    const ctx = await requireAuth(request.headers);
    assertNotSuspended(ctx.profile);

    const ip = getRequestIp(request.headers);
    const userAllowed = await consumeRateLimit("create_comment", hashActorKey(`user:${ctx.userId}`));
    const ipAllowed = await consumeRateLimit("create_comment", hashActorKey(`ip:${ip}`));

    if (!userAllowed || !ipAllowed) {
      throw new Error("RATE_LIMITED:create_comment");
    }

    const { postId } = paramsSchema.parse(await context.params);
    const body = createCommentSchema.parse(await safeJson(request));

    const admin = getSupabaseAdminClient();

    const { data: post, error: postError } = await admin
      .from("posts")
      .select("id,board_id,status,deleted_at")
      .eq("id", postId)
      .maybeSingle();

    if (postError) {
      throw postError;
    }

    if (!post || post.deleted_at || post.status !== "published") {
      return fail(404, "Post not found");
    }

    const { data: board } = await admin
      .from("boards")
      .select("allow_comment")
      .eq("id", post.board_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!board?.allow_comment) {
      return fail(403, "Comments are disabled for this board");
    }

    if (body.parent_id) {
      const { data: parentComment } = await admin
        .from("comments")
        .select("id,parent_id,post_id,status")
        .eq("id", body.parent_id)
        .maybeSingle();

      if (!parentComment || parentComment.post_id !== postId || parentComment.status !== "published") {
        return fail(400, "Invalid parent comment");
      }

      if (parentComment.parent_id) {
        return fail(400, "Only one level of replies is allowed");
      }
    }

    const { data, error } = await admin
      .from("comments")
      .insert({
        post_id: postId,
        author_id: ctx.userId,
        parent_id: body.parent_id ?? null,
        content: body.content,
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return ok(data, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

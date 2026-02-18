import { z } from "zod";
import { requireAuth } from "@/lib/api/auth";
import { assertBoardWriteAccess, getBoardByIdForWrite } from "@/lib/api/board-access";
import { handleRouteError } from "@/lib/api/errors";
import { safeJson } from "@/lib/api/request";
import { fail, ok } from "@/lib/api/response";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { updateCommentSchema } from "@/types/schemas";

const paramsSchema = z.object({
  commentId: z.string().uuid(),
});

export async function PATCH(request: Request, context: { params: Promise<{ commentId: string }> }) {
  try {
    const ctx = await requireAuth(request.headers);
    const { commentId } = paramsSchema.parse(await context.params);
    const body = updateCommentSchema.parse(await safeJson(request));

    const admin = getSupabaseAdminClient();
    const { data: comment, error: commentError } = await admin
      .from("comments")
      .select("*")
      .eq("id", commentId)
      .is("deleted_at", null)
      .maybeSingle();

    if (commentError) {
      throw commentError;
    }

    if (!comment) {
      return fail(404, "Comment not found");
    }

    const { data: post, error: postError } = await admin
      .from("posts")
      .select("board_id")
      .eq("id", comment.post_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (postError) {
      throw postError;
    }
    if (!post) {
      return fail(404, "Post not found");
    }

    const board = await getBoardByIdForWrite(admin, post.board_id);
    assertBoardWriteAccess({
      board,
      actor: { userId: ctx.userId, isAdmin: ctx.isAdmin },
      action: "comment_write",
    });

    if (comment.author_id !== ctx.userId && !ctx.isAdmin) {
      return fail(403, "Forbidden");
    }

    const { data, error } = await admin
      .from("comments")
      .update({ content: body.content })
      .eq("id", commentId)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ commentId: string }> }) {
  try {
    const ctx = await requireAuth(request.headers);
    const { commentId } = paramsSchema.parse(await context.params);

    const admin = getSupabaseAdminClient();
    const { data: comment, error: commentError } = await admin
      .from("comments")
      .select("*")
      .eq("id", commentId)
      .is("deleted_at", null)
      .maybeSingle();

    if (commentError) {
      throw commentError;
    }

    if (!comment) {
      return fail(404, "Comment not found");
    }

    const { data: post, error: postError } = await admin
      .from("posts")
      .select("board_id")
      .eq("id", comment.post_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (postError) {
      throw postError;
    }
    if (!post) {
      return fail(404, "Post not found");
    }

    const board = await getBoardByIdForWrite(admin, post.board_id);
    assertBoardWriteAccess({
      board,
      actor: { userId: ctx.userId, isAdmin: ctx.isAdmin },
      action: "comment_write",
    });

    if (comment.author_id !== ctx.userId && !ctx.isAdmin) {
      return fail(403, "Forbidden");
    }

    const { error } = await admin
      .from("comments")
      .update({
        status: "deleted",
        deleted_at: new Date().toISOString(),
        deleted_by: ctx.userId,
      })
      .eq("id", commentId);

    if (error) {
      throw error;
    }

    return ok({ id: commentId, deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

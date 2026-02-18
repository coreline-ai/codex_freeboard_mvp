import { z } from "zod";
import { getAuthContext, requireAuth } from "@/lib/api/auth";
import { assertBoardWriteAccess, getBoardByIdForWrite } from "@/lib/api/board-access";
import { handleRouteError } from "@/lib/api/errors";
import { safeJson } from "@/lib/api/request";
import { fail, ok } from "@/lib/api/response";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { updatePostSchema } from "@/types/schemas";

const paramsSchema = z.object({
  postId: z.string().uuid(),
});

export async function GET(request: Request, context: { params: Promise<{ postId: string }> }) {
  try {
    const { postId } = paramsSchema.parse(await context.params);
    const admin = getSupabaseAdminClient();
    const viewer = await getAuthContext(request.headers);

    const { data: post, error } = await admin
      .from("posts")
      .select("*")
      .eq("id", postId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!post) {
      return fail(404, "Post not found");
    }

    const canViewDraftLike = viewer?.isAdmin || viewer?.userId === post.author_id;
    if (post.status !== "published" && !canViewDraftLike) {
      return fail(404, "Post not found");
    }

    const { data: board } = await admin.from("boards").select("*").eq("id", post.board_id).maybeSingle();
    if (!board || board.deleted_at) {
      return fail(404, "Board not found");
    }

    if (!board.is_public && !viewer?.isAdmin && viewer?.userId !== post.author_id) {
      return fail(403, "Private board");
    }

    const { data: author } = await admin
      .from("profiles")
      .select("id,nickname")
      .eq("id", post.author_id)
      .maybeSingle();

    let commentsQuery = admin
      .from("comments")
      .select("*")
      .eq("post_id", postId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (!viewer?.isAdmin) {
      commentsQuery = commentsQuery.eq("status", "published");
    }

    const { data: comments, error: commentsError } = await commentsQuery;
    if (commentsError) {
      throw commentsError;
    }

    const commentAuthorIds = [...new Set((comments ?? []).map((comment) => comment.author_id))];
    const { data: commentAuthors } = commentAuthorIds.length
      ? await admin.from("profiles").select("id,nickname").in("id", commentAuthorIds)
      : { data: [] as Array<{ id: string; nickname: string }> };

    const commentAuthorMap = new Map((commentAuthors ?? []).map((authorItem) => [authorItem.id, authorItem.nickname]));

    const normalizedComments = (comments ?? []).map((comment) => ({
      ...comment,
      author_nickname: commentAuthorMap.get(comment.author_id) ?? "unknown",
    }));

    const roots = normalizedComments.filter((comment) => !comment.parent_id);
    const repliesByParent = new Map<string, typeof normalizedComments>();

    for (const comment of normalizedComments) {
      if (!comment.parent_id) {
        continue;
      }

      const current = repliesByParent.get(comment.parent_id) ?? [];
      current.push(comment);
      repliesByParent.set(comment.parent_id, current);
    }

    const tree = roots.map((rootComment) => ({
      ...rootComment,
      replies: repliesByParent.get(rootComment.id) ?? [],
    }));

    return ok({
      post: {
        ...post,
        author_nickname: author?.nickname ?? "unknown",
      },
      board,
      comments: tree,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ postId: string }> }) {
  try {
    const ctx = await requireAuth(request.headers);
    const { postId } = paramsSchema.parse(await context.params);
    const body = updatePostSchema.parse(await safeJson(request));

    if (!body.title && !body.content) {
      return fail(400, "No fields to update");
    }

    const admin = getSupabaseAdminClient();
    const { data: post, error: postError } = await admin
      .from("posts")
      .select("*")
      .eq("id", postId)
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
      action: "post_write",
    });

    if (post.author_id !== ctx.userId && !ctx.isAdmin) {
      return fail(403, "Forbidden");
    }

    const { data, error } = await admin
      .from("posts")
      .update({
        ...(body.title ? { title: body.title } : {}),
        ...(body.content ? { content: body.content } : {}),
      })
      .eq("id", postId)
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

export async function DELETE(request: Request, context: { params: Promise<{ postId: string }> }) {
  try {
    const ctx = await requireAuth(request.headers);
    const { postId } = paramsSchema.parse(await context.params);

    const admin = getSupabaseAdminClient();
    const { data: post, error: postError } = await admin
      .from("posts")
      .select("*")
      .eq("id", postId)
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
      action: "post_write",
    });

    if (post.author_id !== ctx.userId && !ctx.isAdmin) {
      return fail(403, "Forbidden");
    }

    const { error } = await admin
      .from("posts")
      .update({
        status: "deleted",
        deleted_at: new Date().toISOString(),
        deleted_by: ctx.userId,
      })
      .eq("id", postId);

    if (error) {
      throw error;
    }

    return ok({ id: postId, deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

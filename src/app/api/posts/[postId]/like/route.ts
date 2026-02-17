import { z } from "zod";
import { assertNotSuspended, requireAuth } from "@/lib/api/auth";
import { appError } from "@/lib/api/app-error";
import { assertBoardWriteAccess, getBoardByIdForWrite } from "@/lib/api/board-access";
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

    const board = await getBoardByIdForWrite(admin, post.board_id);
    assertBoardWriteAccess({
      board,
      actor: { userId: ctx.userId, isAdmin: ctx.isAdmin },
      action: "like_post",
    });

    const { data: toggled, error: toggleError } = await admin.rpc("toggle_post_like", {
      p_post_id: postId,
      p_user_id: ctx.userId,
    });

    if (toggleError) {
      throw toggleError;
    }

    const row = Array.isArray(toggled) ? toggled[0] : null;
    if (!row) {
      throw appError("CONFLICT", "Unable to toggle like state");
    }

    return ok({ liked: Boolean(row.liked), like_count: Number(row.like_count ?? 0) });
  } catch (error) {
    return handleRouteError(error);
  }
}

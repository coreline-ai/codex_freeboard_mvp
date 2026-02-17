import { assertNotSuspended, requireAuth } from "@/lib/api/auth";
import { appError } from "@/lib/api/app-error";
import { assertBoardWriteAccess, getBoardByIdForWrite } from "@/lib/api/board-access";
import { handleRouteError } from "@/lib/api/errors";
import { getRequestIp, hashActorKey } from "@/lib/api/netlify";
import { consumeRateLimit } from "@/lib/api/rate-limit";
import { safeJson } from "@/lib/api/request";
import { fail, ok } from "@/lib/api/response";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { createReportSchema } from "@/types/schemas";

export async function POST(request: Request) {
  try {
    const ctx = await requireAuth(request.headers);
    assertNotSuspended(ctx.profile);

    const ip = getRequestIp(request.headers);
    const userAllowed = await consumeRateLimit("report", hashActorKey(`user:${ctx.userId}`));
    const ipAllowed = await consumeRateLimit("report", hashActorKey(`ip:${ip}`));

    if (!userAllowed || !ipAllowed) {
      throw appError("RATE_LIMITED");
    }

    const body = createReportSchema.parse(await safeJson(request));
    const admin = getSupabaseAdminClient();

    if (body.target_type === "post") {
      const { data: post } = await admin
        .from("posts")
        .select("id,board_id,status,deleted_at")
        .eq("id", body.target_id)
        .maybeSingle();

      if (!post || post.deleted_at || post.status === "deleted") {
        return fail(404, "Target post not found");
      }

      const board = await getBoardByIdForWrite(admin, post.board_id);
      assertBoardWriteAccess({
        board,
        actor: { userId: ctx.userId, isAdmin: ctx.isAdmin },
        action: "report",
      });
    } else {
      const { data: comment } = await admin
        .from("comments")
        .select("id,post_id,status,deleted_at")
        .eq("id", body.target_id)
        .maybeSingle();

      if (!comment || comment.deleted_at || comment.status === "deleted") {
        return fail(404, "Target comment not found");
      }

      const { data: post } = await admin
        .from("posts")
        .select("board_id")
        .eq("id", comment.post_id)
        .is("deleted_at", null)
        .maybeSingle();

      if (!post) {
        return fail(404, "Target comment not found");
      }

      const board = await getBoardByIdForWrite(admin, post.board_id);
      assertBoardWriteAccess({
        board,
        actor: { userId: ctx.userId, isAdmin: ctx.isAdmin },
        action: "report",
      });
    }

    const { data, error } = await admin
      .from("reports")
      .insert({
        target_type: body.target_type,
        target_id: body.target_id,
        reporter_id: ctx.userId,
        reason: body.reason,
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

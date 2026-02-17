import { z } from "zod";
import { assertNotSuspended, getAuthContext, requireAuth } from "@/lib/api/auth";
import { handleRouteError } from "@/lib/api/errors";
import { consumeRateLimit } from "@/lib/api/rate-limit";
import { getRequestIp, hashActorKey } from "@/lib/api/netlify";
import { safeJson } from "@/lib/api/request";
import { fail, ok } from "@/lib/api/response";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { createPostSchema } from "@/types/schemas";

const PAGE_SIZE = 20;

const paramsSchema = z.object({
  slug: z.string().min(1),
});

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = paramsSchema.parse(await context.params);
    const admin = getSupabaseAdminClient();
    const viewer = await getAuthContext(request.headers);

    const { searchParams } = new URL(request.url);
    const page = Math.max(Number(searchParams.get("page") ?? 1) || 1, 1);
    const queryText = searchParams.get("q")?.trim() ?? "";

    const { data: board, error: boardError } = await admin
      .from("boards")
      .select("*")
      .eq("slug", slug)
      .is("deleted_at", null)
      .maybeSingle();

    if (boardError) {
      throw boardError;
    }

    if (!board) {
      return fail(404, "Board not found");
    }

    if (!board.is_public && !viewer?.isAdmin) {
      return fail(403, "Private board");
    }

    let query = admin
      .from("posts")
      .select("*", { count: "exact" })
      .eq("board_id", board.id)
      .is("deleted_at", null)
      .eq("status", "published")
      .order("is_notice", { ascending: false })
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    if (queryText) {
      query = query.textSearch("search_tsv", queryText, { type: "websearch", config: "simple" });
    }

    if (viewer?.isAdmin) {
      query = admin
        .from("posts")
        .select("*", { count: "exact" })
        .eq("board_id", board.id)
        .is("deleted_at", null)
        .order("is_notice", { ascending: false })
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      if (queryText) {
        query = query.textSearch("search_tsv", queryText, { type: "websearch", config: "simple" });
      }
    }

    const { data: posts, count, error } = await query;
    if (error) {
      throw error;
    }

    const authorIds = [...new Set((posts ?? []).map((post) => post.author_id))];
    const { data: profiles } = authorIds.length
      ? await admin.from("profiles").select("id,nickname").in("id", authorIds)
      : { data: [] as Array<{ id: string; nickname: string }> };

    const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile.nickname]));

    const rows = (posts ?? []).map((post) => ({
      ...post,
      author_nickname: profileMap.get(post.author_id) ?? "unknown",
    }));

    return ok({
      board,
      posts: rows,
      page,
      pageSize: PAGE_SIZE,
      total: count ?? 0,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const ctx = await requireAuth(request.headers);
    assertNotSuspended(ctx.profile);

    const ip = getRequestIp(request.headers);
    const userAllowed = await consumeRateLimit("create_post", hashActorKey(`user:${ctx.userId}`));
    const ipAllowed = await consumeRateLimit("create_post", hashActorKey(`ip:${ip}`));

    if (!userAllowed || !ipAllowed) {
      throw new Error("RATE_LIMITED:create_post");
    }

    const body = createPostSchema.parse(await safeJson(request));
    const { slug } = paramsSchema.parse(await context.params);

    const admin = getSupabaseAdminClient();
    const { data: board, error: boardError } = await admin
      .from("boards")
      .select("*")
      .eq("slug", slug)
      .is("deleted_at", null)
      .single();

    if (boardError) {
      throw boardError;
    }

    if (!board.allow_post) {
      return fail(403, "Posting is disabled for this board");
    }

    const status = board.require_post_approval ? "pending" : "published";

    const { data, error } = await admin
      .from("posts")
      .insert({
        board_id: board.id,
        author_id: ctx.userId,
        title: body.title,
        content: body.content,
        status,
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

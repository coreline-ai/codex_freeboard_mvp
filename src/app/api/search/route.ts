import { z } from "zod";
import { getAuthContext } from "@/lib/api/auth";
import { handleRouteError } from "@/lib/api/errors";
import { fail, ok } from "@/lib/api/response";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { SearchResponseData, SearchResultItem } from "@/types/domain";

const PAGE_SIZE = 20;

const querySchema = z.object({
  q: z.string().min(2).max(100),
  page: z.number().int().min(1),
});

interface SearchRpcRow {
  post_id: string;
  board_slug: string;
  board_name: string;
  title: string;
  excerpt: string;
  author_nickname: string;
  status: SearchResultItem["status"];
  created_at: string;
  rank: number;
  total_count: number;
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      q: (searchParams.get("q") ?? "").trim(),
      page: Number(searchParams.get("page") ?? 1),
    });

    if (!parsed.success) {
      return fail(400, "Invalid search query");
    }

    const { q, page } = parsed.data;
    const auth = await getAuthContext(request.headers);
    const admin = getSupabaseAdminClient();

    const { data, error } = await admin.rpc("search_posts_fts", {
      p_query: q,
      p_page: page,
      p_page_size: PAGE_SIZE,
      p_is_admin: auth?.isAdmin ?? false,
    });

    if (error) {
      throw error;
    }

    const rows = (data ?? []) as SearchRpcRow[];

    const results: SearchResultItem[] = rows.map((row) => ({
      post_id: row.post_id,
      title: row.title,
      excerpt: stripHtml(row.excerpt || "").slice(0, 240),
      board_slug: row.board_slug,
      board_name: row.board_name,
      author_nickname: row.author_nickname,
      status: row.status,
      created_at: row.created_at,
      rank: row.rank,
    }));

    const payload: SearchResponseData = {
      query: q,
      page,
      pageSize: PAGE_SIZE,
      total: rows.length > 0 ? Number(rows[0].total_count) : 0,
      results,
    };

    return ok(payload);
  } catch (error) {
    return handleRouteError(error);
  }
}

import { requireAdmin, requireAuth } from "@/lib/api/auth";
import { handleRouteError } from "@/lib/api/errors";
import { ok } from "@/lib/api/response";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const PAGE_SIZE = 20;

export async function GET(request: Request) {
  try {
    const ctx = await requireAuth(request.headers);
    requireAdmin(ctx);

    const { searchParams } = new URL(request.url);
    const page = Math.max(Number(searchParams.get("page") ?? 1) || 1, 1);
    const role = searchParams.get("role")?.trim() ?? null;
    const q = searchParams.get("q")?.trim() ?? null;
    const suspended = searchParams.get("suspended")?.trim();

    const admin = getSupabaseAdminClient();
    const { data, error } = await admin.rpc("search_profiles_admin", {
      p_page: page,
      p_page_size: PAGE_SIZE,
      p_role: role,
      p_query: q,
      p_suspended_only: suspended === "true",
    });

    if (error) {
      throw error;
    }

    const rows = (data ?? []) as Array<{
      id: string;
      email: string;
      nickname: string;
      role: "user" | "admin";
      suspended_until: string | null;
      suspend_reason: string | null;
      created_at: string;
      updated_at: string;
      total_count: number;
    }>;

    const total = rows.length > 0 ? Number(rows[0].total_count ?? 0) : 0;

    return ok({
      users: rows.map((row) => ({
        id: row.id,
        email: row.email,
        nickname: row.nickname,
        role: row.role,
        suspended_until: row.suspended_until,
        suspend_reason: row.suspend_reason,
        created_at: row.created_at,
        updated_at: row.updated_at,
      })),
      page,
      pageSize: PAGE_SIZE,
      total,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

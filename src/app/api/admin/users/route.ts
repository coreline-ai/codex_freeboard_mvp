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
    const role = searchParams.get("role")?.trim();
    const q = searchParams.get("q")?.trim();
    const suspended = searchParams.get("suspended")?.trim();

    const admin = getSupabaseAdminClient();

    let query = admin
      .from("profiles")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    if (role === "user" || role === "admin") {
      query = query.eq("role", role);
    }

    if (q) {
      query = query.or(`email.ilike.%${q}%,nickname.ilike.%${q}%`);
    }

    if (suspended === "true") {
      query = query.gt("suspended_until", new Date().toISOString());
    }

    const { data, count, error } = await query;

    if (error) {
      throw error;
    }

    return ok({
      users: data ?? [],
      page,
      pageSize: PAGE_SIZE,
      total: count ?? 0,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

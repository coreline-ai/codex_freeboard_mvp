import { getAuthContext } from "@/lib/api/auth";
import { handleRouteError } from "@/lib/api/errors";
import { ok } from "@/lib/api/response";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const admin = getSupabaseAdminClient();
    const auth = await getAuthContext(request.headers);

    let query = admin
      .from("boards")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (!auth?.isAdmin) {
      query = query.eq("is_public", true);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    return ok(data ?? []);
  } catch (error) {
    return handleRouteError(error);
  }
}

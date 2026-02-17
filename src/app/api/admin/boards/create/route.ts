import { requireAdmin, requireAuth } from "@/lib/api/auth";
import { handleRouteError } from "@/lib/api/errors";
import { safeJson } from "@/lib/api/request";
import { fail, ok } from "@/lib/api/response";
import { toSlug } from "@/lib/api/slug";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { boardCreateSchema } from "@/types/schemas";

export async function POST(request: Request) {
  try {
    const ctx = await requireAuth(request.headers);
    requireAdmin(ctx);

    const body = boardCreateSchema.parse(await safeJson(request));
    const admin = getSupabaseAdminClient();

    const normalizedSlug = toSlug(body.slug);
    if (!normalizedSlug) {
      return fail(400, "Invalid board slug");
    }

    const { data: exists } = await admin.from("boards").select("id").eq("slug", normalizedSlug).maybeSingle();
    if (exists) {
      return fail(409, "Board slug already exists");
    }

    const { data, error } = await admin
      .from("boards")
      .insert({
        slug: normalizedSlug,
        name: body.name,
        description: body.description,
        is_public: body.is_public,
        allow_post: body.allow_post,
        allow_comment: body.allow_comment,
        require_post_approval: body.require_post_approval,
        created_by: ctx.userId,
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

import { requireAdmin, requireAuth } from "@/lib/api/auth";
import { handleRouteError } from "@/lib/api/errors";
import { safeJson } from "@/lib/api/request";
import { fail, ok } from "@/lib/api/response";
import { generateUniqueSlug } from "@/lib/api/slug";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { boardCloneSchema } from "@/types/schemas";

export async function POST(request: Request) {
  try {
    const ctx = await requireAuth(request.headers);
    requireAdmin(ctx);

    const body = boardCloneSchema.parse(await safeJson(request));
    const admin = getSupabaseAdminClient();

    if (!body.template_id && !body.source_board_slug) {
      return fail(400, "template_id or source_board_slug is required");
    }

    let sourceSettings: {
      description: string;
      is_public: boolean;
      allow_post: boolean;
      allow_comment: boolean;
      require_post_approval: boolean;
    } | null = null;

    if (body.template_id) {
      const { data: template, error: templateError } = await admin
        .from("board_templates")
        .select("settings")
        .eq("id", body.template_id)
        .single();

      if (templateError) {
        throw templateError;
      }

      const settings = template.settings ?? {};
      sourceSettings = {
        description: body.description ?? String(settings.description ?? ""),
        is_public: Boolean(settings.is_public ?? true),
        allow_post: Boolean(settings.allow_post ?? true),
        allow_comment: Boolean(settings.allow_comment ?? true),
        require_post_approval: Boolean(settings.require_post_approval ?? false),
      };
    } else if (body.source_board_slug) {
      const { data: sourceBoard, error: sourceError } = await admin
        .from("boards")
        .select("*")
        .eq("slug", body.source_board_slug)
        .is("deleted_at", null)
        .single();

      if (sourceError) {
        throw sourceError;
      }

      sourceSettings = {
        description: body.description ?? sourceBoard.description,
        is_public: sourceBoard.is_public,
        allow_post: sourceBoard.allow_post,
        allow_comment: sourceBoard.allow_comment,
        require_post_approval: sourceBoard.require_post_approval,
      };
    }

    if (!sourceSettings) {
      return fail(400, "Unable to resolve source settings");
    }

    const slug = await generateUniqueSlug(body.new_slug_base, async (candidate) => {
      const { data } = await admin.from("boards").select("id").eq("slug", candidate).maybeSingle();
      return Boolean(data);
    });

    const { data, error } = await admin
      .from("boards")
      .insert({
        slug,
        name: body.new_name,
        description: sourceSettings.description,
        is_public: sourceSettings.is_public,
        allow_post: sourceSettings.allow_post,
        allow_comment: sourceSettings.allow_comment,
        require_post_approval: sourceSettings.require_post_approval,
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

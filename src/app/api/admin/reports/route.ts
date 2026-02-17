import { z } from "zod";
import { requireAdmin, requireAuth } from "@/lib/api/auth";
import { handleRouteError } from "@/lib/api/errors";
import { createModerationLog } from "@/lib/api/moderation";
import { safeJson } from "@/lib/api/request";
import { ok } from "@/lib/api/response";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { adminReportResolveSchema } from "@/types/schemas";

const patchSchema = z.object({
  report_id: z.string().uuid(),
  status: adminReportResolveSchema.shape.status,
});

export async function GET(request: Request) {
  try {
    const ctx = await requireAuth(request.headers);
    requireAdmin(ctx);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status")?.trim();

    const admin = getSupabaseAdminClient();
    let query = admin.from("reports").select("*").order("created_at", { ascending: false }).limit(200);

    if (status === "open" || status === "resolved" || status === "rejected") {
      query = query.eq("status", status);
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

export async function PATCH(request: Request) {
  try {
    const ctx = await requireAuth(request.headers);
    requireAdmin(ctx);

    const body = patchSchema.parse(await safeJson(request));
    const admin = getSupabaseAdminClient();

    const { data, error } = await admin
      .from("reports")
      .update({
        status: body.status,
        resolved_at: new Date().toISOString(),
        resolved_by: ctx.userId,
      })
      .eq("id", body.report_id)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    await createModerationLog({
      adminId: ctx.userId,
      actionType: `report_${body.status}`,
      targetType: "report",
      targetId: body.report_id,
    });

    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}

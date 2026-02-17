import { getSupabaseAdminClient } from "@/lib/supabase/server";

export async function createModerationLog(params: {
  adminId: string;
  actionType: string;
  targetType: string;
  targetId: string;
  meta?: Record<string, unknown>;
}) {
  const admin = getSupabaseAdminClient();
  await admin.from("moderation_actions").insert({
    admin_id: params.adminId,
    action_type: params.actionType,
    target_type: params.targetType,
    target_id: params.targetId,
    meta: params.meta ?? {},
  });
}

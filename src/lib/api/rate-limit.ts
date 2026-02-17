import { getServerEnv } from "@/lib/env";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export type RateLimitAction = "signup" | "login" | "create_post" | "create_comment" | "report";

export async function consumeRateLimit(action: RateLimitAction, actorKey: string) {
  const admin = getSupabaseAdminClient();
  const env = getServerEnv();

  const maxByAction: Record<RateLimitAction, number> = {
    signup: env.rateLimitMaxSignup,
    login: env.rateLimitMaxLogin,
    create_post: env.rateLimitMaxPost,
    create_comment: env.rateLimitMaxComment,
    report: env.rateLimitMaxReport,
  };

  const { data, error } = await admin.rpc("consume_rate_limit", {
    p_action: action,
    p_actor_key: actorKey,
    p_window_seconds: env.rateLimitWindowSeconds,
    p_max: maxByAction[action],
  });

  if (error) {
    throw error;
  }

  return Boolean(data);
}

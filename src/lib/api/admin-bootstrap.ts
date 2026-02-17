import { getServerEnv } from "@/lib/env";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/domain";

const BOOTSTRAP_KEY = "bootstrap_admin_assigned";

export async function maybeBootstrapAdmin(profile: Profile): Promise<Profile> {
  const { adminBootstrapEmail } = getServerEnv();

  if (profile.email.toLowerCase() !== adminBootstrapEmail) {
    return profile;
  }

  const admin = getSupabaseAdminClient();

  const { data: setting } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", BOOTSTRAP_KEY)
    .maybeSingle();

  if (setting?.value?.assigned === true) {
    return profile;
  }

  const { data: updated, error } = await admin
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", profile.id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  await admin.from("app_settings").upsert(
    {
      key: BOOTSTRAP_KEY,
      value: {
        assigned: true,
        assigned_user_id: profile.id,
        assigned_at: new Date().toISOString(),
      },
    },
    { onConflict: "key" },
  );

  return updated as Profile;
}

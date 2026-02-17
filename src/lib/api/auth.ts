import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/domain";
import { maybeBootstrapAdmin } from "@/lib/api/admin-bootstrap";

export interface AuthContext {
  token: string;
  userId: string;
  profile: Profile;
  isAdmin: boolean;
}

function getBearerToken(headers: Headers) {
  const authorization = headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length).trim();
}

async function ensureProfile(userId: string, email: string | null) {
  const admin = getSupabaseAdminClient();

  const { data: existing } = await admin
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (existing) {
    return existing as Profile;
  }

  const fallbackNickname = `user_${userId.replace(/-/g, "").slice(0, 8)}`;
  const { data, error } = await admin
    .from("profiles")
    .insert({
      id: userId,
      email: email ?? `${fallbackNickname}@local.invalid`,
      nickname: fallbackNickname,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as Profile;
}

export async function getAuthContext(headers: Headers): Promise<AuthContext | null> {
  const token = getBearerToken(headers);
  if (!token) {
    return null;
  }

  const server = getSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await server.auth.getUser(token);

  if (error || !user) {
    return null;
  }

  let profile = await ensureProfile(user.id, user.email ?? null);
  profile = await maybeBootstrapAdmin(profile);

  return {
    token,
    userId: user.id,
    profile,
    isAdmin: profile.role === "admin",
  };
}

export async function requireAuth(headers: Headers): Promise<AuthContext> {
  const ctx = await getAuthContext(headers);
  if (!ctx) {
    throw new Error("UNAUTHORIZED");
  }

  return ctx;
}

export function assertNotSuspended(profile: Profile) {
  if (!profile.suspended_until) {
    return;
  }

  const suspendedUntil = new Date(profile.suspended_until);
  if (suspendedUntil.getTime() > Date.now()) {
    throw new Error("SUSPENDED");
  }
}

export function requireAdmin(ctx: AuthContext) {
  if (!ctx.isAdmin) {
    throw new Error("FORBIDDEN");
  }
}

const requiredServerEnv = ["SUPABASE_SERVICE_ROLE_KEY", "ADMIN_BOOTSTRAP_EMAIL"] as const;
const requiredPublicEnv = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] as const;

function envNumber(key: string, fallback: number) {
  const raw = process.env[key];
  const parsed = Number(raw ?? fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

export function assertEnv() {
  for (const key of requiredPublicEnv) {
    if (!process.env[key]) {
      throw new Error(`Missing required env: ${key}`);
    }
  }

  for (const key of requiredServerEnv) {
    if (!process.env[key]) {
      throw new Error(`Missing required env: ${key}`);
    }
  }
}

export function getPublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase public env is missing");
  }

  return { url, anonKey };
}

export function getServerEnv() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adminBootstrapEmail = process.env.ADMIN_BOOTSTRAP_EMAIL;

  if (!serviceRoleKey || !adminBootstrapEmail) {
    throw new Error("Supabase server env is missing");
  }

  return {
    serviceRoleKey,
    adminBootstrapEmail: adminBootstrapEmail.toLowerCase().trim(),
    rateLimitWindowSeconds: envNumber("RATE_LIMIT_WINDOW_SECONDS", 60),
    rateLimitMaxSignup: envNumber("RATE_LIMIT_MAX_SIGNUP", 5),
    rateLimitMaxLogin: envNumber("RATE_LIMIT_MAX_LOGIN", 10),
    rateLimitMaxPost: envNumber("RATE_LIMIT_MAX_POST", 10),
    rateLimitMaxComment: envNumber("RATE_LIMIT_MAX_COMMENT", 20),
    rateLimitMaxReport: envNumber("RATE_LIMIT_MAX_REPORT", 10),
  };
}

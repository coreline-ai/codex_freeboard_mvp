import { z } from "zod";
import { handleRouteError } from "@/lib/api/errors";
import { getRequestIp, hashActorKey } from "@/lib/api/netlify";
import { consumeRateLimit } from "@/lib/api/rate-limit";
import { safeJson } from "@/lib/api/request";
import { fail, ok } from "@/lib/api/response";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  try {
    const body = loginSchema.parse(await safeJson(request));
    const ip = getRequestIp(request.headers);

    const ipAllowed = await consumeRateLimit("login", hashActorKey(`ip:${ip}`));
    const emailAllowed = await consumeRateLimit("login", hashActorKey(`email:${body.email.toLowerCase()}`));

    if (!ipAllowed || !emailAllowed) {
      throw new Error("RATE_LIMITED:login");
    }

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    });

    if (error) {
      return fail(400, error.message);
    }

    return ok({
      user: data.user,
      session: data.session,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

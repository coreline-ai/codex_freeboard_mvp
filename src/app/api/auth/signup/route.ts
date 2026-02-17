import { z } from "zod";
import { appError } from "@/lib/api/app-error";
import { handleRouteError } from "@/lib/api/errors";
import { getRequestIp, hashActorKey } from "@/lib/api/netlify";
import { consumeRateLimit } from "@/lib/api/rate-limit";
import { safeJson } from "@/lib/api/request";
import { fail, ok } from "@/lib/api/response";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  nickname: z.string().min(2).max(40).regex(/^[a-zA-Z0-9_]+$/),
});

export async function POST(request: Request) {
  try {
    const body = signupSchema.parse(await safeJson(request));
    const ip = getRequestIp(request.headers);

    const ipAllowed = await consumeRateLimit("signup", hashActorKey(`ip:${ip}`));
    const emailAllowed = await consumeRateLimit("signup", hashActorKey(`email:${body.email.toLowerCase()}`));

    if (!ipAllowed || !emailAllowed) {
      throw appError("RATE_LIMITED");
    }

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email: body.email,
      password: body.password,
      options: {
        data: {
          nickname: body.nickname,
        },
      },
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

import { assertEnv } from "@/lib/env";
import { fail, ok } from "@/lib/api/response";

export async function GET() {
  try {
    assertEnv();
    return ok({ status: "ok", timestamp: new Date().toISOString() });
  } catch (error) {
    return fail(500, "Environment configuration invalid", error);
  }
}

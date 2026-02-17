import { fail } from "@/lib/api/response";

export function handleRouteError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "UNAUTHORIZED") {
      return fail(401, "Unauthorized");
    }

    if (error.message === "FORBIDDEN") {
      return fail(403, "Forbidden");
    }

    if (error.message === "SUSPENDED") {
      return fail(403, "Account is suspended");
    }

    if (error.message.startsWith("RATE_LIMITED")) {
      return fail(429, "Too many requests");
    }

    return fail(400, error.message);
  }

  return fail(500, "Internal server error");
}

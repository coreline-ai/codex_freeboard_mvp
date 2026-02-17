import { fail } from "@/lib/api/response";
import { AppError, isAppError } from "@/lib/api/app-error";
import { ZodError } from "zod";

function mapLegacyError(error: Error): AppError | null {
  if (error.message === "UNAUTHORIZED") {
    return new AppError("UNAUTHORIZED");
  }

  if (error.message === "FORBIDDEN") {
    return new AppError("FORBIDDEN");
  }

  if (error.message === "SUSPENDED") {
    return new AppError("SUSPENDED");
  }

  if (error.message.startsWith("RATE_LIMITED")) {
    return new AppError("RATE_LIMITED");
  }

  if (error.message === "Invalid JSON body") {
    return new AppError("VALIDATION_ERROR", "Invalid JSON body");
  }

  if (error.message === "Invalid slug base") {
    return new AppError("VALIDATION_ERROR", "Invalid slug base");
  }

  if (error.message === "Unable to generate unique slug") {
    return new AppError("CONFLICT", "Unable to generate unique slug");
  }

  return null;
}

export function handleRouteError(error: unknown) {
  if (isAppError(error)) {
    return fail(error.status, error.message, error.details);
  }

  if (error instanceof ZodError) {
    return fail(400, "Invalid request payload", { issues: error.issues });
  }

  if (error instanceof Error) {
    const legacy = mapLegacyError(error);
    if (legacy) {
      return fail(legacy.status, legacy.message, legacy.details);
    }

    console.error("[handleRouteError] Unknown error", error);
    return fail(500, "Internal server error");
  }

  console.error("[handleRouteError] Non-error throwable", error);
  return fail(500, "Internal server error");
}

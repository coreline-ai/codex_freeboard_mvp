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

interface PostgrestLikeError {
  code: string;
  message: string;
  details?: string | null;
  hint?: string | null;
}

function isPostgrestLikeError(error: unknown): error is PostgrestLikeError {
  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as Record<string, unknown>;
  return typeof record.code === "string" && typeof record.message === "string";
}

function mapPostgrestLikeError(error: PostgrestLikeError): AppError {
  // PostgREST single()/maybeSingle() miss or multi row mismatch
  if (error.code === "PGRST116") {
    return new AppError("NOT_FOUND", "Resource not found");
  }

  // invalid input syntax (e.g. malformed uuid)
  if (error.code === "22P02") {
    return new AppError("VALIDATION_ERROR", "Invalid request payload");
  }

  // unique violation
  if (error.code === "23505") {
    return new AppError("CONFLICT", "Conflict");
  }

  // permission denied
  if (error.code === "42501") {
    return new AppError("FORBIDDEN", "Forbidden");
  }

  return new AppError("CONFLICT", "Database operation failed");
}

export function handleRouteError(error: unknown) {
  if (isAppError(error)) {
    return fail(error.status, error.message, error.details);
  }

  if (error instanceof ZodError) {
    return fail(400, "Invalid request payload", { issues: error.issues });
  }

  if (isPostgrestLikeError(error)) {
    const mapped = mapPostgrestLikeError(error);
    return fail(mapped.status, mapped.message);
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

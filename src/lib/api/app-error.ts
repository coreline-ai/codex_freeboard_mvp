export type AppErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "SUSPENDED"
  | "RATE_LIMITED"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT";

const STATUS_BY_CODE: Record<AppErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  SUSPENDED: 403,
  RATE_LIMITED: 429,
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
};

const DEFAULT_MESSAGE_BY_CODE: Record<AppErrorCode, string> = {
  UNAUTHORIZED: "Unauthorized",
  FORBIDDEN: "Forbidden",
  SUSPENDED: "Account is suspended",
  RATE_LIMITED: "Too many requests",
  VALIDATION_ERROR: "Invalid request payload",
  NOT_FOUND: "Resource not found",
  CONFLICT: "Conflict",
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: AppErrorCode, message?: string, details?: unknown) {
    super(message ?? DEFAULT_MESSAGE_BY_CODE[code]);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = details;
  }
}

export function appError(code: AppErrorCode, message?: string, details?: unknown) {
  return new AppError(code, message, details);
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

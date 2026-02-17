import { appError } from "@/lib/api/app-error";

export async function safeJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw appError("VALIDATION_ERROR", "Invalid JSON body");
  }
}

import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AppError } from "@/lib/api/app-error";
import { handleRouteError } from "@/lib/api/errors";

describe("handleRouteError", () => {
  it("returns app error status/message for known errors", async () => {
    const response = handleRouteError(new AppError("FORBIDDEN", "Forbidden"));
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.ok).toBe(false);
    expect(payload.error.message).toBe("Forbidden");
  });

  it("maps zod errors to 400", async () => {
    const schema = z.object({ name: z.string().min(2) });
    const parsed = schema.safeParse({ name: "a" });
    if (parsed.success) {
      throw new Error("Expected parse failure");
    }

    const response = handleRouteError(parsed.error);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error.message).toBe("Invalid request payload");
  });

  it("hides unknown error details behind 500", async () => {
    const logger = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = handleRouteError(new Error("database exploded"));
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.ok).toBe(false);
    expect(payload.error.message).toBe("Internal server error");
    expect(logger).toHaveBeenCalled();
    logger.mockRestore();
  });
});

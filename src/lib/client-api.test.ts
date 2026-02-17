import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, publicApiFetch } from "@/lib/client-api";

const getSessionMock = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => ({
    auth: {
      getSession: getSessionMock,
    },
  }),
}));

describe("publicApiFetch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    getSessionMock.mockResolvedValue({
      data: {
        session: null,
      },
    });
  });

  it("returns success payload from API envelope", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: { value: 1 } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await publicApiFetch<{ value: number }>("/api/example");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.value).toBe(1);
    }
  });

  it("normalizes non-json error responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("gateway error", {
        status: 502,
      }),
    );

    const result = await publicApiFetch("/api/example");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe("HTTP 502");
      expect(result.error.details).toBe("gateway error");
    }
  });

  it("normalizes network failures", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));

    const result = await publicApiFetch("/api/example");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe("Network request failed");
    }
  });
});

describe("apiFetch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(globalThis, "window", {
      value: {},
      writable: true,
      configurable: true,
    });
  });

  it("attaches bearer token when session exists", async () => {
    getSessionMock.mockResolvedValue({
      data: {
        session: {
          access_token: "token-123",
        },
      },
    });

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: { done: true } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await apiFetch<{ done: boolean }>("/api/auth-required", {
      method: "POST",
      body: JSON.stringify({ foo: "bar" }),
    });

    expect(result.ok).toBe(true);
    const [, init] = fetchSpy.mock.calls[0] ?? [];
    const headers = init?.headers as Headers;
    expect(headers.get("authorization")).toBe("Bearer token-123");
  });
});

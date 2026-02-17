import { beforeEach, describe, expect, it, vi } from "vitest";
import { consumeRateLimit } from "@/lib/api/rate-limit";

const rpcMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdminClient: () => ({
    rpc: rpcMock,
  }),
}));

vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({
    serviceRoleKey: "service-role",
    adminBootstrapEmail: "admin@local.test",
    rateLimitWindowSeconds: 60,
    rateLimitMaxSignup: 5,
    rateLimitMaxLogin: 11,
    rateLimitMaxPost: 10,
    rateLimitMaxComment: 20,
    rateLimitMaxReport: 10,
  }),
}));

describe("consumeRateLimit", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ data: true, error: null });
  });

  it("uses RATE_LIMIT_MAX_LOGIN for login action", async () => {
    await consumeRateLimit("login", "actor-key");

    expect(rpcMock).toHaveBeenCalledWith("consume_rate_limit", {
      p_action: "login",
      p_actor_key: "actor-key",
      p_window_seconds: 60,
      p_max: 11,
    });
  });
});

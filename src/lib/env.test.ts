import { afterEach, describe, expect, it } from "vitest";
import { getServerEnv } from "@/lib/env";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

function setBaseRequiredEnv() {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
  process.env.ADMIN_BOOTSTRAP_EMAIL = "admin@local.test";
}

describe("getServerEnv", () => {
  it("uses explicit RATE_LIMIT_MAX_LOGIN when set", () => {
    setBaseRequiredEnv();
    process.env.RATE_LIMIT_MAX_SIGNUP = "5";
    process.env.RATE_LIMIT_MAX_LOGIN = "13";

    const env = getServerEnv();
    expect(env.rateLimitMaxSignup).toBe(5);
    expect(env.rateLimitMaxLogin).toBe(13);
  });

  it("falls back to signup limit when login limit is missing", () => {
    setBaseRequiredEnv();
    process.env.RATE_LIMIT_MAX_SIGNUP = "7";
    delete process.env.RATE_LIMIT_MAX_LOGIN;

    const env = getServerEnv();
    expect(env.rateLimitMaxSignup).toBe(7);
    expect(env.rateLimitMaxLogin).toBe(7);
  });
});

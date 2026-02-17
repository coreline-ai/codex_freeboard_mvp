import { describe, expect, it } from "vitest";
import { getRequestIp, hashActorKey } from "@/lib/api/netlify";

describe("getRequestIp", () => {
  it("prefers netlify header", () => {
    const headers = new Headers({
      "x-nf-client-connection-ip": "1.1.1.1",
      "x-forwarded-for": "2.2.2.2",
    });

    expect(getRequestIp(headers)).toBe("1.1.1.1");
  });

  it("falls back to x-forwarded-for first ip", () => {
    const headers = new Headers({
      "x-forwarded-for": "2.2.2.2, 3.3.3.3",
    });

    expect(getRequestIp(headers)).toBe("2.2.2.2");
  });
});

describe("hashActorKey", () => {
  it("returns deterministic hash", () => {
    expect(hashActorKey("abc")).toBe(hashActorKey("abc"));
    expect(hashActorKey("abc")).not.toBe(hashActorKey("abcd"));
  });
});

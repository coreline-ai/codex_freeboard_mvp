import { describe, expect, it } from "vitest";
import { generateUniqueSlug, toSlug } from "@/lib/api/slug";

describe("toSlug", () => {
  it("normalizes text", () => {
    expect(toSlug("  Hello World !! ")).toBe("hello-world");
  });

  it("trims duplicate separators", () => {
    expect(toSlug("__A__B__")).toBe("a-b");
  });
});

describe("generateUniqueSlug", () => {
  it("returns base slug if available", async () => {
    const slug = await generateUniqueSlug("free board", async () => false);
    expect(slug).toBe("free-board");
  });

  it("appends numeric suffix", async () => {
    const existing = new Set(["free-board", "free-board-2"]);
    const slug = await generateUniqueSlug("free board", async (candidate) => existing.has(candidate));
    expect(slug).toBe("free-board-3");
  });
});

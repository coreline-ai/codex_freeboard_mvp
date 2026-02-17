import { describe, expect, it } from "vitest";
import { buildAdminUserSearchFilter, sanitizeAdminSearchTerm } from "@/lib/api/admin-search";

describe("sanitizeAdminSearchTerm", () => {
  it("returns empty for blank values", () => {
    expect(sanitizeAdminSearchTerm("   ")).toBe("");
    expect(sanitizeAdminSearchTerm(undefined)).toBe("");
  });

  it("removes filter control characters", () => {
    expect(sanitizeAdminSearchTerm("a,b(c)d'e\"f;g`h")).toBe("a b c d e f g h");
  });

  it("escapes wildcard characters", () => {
    expect(sanitizeAdminSearchTerm("100%_user")).toBe("100\\%\\_user");
  });
});

describe("buildAdminUserSearchFilter", () => {
  it("builds a safe or filter", () => {
    expect(buildAdminUserSearchFilter("admin@test.com")).toBe(
      "email.ilike.%admin@test.com%,nickname.ilike.%admin@test.com%",
    );
  });

  it("returns null for invalid/empty input", () => {
    expect(buildAdminUserSearchFilter("   ")).toBeNull();
  });
});

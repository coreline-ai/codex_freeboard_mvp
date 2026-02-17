import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/api/app-error";
import { assertBoardWriteAccess, type BoardAccessRow } from "@/lib/api/board-access";

function makeBoard(overrides?: Partial<BoardAccessRow>): BoardAccessRow {
  return {
    id: "board-id",
    slug: "board",
    is_public: true,
    allow_post: true,
    allow_comment: true,
    require_post_approval: false,
    deleted_at: null,
    ...overrides,
  };
}

describe("assertBoardWriteAccess", () => {
  it("blocks non-admin write actions on private boards", () => {
    expect(() =>
      assertBoardWriteAccess({
        board: makeBoard({ is_public: false }),
        actor: { userId: "user-id", isAdmin: false },
        action: "create_post",
      }),
    ).toThrow(AppError);
  });

  it("allows admin write actions on private boards", () => {
    expect(() =>
      assertBoardWriteAccess({
        board: makeBoard({ is_public: false }),
        actor: { userId: "admin-id", isAdmin: true },
        action: "create_post",
      }),
    ).not.toThrow();
  });

  it("blocks post creation when allow_post is false", () => {
    expect(() =>
      assertBoardWriteAccess({
        board: makeBoard({ allow_post: false }),
        actor: { userId: "admin-id", isAdmin: true },
        action: "create_post",
      }),
    ).toThrow(AppError);
  });

  it("blocks comment creation when allow_comment is false", () => {
    expect(() =>
      assertBoardWriteAccess({
        board: makeBoard({ allow_comment: false }),
        actor: { userId: "admin-id", isAdmin: true },
        action: "create_comment",
      }),
    ).toThrow(AppError);
  });
});

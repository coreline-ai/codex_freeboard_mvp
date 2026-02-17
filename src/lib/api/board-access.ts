import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { appError } from "@/lib/api/app-error";

export type BoardWriteAction = "create_post" | "create_comment" | "like_post" | "report";

export interface BoardWriteActor {
  userId: string;
  isAdmin: boolean;
}

export interface BoardAccessRow {
  id: string;
  slug: string;
  is_public: boolean;
  allow_post: boolean;
  allow_comment: boolean;
  require_post_approval: boolean;
  deleted_at: string | null;
}

function throwBoardSelectError(error: PostgrestError | null) {
  if (!error) {
    return;
  }

  throw appError("NOT_FOUND", "Board not found");
}

export async function getBoardBySlugForWrite(
  admin: SupabaseClient,
  slug: string,
): Promise<BoardAccessRow> {
  const { data, error } = await admin
    .from("boards")
    .select("id,slug,is_public,allow_post,allow_comment,require_post_approval,deleted_at")
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();

  throwBoardSelectError(error);

  if (!data) {
    throw appError("NOT_FOUND", "Board not found");
  }

  return data as BoardAccessRow;
}

export async function getBoardByIdForWrite(admin: SupabaseClient, boardId: string): Promise<BoardAccessRow> {
  const { data, error } = await admin
    .from("boards")
    .select("id,slug,is_public,allow_post,allow_comment,require_post_approval,deleted_at")
    .eq("id", boardId)
    .is("deleted_at", null)
    .maybeSingle();

  throwBoardSelectError(error);

  if (!data) {
    throw appError("NOT_FOUND", "Board not found");
  }

  return data as BoardAccessRow;
}

export function assertBoardWriteAccess(params: {
  board: BoardAccessRow;
  actor: BoardWriteActor;
  action: BoardWriteAction;
}) {
  const { board, actor, action } = params;

  if (board.deleted_at) {
    throw appError("NOT_FOUND", "Board not found");
  }

  if (!board.is_public && !actor.isAdmin) {
    throw appError("FORBIDDEN", "Private board write actions are admin-only");
  }

  if (action === "create_post" && !board.allow_post) {
    throw appError("FORBIDDEN", "Posting is disabled for this board");
  }

  if (action === "create_comment" && !board.allow_comment) {
    throw appError("FORBIDDEN", "Comments are disabled for this board");
  }
}

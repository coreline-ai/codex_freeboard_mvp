export type UserRole = "user" | "admin";

export type PostStatus = "published" | "hidden" | "pending" | "deleted";
export type CommentStatus = "published" | "hidden" | "deleted";
export type ReportStatus = "open" | "resolved" | "rejected";

export interface Profile {
  id: string;
  email: string;
  nickname: string;
  role: UserRole;
  suspended_until: string | null;
  suspend_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface Board {
  id: string;
  slug: string;
  name: string;
  description: string;
  is_public: boolean;
  allow_post: boolean;
  allow_comment: boolean;
  require_post_approval: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Post {
  id: string;
  board_id: string;
  author_id: string;
  title: string;
  content: string;
  status: PostStatus;
  is_notice: boolean;
  is_pinned: boolean;
  like_count: number;
  comment_count: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
}

export interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  parent_id: string | null;
  content: string;
  status: CommentStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
}

export interface Report {
  id: string;
  target_type: "post" | "comment";
  target_id: string;
  reporter_id: string;
  reason: string;
  status: ReportStatus;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

export interface SearchResultItem {
  post_id: string;
  title: string;
  excerpt: string;
  board_slug: string;
  board_name: string;
  author_nickname: string;
  status: PostStatus;
  created_at: string;
  rank: number;
}

export interface SearchResponseData {
  query: string;
  page: number;
  pageSize: number;
  total: number;
  results: SearchResultItem[];
}

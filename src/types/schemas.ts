import { z } from "zod";

export const boardCreateSchema = z.object({
  slug: z.string().min(2).max(60),
  name: z.string().min(1).max(100),
  description: z.string().max(1000).default(""),
  is_public: z.boolean().default(true),
  allow_post: z.boolean().default(true),
  allow_comment: z.boolean().default(true),
  require_post_approval: z.boolean().default(false),
});

export const boardCloneSchema = z.object({
  template_id: z.string().uuid().optional(),
  source_board_slug: z.string().min(2).max(60).optional(),
  new_slug_base: z.string().min(2).max(60),
  new_name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
});

export const createPostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(20000),
});

export const updatePostSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(20000).optional(),
});

export const createCommentSchema = z.object({
  content: z.string().min(1).max(5000),
  parent_id: z.string().uuid().nullable().optional(),
});

export const updateCommentSchema = z.object({
  content: z.string().min(1).max(5000),
});

export const createReportSchema = z.object({
  target_type: z.enum(["post", "comment"]),
  target_id: z.string().uuid(),
  reason: z.string().min(3).max(2000),
});

export const adminUserRoleSchema = z.object({
  role: z.enum(["user", "admin"]),
});

export const adminUserSuspendSchema = z.object({
  days: z.number().int().min(1).max(3650),
  reason: z.string().min(2).max(1000),
});

export const adminModerationSchema = z.object({
  status: z.enum(["published", "hidden", "deleted"]),
  reason: z.string().max(1000).optional(),
});

export const adminReportResolveSchema = z.object({
  status: z.enum(["resolved", "rejected"]),
});

export const profileUpdateSchema = z.object({
  nickname: z.string().min(2).max(40).regex(/^[a-zA-Z0-9_]+$/),
});

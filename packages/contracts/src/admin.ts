import { z } from "zod";
import { curriculumSchema, profileOptionSchema } from "./catalog";
import { userRoles } from "./common";

export const adminAttentionSummarySchema = z.object({
  drafts: z.number().int().nonnegative(),
  reports: z.number().int().nonnegative(),
  feedback: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

export type AdminAttentionSummary = z.infer<typeof adminAttentionSummarySchema>;

export const adminUserSummarySchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string(),
  studentCode: z.string().nullable(),
  campus: profileOptionSchema.nullable(),
  major: profileOptionSchema.nullable(),
  curriculum: curriculumSchema.nullable(),
  role: z.enum(userRoles),
  isActive: z.boolean(),
  attemptsCount: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type AdminUserSummary = z.infer<typeof adminUserSummarySchema>;

export const adminUserFilterSchema = z.object({
  search: z.string().optional(),
  role: z
    .enum(["all", ...userRoles])
    .optional()
    .default("all"),
  campusCode: z.string().optional(),
  status: z.enum(["all", "active", "disabled"]).optional().default("all"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type AdminUserFilter = z.infer<typeof adminUserFilterSchema>;

export const adminUserListResponseSchema = z.object({
  items: z.array(adminUserSummarySchema),
  pagination: z.object({
    page: z.number().int().min(1),
    limit: z.number().int().min(1),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  }),
  stats: z.object({
    totalUsers: z.number().int().nonnegative(),
    totalContributors: z.number().int().nonnegative(),
    totalAdmins: z.number().int().nonnegative(),
    totalDisabled: z.number().int().nonnegative(),
  }),
});

export type AdminUserListResponse = z.infer<typeof adminUserListResponseSchema>;

export const updateUserRoleInputSchema = z.object({
  role: z.enum(userRoles),
});

export type UpdateUserRoleInput = z.infer<typeof updateUserRoleInputSchema>;

export const updateUserStatusInputSchema = z.object({
  isActive: z.boolean(),
});

export type UpdateUserStatusInput = z.infer<typeof updateUserStatusInputSchema>;

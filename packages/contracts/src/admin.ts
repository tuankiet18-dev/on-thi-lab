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

// ── Admin Dashboard ──────────────────────────────────────────────────────────

export const adminDashboardDaysSchema = z.coerce
  .number()
  .int()
  .refine((n) => [7, 30, 90].includes(n), {
    message: "days must be 7, 30 or 90",
  })
  .default(30);

export type AdminDashboardDays = z.infer<typeof adminDashboardDaysSchema>;

/** Quick-stats row shown at the top of the dashboard */
export const adminDashboardQuickStatsSchema = z.object({
  /** Exams in "review" status (pending review/publish) */
  pendingReview: z.number().int().nonnegative(),
  /** Open (unresolved) error reports */
  openReports: z.number().int().nonnegative(),
  /** Feedback items still in "new" state */
  newFeedback: z.number().int().nonnegative(),
  /** Total published exams */
  publishedExams: z.number().int().nonnegative(),
  /** Completed attempts within the window (status submitted or auto_submitted) */
  completedAttempts: z.number().int().nonnegative(),
  /** Distinct users who started at least one attempt within the window */
  activeUsers: z.number().int().nonnegative(),
});

export type AdminDashboardQuickStats = z.infer<
  typeof adminDashboardQuickStatsSchema
>;

/** A single item in the "action required" list */
export const adminDashboardActionItemSchema = z.object({
  type: z.enum(["missing_answers", "ocr_warning", "pending_publish"]),
  examId: z.string().uuid(),
  examCode: z.string(),
  /** Short human-readable description of the issue */
  detail: z.string(),
});

export type AdminDashboardActionItem = z.infer<
  typeof adminDashboardActionItemSchema
>;

/** One data-point in the daily usage chart */
export const adminDashboardUsagePointSchema = z.object({
  date: z.string(), // ISO date "YYYY-MM-DD"
  started: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  newUsers: z.number().int().nonnegative(),
});

export type AdminDashboardUsagePoint = z.infer<
  typeof adminDashboardUsagePointSchema
>;

/** Content-quality breakdown */
export const adminDashboardContentQualitySchema = z.object({
  /** Error-report counts grouped by category */
  reportsByCategory: z.array(
    z.object({
      category: z.string(),
      count: z.number().int().nonnegative(),
    }),
  ),
  /** Top exams by attempt count within the window (max 5) */
  topExams: z.array(
    z.object({
      examId: z.string().uuid(),
      examCode: z.string(),
      attempts: z.number().int().nonnegative(),
    }),
  ),
  /** Published exams that received zero attempts within the window */
  unpopularExams: z.array(
    z.object({
      examId: z.string().uuid(),
      examCode: z.string(),
      publishedAt: z.string(),
    }),
  ),
});

export type AdminDashboardContentQuality = z.infer<
  typeof adminDashboardContentQualitySchema
>;

/** Full dashboard response */
export const adminDashboardSchema = z.object({
  asOf: z.string(), // ISO datetime
  days: adminDashboardDaysSchema,
  quickStats: adminDashboardQuickStatsSchema,
  /** Up to 5 action items sorted by priority */
  actionItems: z.array(adminDashboardActionItemSchema).max(5),
  usageTrend: z.array(adminDashboardUsagePointSchema),
  contentQuality: adminDashboardContentQualitySchema,
});

export type AdminDashboard = z.infer<typeof adminDashboardSchema>;

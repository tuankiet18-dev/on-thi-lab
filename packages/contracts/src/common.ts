export const examTypes = ["FE", "PE"] as const;
export const questionTypes = ["single", "multiple"] as const;
export const reportStatuses = [
  "open",
  "reviewing",
  "resolved",
  "rejected",
] as const;
export const aiSuggestionStatuses = [
  "queued",
  "processing",
  "suggested",
  "failed",
  "confirmed",
] as const;
export const attemptStatuses = [
  "in_progress",
  "submitted",
  "auto_submitted",
  "cancelled",
] as const;
export const examStatuses = [
  "draft",
  "review",
  "published",
  "cancelled",
] as const;
export const userRoles = ["user", "contributor", "admin"] as const;

export type ReportStatus = (typeof reportStatuses)[number];
export type AttemptStatus = (typeof attemptStatuses)[number];
export type QuestionType = (typeof questionTypes)[number];
export type AiSuggestionStatus = (typeof aiSuggestionStatuses)[number];
export type UserRole = (typeof userRoles)[number];

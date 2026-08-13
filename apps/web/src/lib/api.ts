/**
 * Compatibility facade for the web API client.
 *
 * New code should import from the owning feature (for example
 * `features/attempts/api`). Existing screens may keep importing this file while
 * modules are migrated incrementally.
 */
export { ApiError, ApiResponseValidationError } from "../api/http";
export * from "../features/admin/api";
export * from "../features/attempts/api";
export * from "../features/bookmarks/api";
export * from "../features/catalog/api";
export * from "../features/exam-review/api";
export * from "../features/feedback/api";
export * from "../features/ocr/api";
export * from "../features/profiles/api";
export * from "../features/reports/api";

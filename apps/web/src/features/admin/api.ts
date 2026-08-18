import {
  adminAttentionSummarySchema,
  adminCatalogSchema,
  adminExamSummarySchema,
  adminUserListResponseSchema,
  studentProfileSchema,
  type AdminAttentionSummary,
  type AdminCatalog,
  type AdminExamSummary,
  type AdminUserFilter,
  type AdminUserListResponse,
  type CreateCourseInput,
  type CreateCurriculumInput,
  type CreateMajorInput,
  type StudentProfile,
  type UpdateCourseInput,
  type UpsertCurriculumCourseInput,
  type UserRole,
} from "@onthilab/contracts";
import { apiRequest } from "../../api/http";

export async function getAdminUsers(
  filter: Partial<AdminUserFilter>,
  token: string,
  fetcher = fetch,
): Promise<AdminUserListResponse> {
  const params = new URLSearchParams();
  if (filter.search) params.set("search", filter.search);
  if (filter.role && filter.role !== "all") params.set("role", filter.role);
  if (filter.campusCode && filter.campusCode !== "all")
    params.set("campusCode", filter.campusCode);
  if (filter.status && filter.status !== "all")
    params.set("status", filter.status);
  if (filter.page) params.set("page", String(filter.page));
  if (filter.limit) params.set("limit", String(filter.limit));

  const queryString = params.toString() ? `?${params.toString()}` : "";
  const result = await apiRequest(
    `/v1/admin/users${queryString}`,
    token,
    undefined,
    fetcher,
  );
  return adminUserListResponseSchema.parse(result);
}

export async function searchUsers(
  query: string,
  token: string,
  fetcher = fetch,
): Promise<StudentProfile[]> {
  const result = await apiRequest(
    `/v1/admin/users/search?q=${encodeURIComponent(query)}`,
    token,
    undefined,
    fetcher,
  );
  if (!Array.isArray(result)) return [];
  return result.map((profile) => studentProfileSchema.parse(profile));
}

export async function updateRole(
  userId: string,
  role: UserRole,
  token: string,
  fetcher = fetch,
): Promise<void> {
  await apiRequest(
    `/v1/admin/users/${encodeURIComponent(userId)}/role`,
    token,
    { method: "POST", body: JSON.stringify({ role }) },
    fetcher,
  );
}

export async function updateUserStatus(
  userId: string,
  isActive: boolean,
  token: string,
  fetcher = fetch,
): Promise<void> {
  await apiRequest(
    `/v1/admin/users/${encodeURIComponent(userId)}/status`,
    token,
    { method: "POST", body: JSON.stringify({ isActive }) },
    fetcher,
  );
}

export async function getDraftExams(
  idToken: string,
  fetcher: typeof fetch = fetch,
): Promise<AdminExamSummary[]> {
  const result = await apiRequest("/v1/admin/drafts", idToken, {}, fetcher);
  if (!Array.isArray(result)) return [];
  return result.map((exam) => adminExamSummarySchema.parse(exam));
}

export async function getAllAdminExams(
  idToken: string,
  fetcher: typeof fetch = fetch,
): Promise<AdminExamSummary[]> {
  const result = await apiRequest("/v1/admin/exams", idToken, {}, fetcher);
  if (!Array.isArray(result)) return [];
  return result.map((exam) => adminExamSummarySchema.parse(exam));
}

export async function deleteExam(
  examId: string,
  idToken: string,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  await apiRequest(
    `/v1/admin/exams/${encodeURIComponent(examId)}`,
    idToken,
    { method: "DELETE" },
    fetcher,
  );
}

export async function getAdminCatalog(
  idToken: string,
  fetcher: typeof fetch = fetch,
): Promise<AdminCatalog> {
  const result = await apiRequest(
    "/v1/admin/catalog-management",
    idToken,
    {},
    fetcher,
  );
  return adminCatalogSchema.parse(result);
}

export async function createAdminMajor(
  idToken: string,
  input: CreateMajorInput,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  await apiRequest(
    "/v1/admin/catalog-management/majors",
    idToken,
    { method: "POST", body: JSON.stringify(input) },
    fetcher,
  );
}

export async function createAdminCurriculum(
  idToken: string,
  input: CreateCurriculumInput,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  await apiRequest(
    "/v1/admin/catalog-management/curricula",
    idToken,
    { method: "POST", body: JSON.stringify(input) },
    fetcher,
  );
}

export async function createAdminCourse(
  idToken: string,
  input: CreateCourseInput,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  await apiRequest(
    "/v1/admin/catalog-management/courses",
    idToken,
    { method: "POST", body: JSON.stringify(input) },
    fetcher,
  );
}

export async function updateAdminCourse(
  idToken: string,
  id: string,
  input: UpdateCourseInput,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  await apiRequest(
    `/v1/admin/catalog-management/courses/${id}`,
    idToken,
    { method: "PUT", body: JSON.stringify(input) },
    fetcher,
  );
}

export async function deleteAdminCourse(
  idToken: string,
  id: string,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  await apiRequest(
    `/v1/admin/catalog-management/courses/${id}`,
    idToken,
    { method: "DELETE" },
    fetcher,
  );
}

export async function saveAdminCurriculumCourse(
  idToken: string,
  input: UpsertCurriculumCourseInput,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  await apiRequest(
    "/v1/admin/catalog-management/curriculum-courses",
    idToken,
    { method: "PUT", body: JSON.stringify(input) },
    fetcher,
  );
}

export async function getAdminAttentionSummary(
  idToken: string,
  fetcher: typeof fetch = fetch,
): Promise<AdminAttentionSummary> {
  const result = await apiRequest(
    "/v1/admin/attention-summary",
    idToken,
    {},
    fetcher,
  );
  return adminAttentionSummarySchema.parse(result);
}

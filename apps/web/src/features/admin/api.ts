import {
  adminAttentionSummarySchema,
  adminCatalogSchema,
  adminExamSummarySchema,
  studentProfileSchema,
  type AdminAttentionSummary,
  type AdminCatalog,
  type AdminExamSummary,
  type CreateCourseInput,
  type CreateCurriculumInput,
  type CreateMajorInput,
  type StudentProfile,
  type UpdateCourseInput,
  type UpsertCurriculumCourseInput,
} from "@onthilab/contracts";
import { apiRequest } from "../../api/http";

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
  role: "user" | "contributor" | "admin",
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

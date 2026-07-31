import {
  attemptLaunchSchema,
  attemptSessionSchema,
  attemptResultSchema,
  attemptSchema,
  attemptSummarySchema,
  createReportSchema,
  bookmarkCollectionSchema,
  bookmarkStateSchema,
  confirmTrustedSuggestionsResultSchema,
  draftExamReviewSchema,
  draftImportResultSchema,
  examSchema,
  examSummarySchema,
  profileOptionsSchema,
  publishExamResultSchema,
  queueAiSuggestionsResultSchema,
  reviewReadinessResultSchema,
  saveAnswerResultSchema,
  savedReviewQuestionSchema,
  studentProfileSchema,
  adminExamSummarySchema,
  adminCatalogSchema,
  reportSchema,
  resolveReportSchema,
  createFeedbackSchema,
  feedbackSchema,
  type Attempt,
  type AttemptLaunch,
  type AttemptSession,
  type AttemptResult,
  type AttemptSummary,
  type CreateDraftImportInput,
  type ConfirmTrustedSuggestionsResult,
  type AdminExamSummary,
  type AdminCatalog,
  type CreateCourseInput,
  type UpdateCourseInput,
  type CreateCurriculumInput,
  type CreateMajorInput,
  type UpsertCurriculumCourseInput,
  type CreateReportInput,
  type DraftExamReview,
  type DraftImportResult,
  type Exam,
  type ExamSummary,
  type ProfileOptions,
  type PublishExamResult,
  type QueueAiSuggestionsResult,
  type Report,
  type ResolveReportInput,
  type CreateFeedbackInput,
  type Feedback,
  type ReviewReadinessResult,
  type SavedReviewQuestion,
  type StudentProfile,
  type UpdateQuestionAnswerInput,
  type UpsertStudentProfileInput,
  studentStatisticsSchema,
  type StudentStatistics,
  type BookmarkCollection,
  examOcrStatusSchema,
  type ExamOcrStatus,
} from "@onthilab/contracts";
import { webConfig } from "./config";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ApiResponse {
  data?: unknown;
  error?: unknown;
}

function isFormDataBody(body: BodyInit | null | undefined): boolean {
  return typeof FormData !== "undefined" && body instanceof FormData;
}

async function request(
  path: string,
  idToken: string,
  init: RequestInit = {},
  fetcher: typeof fetch = fetch,
): Promise<unknown> {
  const response = await fetcher(
    `${webConfig.apiUrl.replace(/\/$/, "")}${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${idToken}`,
        ...(init.body && !isFormDataBody(init.body)
          ? { "content-type": "application/json" }
          : {}),
        ...init.headers,
      },
    },
  );
  const body = (await response.json().catch(() => ({}))) as ApiResponse;
  if (!response.ok) {
    throw new ApiError(
      response.status,
      typeof body.error === "string" ? body.error : "API_ERROR",
      `API request failed with status ${response.status}`,
    );
  }
  return body.data;
}

export async function getMyProfile(
  idToken: string,
  fetcher: typeof fetch = fetch,
): Promise<StudentProfile | null> {
  const result = await request("/v1/me", idToken, {}, fetcher);
  return studentProfileSchema.nullable().parse(result);
}

export async function getProfileOptions(
  idToken: string,
  fetcher: typeof fetch = fetch,
): Promise<ProfileOptions> {
  const result = await request("/v1/profile-options", idToken, {}, fetcher);
  return profileOptionsSchema.parse(result);
}

export async function saveMyProfile(
  idToken: string,
  input: UpsertStudentProfileInput,
  fetcher: typeof fetch = fetch,
): Promise<StudentProfile> {
  const result = await request(
    "/v1/me",
    idToken,
    { method: "PUT", body: JSON.stringify(input) },
    fetcher,
  );
  return studentProfileSchema.parse(result);
}

export async function uploadDraftImport(
  idToken: string,
  metadata: CreateDraftImportInput,
  archive: File,
  fetcher: typeof fetch = fetch,
): Promise<DraftImportResult> {
  let archiveKey: string | undefined;
  try {
    // 1. Get Presigned URL
    const presignResponse = (await request(
      "/v1/admin/imports/presign",
      idToken,
      { method: "GET" },
      fetcher,
    )) as { uploadUrl: string; key: string };

    archiveKey = presignResponse.key;

    // 2. Upload to S3 directly
    const uploadResponse = await fetcher(presignResponse.uploadUrl, {
      method: "PUT",
      body: archive,
      headers: {
        "Content-Type": "application/zip",
      },
    });

    if (!uploadResponse.ok) {
      throw new Error("S3 upload failed");
    }
  } catch (err) {
    // Fallback to local upload if presign fails or is not supported (503)
    const form = new FormData();
    form.set("metadata", JSON.stringify(metadata));
    form.set("archive", archive);

    const result = await request(
      "/v1/admin/imports",
      idToken,
      { method: "POST", body: form },
      fetcher,
    );
    return draftImportResultSchema.parse(result);
  }

  // 3. Inform API
  const result = await request(
    "/v1/admin/imports",
    idToken,
    {
      method: "POST",
      body: JSON.stringify({ metadata, archiveKey }),
      headers: { "Content-Type": "application/json" },
    },
    fetcher,
  );
  return draftImportResultSchema.parse(result);
}

export async function getDraftExamReview(
  idToken: string,
  examId: string,
  fetcher: typeof fetch = fetch,
): Promise<DraftExamReview> {
  const result = await request(
    `/v1/admin/exams/${encodeURIComponent(examId)}/review`,
    idToken,
    {},
    fetcher,
  );
  return draftExamReviewSchema.parse(result);
}

export async function saveQuestionReviewAnswer(
  idToken: string,
  examId: string,
  questionId: string,
  answer: UpdateQuestionAnswerInput,
  fetcher: typeof fetch = fetch,
): Promise<SavedReviewQuestion> {
  const result = await request(
    `/v1/admin/exams/${encodeURIComponent(examId)}/questions/${encodeURIComponent(questionId)}/answer`,
    idToken,
    { method: "PUT", body: JSON.stringify(answer) },
    fetcher,
  );
  return savedReviewQuestionSchema.parse(result);
}

export async function markExamReviewReady(
  idToken: string,
  examId: string,
  fetcher: typeof fetch = fetch,
): Promise<ReviewReadinessResult> {
  const result = await request(
    `/v1/admin/exams/${encodeURIComponent(examId)}/ready`,
    idToken,
    { method: "POST" },
    fetcher,
  );
  return reviewReadinessResultSchema.parse(result);
}

export async function confirmTrustedCommunitySuggestions(
  idToken: string,
  examId: string,
  fetcher: typeof fetch = fetch,
): Promise<ConfirmTrustedSuggestionsResult> {
  const result = await request(
    `/v1/admin/exams/${encodeURIComponent(examId)}/community-suggestions/confirm`,
    idToken,
    { method: "POST" },
    fetcher,
  );
  return confirmTrustedSuggestionsResultSchema.parse(result);
}

export async function publishExam(
  idToken: string,
  examId: string,
  fetcher: typeof fetch = fetch,
): Promise<PublishExamResult> {
  const result = await request(
    `/v1/admin/exams/${encodeURIComponent(examId)}/publish`,
    idToken,
    { method: "POST" },
    fetcher,
  );
  return publishExamResultSchema.parse(result);
}

export async function queueAiAnswerSuggestion(
  idToken: string,
  examId: string,
  questionId: string,
  fetcher: typeof fetch = fetch,
): Promise<QueueAiSuggestionsResult> {
  const result = await request(
    `/v1/admin/exams/${encodeURIComponent(examId)}/questions/${encodeURIComponent(questionId)}/ai-suggestion`,
    idToken,
    { method: "POST" },
    fetcher,
  );
  return queueAiSuggestionsResultSchema.parse(result);
}

export async function getCatalog(
  idToken: string,
  fetcher: typeof fetch = fetch,
): Promise<ExamSummary[]> {
  const result = await request("/v1/catalog", idToken, {}, fetcher);
  return examSummarySchema.array().parse(result);
}

export async function getPublishedExam(
  idToken: string,
  examId: string,
  fetcher: typeof fetch = fetch,
): Promise<Exam> {
  const result = await request(
    `/v1/exams/${encodeURIComponent(examId)}`,
    idToken,
    {},
    fetcher,
  );
  return examSchema.parse(result);
}

export async function listAttempts(
  idToken: string,
  fetcher: typeof fetch = fetch,
): Promise<AttemptSummary[]> {
  const result = await request("/v1/attempts", idToken, {}, fetcher);
  return attemptSummarySchema.array().parse(result);
}

export async function createAttempt(
  idToken: string,
  examId: string,
  deviceId: string,
  fetcher: typeof fetch = fetch,
): Promise<AttemptLaunch> {
  const result = await request(
    "/v1/attempts",
    idToken,
    {
      method: "POST",
      body: JSON.stringify({ examId, deviceId }),
    },
    fetcher,
  );
  return attemptLaunchSchema.parse(result);
}

export async function getAttempt(
  idToken: string,
  attemptId: string,
  fetcher: typeof fetch = fetch,
): Promise<Attempt> {
  const result = await request(
    `/v1/attempts/${encodeURIComponent(attemptId)}`,
    idToken,
    {},
    fetcher,
  );
  return attemptSchema.parse(result);
}

export async function getAttemptSession(
  idToken: string,
  attemptId: string,
  fetcher: typeof fetch = fetch,
): Promise<AttemptSession> {
  const result = await request(
    `/v1/attempts/${encodeURIComponent(attemptId)}/session`,
    idToken,
    {},
    fetcher,
  );
  return attemptSessionSchema.parse(result);
}

export async function saveAttemptAnswer(
  idToken: string,
  attemptId: string,
  input: {
    questionId: string;
    selectedOptions: number[];
    sequence: number;
  },
  fetcher: typeof fetch = fetch,
): Promise<{ savedAt: string; sequence: number }> {
  const result = await request(
    `/v1/attempts/${encodeURIComponent(attemptId)}/answers`,
    idToken,
    { method: "PUT", body: JSON.stringify(input) },
    fetcher,
  );
  return saveAnswerResultSchema.parse(result);
}

export async function submitAttempt(
  idToken: string,
  attemptId: string,
  reason: "user" | "timeout",
  fetcher: typeof fetch = fetch,
): Promise<AttemptResult> {
  const result = await request(
    `/v1/attempts/${encodeURIComponent(attemptId)}/submit`,
    idToken,
    { method: "POST", body: JSON.stringify({ reason }) },
    fetcher,
  );
  return attemptResultSchema.parse(result);
}

export async function createReport(
  idToken: string,
  attemptId: string,
  questionId: string,
  report: CreateReportInput,
  fetcher: typeof fetch = fetch,
): Promise<Report> {
  const result = await request(
    `/v1/attempts/${encodeURIComponent(
      attemptId,
    )}/questions/${encodeURIComponent(questionId)}/report`,
    idToken,
    {
      method: "POST",
      body: JSON.stringify(report),
    },
    fetcher,
  );
  return reportSchema.parse(result);
}

export async function listReports(
  idToken: string,
  fetcher: typeof fetch = fetch,
): Promise<Report[]> {
  const result = await request("/v1/admin/reports", idToken, {}, fetcher);
  return reportSchema.array().parse(result);
}

export async function resolveReport(
  idToken: string,
  reportId: string,
  resolution: ResolveReportInput,
  fetcher: typeof fetch = fetch,
): Promise<Report> {
  const result = await request(
    `/v1/admin/reports/${encodeURIComponent(reportId)}/resolve`,
    idToken,
    {
      method: "POST",
      body: JSON.stringify(resolution),
    },
    fetcher,
  );
  return reportSchema.parse(result);
}

export async function createFeedback(
  idToken: string,
  input: CreateFeedbackInput,
  fetcher: typeof fetch = fetch,
): Promise<Feedback> {
  const payload = createFeedbackSchema.parse(input);
  const result = await request(
    "/v1/feedback",
    idToken,
    { method: "POST", body: JSON.stringify(payload) },
    fetcher,
  );
  return feedbackSchema.parse(result);
}

export async function listFeedback(
  idToken: string,
  fetcher: typeof fetch = fetch,
): Promise<Feedback[]> {
  const result = await request("/v1/admin/feedback", idToken, {}, fetcher);
  return feedbackSchema.array().parse(result);
}

export async function resolveFeedback(
  idToken: string,
  feedbackId: string,
  fetcher: typeof fetch = fetch,
): Promise<Feedback> {
  const result = await request(
    `/v1/admin/feedback/${encodeURIComponent(feedbackId)}/resolve`,
    idToken,
    { method: "POST" },
    fetcher,
  );
  return feedbackSchema.parse(result);
}

export async function searchUsers(
  query: string,
  token: string,
  fetcher = fetch,
): Promise<StudentProfile[]> {
  const result = await request(
    `/v1/admin/users/search?q=${encodeURIComponent(query)}`,
    token,
    undefined,
    fetcher,
  );
  if (!Array.isArray(result)) return [];
  return result.map((p) => studentProfileSchema.parse(p));
}

export async function updateRole(
  userId: string,
  role: "user" | "contributor" | "admin",
  token: string,
  fetcher = fetch,
): Promise<void> {
  await request(
    `/v1/admin/users/${encodeURIComponent(userId)}/role`,
    token,
    {
      method: "POST",
      body: JSON.stringify({ role }),
    },
    fetcher,
  );
}

export async function getStudentStatistics(
  idToken: string,
  fetcher: typeof fetch = fetch,
): Promise<StudentStatistics> {
  const result = await request("/v1/me/statistics", idToken, {}, fetcher);
  return studentStatisticsSchema.parse(result);
}

export async function getBookmarks(
  idToken: string,
  fetcher: typeof fetch = fetch,
): Promise<BookmarkCollection> {
  const result = await request("/v1/bookmarks", idToken, {}, fetcher);
  return bookmarkCollectionSchema.parse(result);
}

export async function setExamBookmark(
  idToken: string,
  examId: string,
  bookmarked: boolean,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  const result = await request(
    `/v1/bookmarks/exams/${encodeURIComponent(examId)}`,
    idToken,
    { method: bookmarked ? "PUT" : "DELETE" },
    fetcher,
  );
  return bookmarkStateSchema.parse(result).bookmarked;
}

export async function setQuestionBookmark(
  idToken: string,
  questionId: string,
  bookmarked: boolean,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  const result = await request(
    `/v1/bookmarks/questions/${encodeURIComponent(questionId)}`,
    idToken,
    { method: bookmarked ? "PUT" : "DELETE" },
    fetcher,
  );
  return bookmarkStateSchema.parse(result).bookmarked;
}

export async function getDraftExams(
  idToken: string,
  fetcher: typeof fetch = fetch,
): Promise<AdminExamSummary[]> {
  const result = await request("/v1/admin/drafts", idToken, {}, fetcher);
  if (!Array.isArray(result)) return [];
  return result.map((p) => adminExamSummarySchema.parse(p));
}

export async function getAllAdminExams(
  idToken: string,
  fetcher: typeof fetch = fetch,
): Promise<AdminExamSummary[]> {
  const result = await request("/v1/admin/exams", idToken, {}, fetcher);
  if (!Array.isArray(result)) return [];
  return result.map((p) => adminExamSummarySchema.parse(p));
}

export async function deleteExam(
  examId: string,
  idToken: string,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  await request(
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
  const result = await request(
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
  await request(
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
  await request(
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
  await request(
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
  await request(
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
  await request(
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
  await request(
    "/v1/admin/catalog-management/curriculum-courses",
    idToken,
    { method: "PUT", body: JSON.stringify(input) },
    fetcher,
  );
}

export async function getExamOcrStatus(
  idToken: string,
  revisionId: string,
  fetcher: typeof fetch = fetch,
): Promise<ExamOcrStatus> {
  const result = await request(
    `/v1/admin/revisions/${revisionId}/ocr`,
    idToken,
    {},
    fetcher,
  );
  return examOcrStatusSchema.parse(result);
}

export async function approveOcrQuestion(
  idToken: string,
  questionId: string,
  textContent: string,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  await request(
    `/v1/admin/questions/${questionId}/ocr`,
    idToken,
    { method: "PATCH", body: JSON.stringify({ textContent }) },
    fetcher,
  );
}

export async function rejectOcrQuestion(
  idToken: string,
  questionId: string,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  await request(
    `/v1/admin/questions/${questionId}/ocr`,
    idToken,
    { method: "DELETE" },
    fetcher,
  );
}

export async function retryOcrQuestion(
  idToken: string,
  questionId: string,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  await request(
    `/v1/admin/questions/${questionId}/ocr/retry`,
    idToken,
    { method: "POST" },
    fetcher,
  );
}

export async function setExamPresentationMode(
  idToken: string,
  revisionId: string,
  mode: "image" | "text",
  fetcher: typeof fetch = fetch,
): Promise<void> {
  await request(
    `/v1/admin/revisions/${revisionId}/presentation`,
    idToken,
    { method: "PATCH", body: JSON.stringify({ mode }) },
    fetcher,
  );
}

import {
  attemptLaunchSchema,
  attemptResultSchema,
  attemptSchema,
  attemptSummarySchema,
  createReportSchema,
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
  reportSchema,
  resolveReportSchema,
  type Attempt,
  type AttemptLaunch,
  type AttemptResult,
  type AttemptSummary,
  type CreateDraftImportInput,
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
  type ReviewReadinessResult,
  type SavedReviewQuestion,
  type StudentProfile,
  type UpdateQuestionAnswerInput,
  type UpsertStudentProfileInput,
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

export async function queueAiAnswerSuggestions(
  idToken: string,
  examId: string,
  fetcher: typeof fetch = fetch,
): Promise<QueueAiSuggestionsResult> {
  const result = await request(
    `/v1/admin/exams/${encodeURIComponent(examId)}/ai-suggestions`,
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

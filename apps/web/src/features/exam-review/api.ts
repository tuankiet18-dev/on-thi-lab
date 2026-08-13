import {
  confirmTrustedSuggestionsResultSchema,
  draftExamReviewSchema,
  draftImportResultSchema,
  publishExamResultSchema,
  queueAiSuggestionsResultSchema,
  reviewReadinessResultSchema,
  savedReviewQuestionSchema,
  type ConfirmTrustedSuggestionsResult,
  type CreateDraftImportInput,
  type DraftExamReview,
  type DraftImportResult,
  type PublishExamResult,
  type QueueAiSuggestionsResult,
  type ReviewReadinessResult,
  type SavedReviewQuestion,
  type UpdateQuestionAnswerInput,
} from "@onthilab/contracts";
import { apiRequest } from "../../api/http";

export async function uploadDraftImport(
  idToken: string,
  metadata: CreateDraftImportInput,
  archive: File,
  fetcher: typeof fetch = fetch,
): Promise<DraftImportResult> {
  let archiveKey: string | undefined;
  try {
    const presignResponse = (await apiRequest(
      "/v1/admin/imports/presign",
      idToken,
      { method: "GET" },
      fetcher,
    )) as { uploadUrl: string; key: string };
    archiveKey = presignResponse.key;
    const uploadResponse = await fetcher(presignResponse.uploadUrl, {
      method: "PUT",
      body: archive,
      headers: { "Content-Type": "application/zip" },
    });
    if (!uploadResponse.ok) throw new Error("S3 upload failed");
  } catch {
    const form = new FormData();
    form.set("metadata", JSON.stringify(metadata));
    form.set("archive", archive);
    const result = await apiRequest(
      "/v1/admin/imports",
      idToken,
      { method: "POST", body: form },
      fetcher,
    );
    return draftImportResultSchema.parse(result);
  }

  const result = await apiRequest(
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
  const result = await apiRequest(
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
  const result = await apiRequest(
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
  const result = await apiRequest(
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
  const result = await apiRequest(
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
  const result = await apiRequest(
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
  const result = await apiRequest(
    `/v1/admin/exams/${encodeURIComponent(examId)}/questions/${encodeURIComponent(questionId)}/ai-suggestion`,
    idToken,
    { method: "POST" },
    fetcher,
  );
  return queueAiSuggestionsResultSchema.parse(result);
}

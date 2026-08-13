import { examOcrStatusSchema, type ExamOcrStatus } from "@onthilab/contracts";
import { ApiResponseValidationError, apiRequest } from "../../api/http";

export async function getExamOcrStatus(
  idToken: string,
  revisionId: string,
  fetcher: typeof fetch = fetch,
): Promise<ExamOcrStatus> {
  const endpoint = `/v1/admin/revisions/${revisionId}/ocr`;
  const result = await apiRequest(endpoint, idToken, {}, fetcher);
  const parsed = examOcrStatusSchema.safeParse(result);
  if (!parsed.success) {
    throw new ApiResponseValidationError(
      endpoint,
      parsed.error.issues.map((issue) => ({
        path: issue.path,
        message: issue.message,
      })),
    );
  }
  return parsed.data;
}

export async function approveOcrQuestion(
  idToken: string,
  questionId: string,
  input: { textContent: string; options: string[] },
  fetcher: typeof fetch = fetch,
): Promise<void> {
  await apiRequest(
    `/v1/admin/questions/${questionId}/ocr`,
    idToken,
    { method: "PATCH", body: JSON.stringify(input) },
    fetcher,
  );
}

export async function rejectOcrQuestion(
  idToken: string,
  questionId: string,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  await apiRequest(
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
  await apiRequest(
    `/v1/admin/questions/${questionId}/ocr/retry`,
    idToken,
    { method: "POST" },
    fetcher,
  );
}

export async function retryRevisionOcr(
  idToken: string,
  revisionId: string,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  await apiRequest(
    `/v1/admin/revisions/${revisionId}/ocr/retry`,
    idToken,
    { method: "POST" },
    fetcher,
  );
}

export async function setExamPresentationMode(
  idToken: string,
  revisionId: string,
  mode: "image" | "text" | "hybrid",
  fetcher: typeof fetch = fetch,
): Promise<void> {
  await apiRequest(
    `/v1/admin/revisions/${revisionId}/presentation`,
    idToken,
    { method: "PATCH", body: JSON.stringify({ mode }) },
    fetcher,
  );
}

import {
  examSchema,
  examSummarySchema,
  type Exam,
  type ExamSummary,
} from "@onthilab/contracts";
import { apiRequest } from "../../api/http";

export async function getCatalog(
  idToken: string,
  fetcher: typeof fetch = fetch,
): Promise<ExamSummary[]> {
  const result = await apiRequest("/v1/catalog", idToken, {}, fetcher);
  return examSummarySchema.array().parse(result);
}

export async function getPublishedExam(
  idToken: string,
  examId: string,
  fetcher: typeof fetch = fetch,
): Promise<Exam> {
  const result = await apiRequest(
    `/v1/exams/${encodeURIComponent(examId)}`,
    idToken,
    {},
    fetcher,
  );
  return examSchema.parse(result);
}

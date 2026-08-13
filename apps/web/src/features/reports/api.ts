import {
  reportSchema,
  type CreateReportInput,
  type Report,
  type ResolveReportInput,
} from "@onthilab/contracts";
import { apiRequest } from "../../api/http";

export async function createReport(
  idToken: string,
  attemptId: string,
  questionId: string,
  report: CreateReportInput,
  fetcher: typeof fetch = fetch,
): Promise<Report> {
  const result = await apiRequest(
    `/v1/attempts/${encodeURIComponent(attemptId)}/questions/${encodeURIComponent(questionId)}/report`,
    idToken,
    { method: "POST", body: JSON.stringify(report) },
    fetcher,
  );
  return reportSchema.parse(result);
}

export async function listReports(
  idToken: string,
  fetcher: typeof fetch = fetch,
): Promise<Report[]> {
  const result = await apiRequest("/v1/admin/reports", idToken, {}, fetcher);
  return reportSchema.array().parse(result);
}

export async function resolveReport(
  idToken: string,
  reportId: string,
  resolution: ResolveReportInput,
  fetcher: typeof fetch = fetch,
): Promise<Report> {
  const result = await apiRequest(
    `/v1/admin/reports/${encodeURIComponent(reportId)}/resolve`,
    idToken,
    { method: "POST", body: JSON.stringify(resolution) },
    fetcher,
  );
  return reportSchema.parse(result);
}

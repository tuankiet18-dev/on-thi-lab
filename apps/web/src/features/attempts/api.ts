import {
  attemptLaunchSchema,
  attemptResultSchema,
  attemptSchema,
  attemptSessionSchema,
  attemptSummarySchema,
  saveAnswerResultSchema,
  studentStatisticsSchema,
  type Attempt,
  type AttemptLaunch,
  type AttemptResult,
  type AttemptSession,
  type AttemptSummary,
  type StudentStatistics,
} from "@onthilab/contracts";
import { apiRequest } from "../../api/http";

export async function listAttempts(
  idToken: string,
  fetcher: typeof fetch = fetch,
): Promise<AttemptSummary[]> {
  const result = await apiRequest("/v1/attempts", idToken, {}, fetcher);
  return attemptSummarySchema.array().parse(result);
}

export async function createAttempt(
  idToken: string,
  examId: string,
  deviceId: string,
  fetcher: typeof fetch = fetch,
): Promise<AttemptLaunch> {
  const result = await apiRequest(
    "/v1/attempts",
    idToken,
    { method: "POST", body: JSON.stringify({ examId, deviceId }) },
    fetcher,
  );
  return attemptLaunchSchema.parse(result);
}

export async function getAttempt(
  idToken: string,
  attemptId: string,
  fetcher: typeof fetch = fetch,
): Promise<Attempt> {
  const result = await apiRequest(
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
  const result = await apiRequest(
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
  const result = await apiRequest(
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
  const result = await apiRequest(
    `/v1/attempts/${encodeURIComponent(attemptId)}/submit`,
    idToken,
    { method: "POST", body: JSON.stringify({ reason }) },
    fetcher,
  );
  return attemptResultSchema.parse(result);
}

export async function getStudentStatistics(
  idToken: string,
  fetcher: typeof fetch = fetch,
): Promise<StudentStatistics> {
  const result = await apiRequest("/v1/me/statistics", idToken, {}, fetcher);
  return studentStatisticsSchema.parse(result);
}

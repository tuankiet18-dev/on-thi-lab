import {
  createFeedbackSchema,
  feedbackSchema,
  type CreateFeedbackInput,
  type Feedback,
} from "@onthilab/contracts";
import { apiRequest } from "../../api/http";

export async function createFeedback(
  idToken: string,
  input: CreateFeedbackInput,
  fetcher: typeof fetch = fetch,
): Promise<Feedback> {
  const payload = createFeedbackSchema.parse(input);
  const result = await apiRequest(
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
  const result = await apiRequest("/v1/admin/feedback", idToken, {}, fetcher);
  return feedbackSchema.array().parse(result);
}

export async function resolveFeedback(
  idToken: string,
  feedbackId: string,
  fetcher: typeof fetch = fetch,
): Promise<Feedback> {
  const result = await apiRequest(
    `/v1/admin/feedback/${encodeURIComponent(feedbackId)}/resolve`,
    idToken,
    { method: "POST" },
    fetcher,
  );
  return feedbackSchema.parse(result);
}

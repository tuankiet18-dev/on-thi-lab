import {
  profileOptionsSchema,
  studentProfileSchema,
  type ProfileOptions,
  type StudentProfile,
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
        ...(init.body ? { "content-type": "application/json" } : {}),
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

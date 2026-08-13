import { webConfig } from "../lib/config";

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

/** A successful response did not match the web client's shared contract. */
export class ApiResponseValidationError extends Error {
  constructor(
    readonly endpoint: string,
    readonly issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>,
  ) {
    super(`Dữ liệu phản hồi không hợp lệ từ ${endpoint}`);
    this.name = "ApiResponseValidationError";
  }
}

interface ApiResponse {
  data?: unknown;
  error?: unknown;
}

function isFormDataBody(body: BodyInit | null | undefined): boolean {
  return typeof FormData !== "undefined" && body instanceof FormData;
}

export async function apiRequest(
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

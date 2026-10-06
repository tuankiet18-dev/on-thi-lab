import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest, setTokenRefresher } from "./http";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function authorizationOf(call: unknown[]): string | undefined {
  const init = call[1] as RequestInit;
  return (init.headers as Record<string, string>).Authorization;
}

afterEach(() => setTokenRefresher(null));

describe("apiRequest token refresh", () => {
  it("replays a 401 once with the refreshed token", async () => {
    const refresher = vi.fn(async () => "new-token");
    setTokenRefresher(refresher);
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(json(401, { error: "INVALID_TOKEN" }))
      .mockResolvedValueOnce(json(200, { data: { ok: true } }));

    await expect(
      apiRequest("/v1/x", "old-token", { method: "PUT", body: "{}" }, fetcher),
    ).resolves.toEqual({ ok: true });

    expect(refresher).toHaveBeenCalledWith("old-token");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(authorizationOf(fetcher.mock.calls[0]!)).toBe("Bearer old-token");
    expect(authorizationOf(fetcher.mock.calls[1]!)).toBe("Bearer new-token");
    expect((fetcher.mock.calls[1]![1] as RequestInit).body).toBe("{}");
  });

  it("does not loop when the refreshed token is also rejected", async () => {
    const refresher = vi.fn(async () => "new-token");
    setTokenRefresher(refresher);
    const fetcher = vi.fn(async () => json(401, { error: "INVALID_TOKEN" }));

    await expect(
      apiRequest("/v1/x", "old-token", {}, fetcher),
    ).rejects.toMatchObject({ status: 401 });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(refresher).toHaveBeenCalledTimes(1);
  });

  it("surfaces the 401 when no fresh token is available", async () => {
    for (const result of [null, "old-token"]) {
      setTokenRefresher(async () => result);
      const fetcher = vi.fn(async () => json(401, { error: "INVALID_TOKEN" }));
      await expect(
        apiRequest("/v1/x", "old-token", {}, fetcher),
      ).rejects.toMatchObject({ status: 401 });
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });

  it("does not refresh for other errors or without a refresher", async () => {
    const refresher = vi.fn(async () => "new-token");
    setTokenRefresher(refresher);
    const forbidden = vi.fn(async () => json(403, { error: "FORBIDDEN" }));
    await expect(
      apiRequest("/v1/x", "old-token", {}, forbidden),
    ).rejects.toMatchObject({ status: 403 });
    expect(refresher).not.toHaveBeenCalled();

    setTokenRefresher(null);
    const unauthorized = vi.fn(async () => json(401, { error: "X" }));
    await expect(
      apiRequest("/v1/x", "old-token", {}, unauthorized),
    ).rejects.toMatchObject({ status: 401 });
    expect(unauthorized).toHaveBeenCalledTimes(1);
  });
});

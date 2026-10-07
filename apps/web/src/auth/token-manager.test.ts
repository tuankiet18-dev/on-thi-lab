import { describe, expect, it, vi } from "vitest";
import type { AuthSession } from "../lib/auth";
import {
  REFRESH_LEAD_MS,
  createTokenManager,
  isExpiringSoon,
  msUntilRefresh,
} from "./token-manager";

const now = 1_000_000;

function session(idToken: string, expiresAt: number): AuthSession {
  return {
    accessToken: `access-${idToken}`,
    idToken,
    refreshToken: "refresh",
    expiresAt,
    user: { id: "u", email: "u@example.com", name: "U" },
  } as unknown as AuthSession;
}

describe("msUntilRefresh", () => {
  it("refreshes a few minutes before expiry", () => {
    expect(msUntilRefresh(now + 60 * 60_000, now)).toBe(
      60 * 60_000 - REFRESH_LEAD_MS,
    );
  });

  it("never returns an immediate or negative delay", () => {
    expect(msUntilRefresh(now - 1, now)).toBe(5_000);
    expect(msUntilRefresh(now + 1_000, now)).toBe(5_000);
  });
});

describe("isExpiringSoon", () => {
  it("is true inside the lead window and for expired sessions", () => {
    expect(isExpiringSoon(session("a", now + REFRESH_LEAD_MS), now)).toBe(true);
    expect(isExpiringSoon(session("a", now - 1), now)).toBe(true);
    expect(isExpiringSoon(session("a", now + REFRESH_LEAD_MS + 1), now)).toBe(
      false,
    );
  });
});

describe("createTokenManager", () => {
  function setup(initial: AuthSession | null, refresh = vi.fn()) {
    let current = initial;
    const setSession = vi.fn((next: AuthSession) => {
      current = next;
    });
    const manager = createTokenManager({
      getSession: () => current,
      setSession,
      refresh,
      now: () => now,
    });
    return { manager, setSession, refresh };
  }

  it("refreshes and publishes the new session", async () => {
    const next = session("new", now + 3_600_000);
    const { manager, setSession, refresh } = setup(
      session("old", now - 1),
      vi.fn(async () => next),
    );
    await expect(manager.refresh("old")).resolves.toBe(next);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(setSession).toHaveBeenCalledWith(next);
  });

  it("shares one refresh between concurrent callers", async () => {
    let resolve!: (value: AuthSession) => void;
    const refresh = vi.fn(
      () => new Promise<AuthSession>((done) => (resolve = done)),
    );
    const { manager } = setup(session("old", now - 1), refresh);
    const first = manager.refresh("old");
    const second = manager.refresh("old");
    resolve(session("new", now + 3_600_000));
    expect((await first)?.idToken).toBe("new");
    expect((await second)?.idToken).toBe("new");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("reuses a session another caller already refreshed", async () => {
    const { manager, refresh } = setup(session("new", now + 3_600_000));
    expect((await manager.refresh("old"))?.idToken).toBe("new");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refreshes again when the rejected token is still the current one", async () => {
    const { manager, refresh } = setup(
      session("same", now + 3_600_000),
      vi.fn(async () => session("next", now + 3_600_000)),
    );
    expect((await manager.refresh("same"))?.idToken).toBe("next");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("resolves to null (and recovers) when refreshing fails", async () => {
    const refresh = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(session("next", now + 3_600_000));
    const { manager } = setup(session("old", now - 1), refresh);
    await expect(manager.refresh("old")).resolves.toBeNull();
    expect((await manager.refresh("old"))?.idToken).toBe("next");
  });

  it("returns null when signed out", async () => {
    const { manager, refresh } = setup(null);
    await expect(manager.refresh()).resolves.toBeNull();
    expect(refresh).not.toHaveBeenCalled();
  });
});

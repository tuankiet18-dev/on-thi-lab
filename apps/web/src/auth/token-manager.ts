import type { AuthSession } from "../lib/auth";

/** Refresh this long before the ID token expires. */
export const REFRESH_LEAD_MS = 5 * 60_000;
/** Never schedule a refresh sooner than this, so failures cannot spin. */
const MIN_REFRESH_DELAY_MS = 5_000;
/** A token this close to expiry is not worth reusing for a retry. */
const MIN_REMAINING_MS = 30_000;

/** Milliseconds to wait before the next proactive refresh. */
export function msUntilRefresh(expiresAt: number, now: number): number {
  return Math.max(MIN_REFRESH_DELAY_MS, expiresAt - REFRESH_LEAD_MS - now);
}

export function isExpiringSoon(
  session: Pick<AuthSession, "expiresAt">,
  now: number,
  leadMs: number = REFRESH_LEAD_MS,
): boolean {
  return session.expiresAt - now <= leadMs;
}

export interface TokenManagerDependencies {
  getSession(): AuthSession | null;
  /** Persist and publish a freshly refreshed session. */
  setSession(session: AuthSession): void;
  refresh(session: AuthSession): Promise<AuthSession>;
  now?: () => number;
}

export interface TokenManager {
  /**
   * Returns a session with a usable ID token, refreshing it if needed.
   * `rejectedToken` is the token the API just refused; if another caller has
   * already replaced it, the current session is returned without a new call.
   * Concurrent calls share one refresh. Resolves to null when refreshing fails.
   */
  refresh(rejectedToken?: string): Promise<AuthSession | null>;
}

export function createTokenManager(
  dependencies: TokenManagerDependencies,
): TokenManager {
  const now = dependencies.now ?? Date.now;
  let inflight: Promise<AuthSession | null> | null = null;

  return {
    async refresh(rejectedToken) {
      const current = dependencies.getSession();
      if (!current) return null;
      if (
        rejectedToken &&
        current.idToken !== rejectedToken &&
        current.expiresAt - now() > MIN_REMAINING_MS
      ) {
        return current;
      }
      if (!inflight) {
        inflight = dependencies
          .refresh(current)
          .then((next) => {
            dependencies.setSession(next);
            return next;
          })
          .catch(() => null)
          .finally(() => {
            inflight = null;
          });
      }
      return inflight;
    },
  };
}

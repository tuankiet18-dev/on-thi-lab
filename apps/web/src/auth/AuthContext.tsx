import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  buildAuthorizationUrl,
  buildLogoutUrl,
  createCodeChallenge,
  createRandomBase64Url,
  decodeIdToken,
  exchangeAuthorizationCode,
  refreshAuthSession,
  type AuthSession,
} from "../lib/auth";
import { setTokenRefresher } from "../api/http";
import { ApiError, getMyProfile, saveMyProfile } from "../lib/api";
import { cognitoConfig } from "../lib/config";
import type {
  StudentProfile,
  UpsertStudentProfileInput,
} from "@onthilab/contracts";
import {
  createTokenManager,
  isExpiringSoon,
  msUntilRefresh,
} from "./token-manager";

const sessionStorageKey = "onthilab.auth.session";
const transactionStorageKey = "onthilab.auth.transaction";

interface AuthTransaction {
  state: string;
  verifier: string;
}

type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "error";

interface AuthContextValue {
  configured: boolean;
  session: AuthSession | null;
  studentProfile: StudentProfile | null;
  status: AuthStatus;
  error: string | null;
  signIn: (provider?: "Google", mode?: "signIn" | "signUp") => Promise<void>;
  completeSignIn: (search: string) => Promise<void>;
  saveStudentProfile: (profile: UpsertStudentProfileInput) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStoredSession(): AuthSession | null {
  const value = sessionStorage.getItem(sessionStorageKey);
  if (!value) return null;

  try {
    const stored = JSON.parse(value) as AuthSession;
    return {
      ...stored,
      user: decodeIdToken(stored.idToken),
    };
  } catch {
    sessionStorage.removeItem(sessionStorageKey);
    return null;
  }
}

function storeSession(session: AuthSession | null): void {
  if (session) {
    sessionStorage.setItem(sessionStorageKey, JSON.stringify(session));
  } else {
    sessionStorage.removeItem(sessionStorageKey);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(
    null,
  );
  const [status, setStatus] = useState<AuthStatus>(
    cognitoConfig ? "loading" : "unauthenticated",
  );
  const [error, setError] = useState<string | null>(null);

  // The ID token lasts one hour, so a long session (or exam) outlives it. Keep
  // the latest session in a ref and refresh it before it expires, and when the
  // API rejects it (see setTokenRefresher).
  const sessionRef = useRef<AuthSession | null>(null);
  sessionRef.current = session;
  const tokenManager = useMemo(
    () =>
      createTokenManager({
        getSession: () => sessionRef.current ?? readStoredSession(),
        setSession: (next) => {
          storeSession(next);
          sessionRef.current = next;
          setSession(next);
        },
        refresh: (current) => {
          if (!cognitoConfig) {
            return Promise.reject(new Error("Cognito chưa được cấu hình."));
          }
          return refreshAuthSession(cognitoConfig, current);
        },
      }),
    [],
  );

  useEffect(() => {
    setTokenRefresher(async (rejectedToken) => {
      const refreshed = await tokenManager.refresh(rejectedToken);
      return refreshed?.idToken ?? null;
    });
    return () => setTokenRefresher(null);
  }, [tokenManager]);

  const expiresAt = session?.expiresAt;
  useEffect(() => {
    if (!cognitoConfig || expiresAt === undefined) return;
    let timer: number | undefined;
    let cancelled = false;
    const schedule = (delayMs: number) => {
      timer = window.setTimeout(async () => {
        const next = await tokenManager.refresh();
        // A successful refresh changes expiresAt, which re-runs this effect.
        // On failure, try again in a minute.
        if (!cancelled && !next) schedule(60_000);
      }, delayMs);
    };
    schedule(msUntilRefresh(expiresAt, Date.now()));
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [expiresAt, tokenManager]);

  useEffect(() => {
    // Timers are throttled in background tabs and stop while a laptop sleeps,
    // so also check when the tab or the network comes back.
    const refreshIfExpiring = () => {
      const current = sessionRef.current;
      if (
        current &&
        document.visibilityState !== "hidden" &&
        isExpiringSoon(current, Date.now())
      ) {
        void tokenManager.refresh();
      }
    };
    document.addEventListener("visibilitychange", refreshIfExpiring);
    window.addEventListener("online", refreshIfExpiring);
    return () => {
      document.removeEventListener("visibilitychange", refreshIfExpiring);
      window.removeEventListener("online", refreshIfExpiring);
    };
  }, [tokenManager]);

  useEffect(() => {
    if (!cognitoConfig) return;

    const stored = readStoredSession();
    if (!stored) {
      setStatus("unauthenticated");
      return;
    }

    if (stored.expiresAt > Date.now() + 60_000) {
      setSession(stored);
      void getMyProfile(stored.idToken)
        .then((profile) => {
          setStudentProfile(profile);
          setStatus("authenticated");
        })
        .catch((reason) => {
          if (
            reason instanceof ApiError &&
            reason.code === "PROFILE_DISABLED"
          ) {
            storeSession(null);
            setSession(null);
            setStudentProfile(null);
            setError(
              "Tài khoản của bạn đã bị khóa bởi quản trị viên. Vui lòng liên hệ ban quản trị để được hỗ trợ mở khóa.",
            );
            setStatus("error");
            return;
          }
          if (reason instanceof ApiError && reason.status === 401) {
            storeSession(null);
            setSession(null);
            setStatus("unauthenticated");
            return;
          }
          setError("Không thể kết nối API để tải hồ sơ. Vui lòng thử lại.");
          setStatus("error");
        });
      return;
    }

    void refreshAuthSession(cognitoConfig, stored)
      .then((refreshed) => {
        storeSession(refreshed);
        setSession(refreshed);
        void getMyProfile(refreshed.idToken)
          .then((profile) => {
            setStudentProfile(profile);
            setStatus("authenticated");
          })
          .catch((reason) => {
            if (
              reason instanceof ApiError &&
              reason.code === "PROFILE_DISABLED"
            ) {
              storeSession(null);
              setSession(null);
              setStudentProfile(null);
              setError(
                "Tài khoản của bạn đã bị khóa bởi quản trị viên. Vui lòng liên hệ ban quản trị để được hỗ trợ mở khóa.",
              );
              setStatus("error");
              return;
            }
            if (reason instanceof ApiError && reason.status === 401) {
              storeSession(null);
              setSession(null);
              setStatus("unauthenticated");
              return;
            }
            setError("Không thể kết nối API để tải hồ sơ. Vui lòng thử lại.");
            setStatus("error");
          });
      })
      .catch(() => {
        storeSession(null);
        setSession(null);
        setStudentProfile(null);
        setStatus("unauthenticated");
      });
  }, []);

  const signIn = useCallback(
    async (provider?: "Google", mode?: "signIn" | "signUp") => {
      if (!cognitoConfig) {
        throw new Error("Cognito chưa được cấu hình.");
      }

      const verifier = createRandomBase64Url(64);
      const state = createRandomBase64Url(32);
      const codeChallenge = await createCodeChallenge(verifier);
      const transaction: AuthTransaction = { state, verifier };
      sessionStorage.setItem(
        transactionStorageKey,
        JSON.stringify(transaction),
      );

      window.location.assign(
        buildAuthorizationUrl(cognitoConfig, {
          state,
          codeChallenge,
          provider,
          mode,
        }),
      );
    },
    [],
  );

  const completeSignIn = useCallback(async (search: string) => {
    if (!cognitoConfig) {
      throw new Error("Cognito chưa được cấu hình.");
    }

    const parameters = new URLSearchParams(search);
    const oauthError = parameters.get("error");
    if (oauthError) {
      const description =
        parameters.get("error_description") || "Đăng nhập đã bị hủy.";
      throw new Error(description);
    }

    const code = parameters.get("code");
    const returnedState = parameters.get("state");
    const transactionValue = sessionStorage.getItem(transactionStorageKey);
    sessionStorage.removeItem(transactionStorageKey);

    if (!code || !returnedState || !transactionValue) {
      throw new Error("Phiên đăng nhập không đầy đủ. Vui lòng thử lại.");
    }

    let transaction: AuthTransaction;
    try {
      transaction = JSON.parse(transactionValue) as AuthTransaction;
    } catch {
      throw new Error("Phiên đăng nhập không hợp lệ. Vui lòng thử lại.");
    }

    if (returnedState !== transaction.state) {
      throw new Error("Không thể xác minh yêu cầu đăng nhập.");
    }

    const nextSession = await exchangeAuthorizationCode(cognitoConfig, {
      code,
      verifier: transaction.verifier,
    });
    storeSession(nextSession);
    setSession(nextSession);
    setStatus("loading");
    try {
      setStudentProfile(await getMyProfile(nextSession.idToken));
      setStatus("authenticated");
    } catch (reason) {
      if (reason instanceof ApiError && reason.code === "PROFILE_DISABLED") {
        storeSession(null);
        setSession(null);
        setStudentProfile(null);
        setError(
          "Tài khoản của bạn đã bị khóa bởi quản trị viên. Vui lòng liên hệ ban quản trị để được hỗ trợ mở khóa.",
        );
        setStatus("error");
        throw new Error(
          "Tài khoản của bạn đã bị khóa bởi quản trị viên. Vui lòng liên hệ ban quản trị để được hỗ trợ mở khóa.",
        );
      }
      setError("Đăng nhập thành công nhưng chưa thể kết nối API để tải hồ sơ.");
      setStatus("error");
      throw new Error(
        "Đăng nhập thành công nhưng chưa thể kết nối hệ thống hồ sơ. Vui lòng thử lại.",
      );
    }
  }, []);

  const saveStudentProfile = useCallback(
    async (profile: UpsertStudentProfileInput) => {
      if (!session) {
        throw new Error("Bạn cần đăng nhập trước khi cập nhật hồ sơ.");
      }
      const saved = await saveMyProfile(session.idToken, profile);
      setStudentProfile(saved);
    },
    [session],
  );

  const signOut = useCallback(() => {
    storeSession(null);
    sessionStorage.removeItem(transactionStorageKey);
    setSession(null);
    setStudentProfile(null);
    setError(null);
    setStatus("unauthenticated");

    if (cognitoConfig) {
      window.location.assign(buildLogoutUrl(cognitoConfig));
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      configured: Boolean(cognitoConfig),
      error,
      session,
      studentProfile,
      status,
      signIn,
      completeSignIn,
      saveStudentProfile,
      signOut,
    }),
    [
      completeSignIn,
      error,
      saveStudentProfile,
      session,
      signIn,
      signOut,
      status,
      studentProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

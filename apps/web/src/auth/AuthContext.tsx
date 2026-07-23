import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
import { ApiError, getMyProfile, saveMyProfile } from "../lib/api";
import { cognitoConfig } from "../lib/config";
import type {
  StudentProfile,
  UpsertStudentProfileInput,
} from "@onthilab/contracts";

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
  signIn: (provider?: "Google") => Promise<void>;
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

  const signIn = useCallback(async (provider?: "Google") => {
    if (!cognitoConfig) {
      throw new Error("Cognito chưa được cấu hình.");
    }

    const verifier = createRandomBase64Url(64);
    const state = createRandomBase64Url(32);
    const codeChallenge = await createCodeChallenge(verifier);
    const transaction: AuthTransaction = { state, verifier };
    sessionStorage.setItem(transactionStorageKey, JSON.stringify(transaction));

    window.location.assign(
      buildAuthorizationUrl(cognitoConfig, {
        state,
        codeChallenge,
        provider,
      }),
    );
  }, []);

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
    } catch {
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

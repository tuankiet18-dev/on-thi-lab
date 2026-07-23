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
import { cognitoConfig } from "../lib/config";

const sessionStorageKey = "onthilab.auth.session";
const transactionStorageKey = "onthilab.auth.transaction";

interface AuthTransaction {
  state: string;
  verifier: string;
}

export interface StudentProfile {
  campusCode: string;
  fullName: string;
  major: string;
  studentCode: string;
}

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  configured: boolean;
  session: AuthSession | null;
  studentProfile: StudentProfile | null;
  status: AuthStatus;
  signIn: (provider?: "Google") => Promise<void>;
  completeSignIn: (search: string) => Promise<void>;
  saveStudentProfile: (profile: StudentProfile) => void;
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

function profileStorageKey(subject: string): string {
  return `onthilab.student-profile.${subject}`;
}

function readStudentProfile(subject: string): StudentProfile | null {
  const value = localStorage.getItem(profileStorageKey(subject));
  if (!value) return null;

  try {
    return JSON.parse(value) as StudentProfile;
  } catch {
    localStorage.removeItem(profileStorageKey(subject));
    return null;
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

  useEffect(() => {
    if (!cognitoConfig) return;

    const stored = readStoredSession();
    if (!stored) {
      setStatus("unauthenticated");
      return;
    }

    if (stored.expiresAt > Date.now() + 60_000) {
      setSession(stored);
      setStudentProfile(readStudentProfile(stored.user.subject));
      setStatus("authenticated");
      return;
    }

    void refreshAuthSession(cognitoConfig, stored)
      .then((refreshed) => {
        storeSession(refreshed);
        setSession(refreshed);
        setStudentProfile(readStudentProfile(refreshed.user.subject));
        setStatus("authenticated");
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
    setStudentProfile(readStudentProfile(nextSession.user.subject));
    setStatus("authenticated");
  }, []);

  const saveStudentProfile = useCallback(
    (profile: StudentProfile) => {
      if (!session) {
        throw new Error("Bạn cần đăng nhập trước khi cập nhật hồ sơ.");
      }
      localStorage.setItem(
        profileStorageKey(session.user.subject),
        JSON.stringify(profile),
      );
      setStudentProfile(profile);
    },
    [session],
  );

  const signOut = useCallback(() => {
    storeSession(null);
    sessionStorage.removeItem(transactionStorageKey);
    setSession(null);
    setStudentProfile(null);
    setStatus("unauthenticated");

    if (cognitoConfig) {
      window.location.assign(buildLogoutUrl(cognitoConfig));
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      configured: Boolean(cognitoConfig),
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

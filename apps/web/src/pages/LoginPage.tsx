import { Link, Navigate, useNavigate } from "@tanstack/react-router";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { webConfig } from "../lib/config";
import { cn } from "../lib/cn";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.91h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.4Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.98-.9 6.63-2.37l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.39 13.92A6.02 6.02 0 0 1 6.07 12c0-.67.11-1.32.32-1.92V7.46H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.54l3.35-2.62Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.95c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.96 5.46l3.35 2.62C7.18 7.71 9.39 5.95 12 5.95Z"
      />
    </svg>
  );
}

interface LoginPageProps {
  initialMode?: "login" | "register";
}

export function LoginPage({ initialMode = "login" }: LoginPageProps) {
  const navigate = useNavigate();
  const { configured, status, signIn } = useAuth();
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState<"google" | "cognito">();

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    const resetPending = () => setPending(undefined);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") resetPending();
    };

    window.addEventListener("pageshow", resetPending);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pageshow", resetPending);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  if (status === "authenticated") {
    return <Navigate to="/" replace />;
  }

  const handleTabChange = (nextMode: "login" | "register") => {
    setMode(nextMode);
    setError(undefined);
    void navigate({
      to: nextMode === "login" ? "/login" : "/register",
      replace: true,
    });
  };

  const beginSignIn = async (provider?: "Google") => {
    setError(undefined);
    setPending(provider ? "google" : "cognito");
    try {
      await signIn(provider, mode === "register" ? "signUp" : "signIn");
    } catch (reason) {
      setPending(undefined);
      setError(
        reason instanceof Error
          ? reason.message
          : "Không thể bắt đầu phiên xác thực.",
      );
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col justify-between px-4 py-8 sm:py-12">
      {/* Top Brand Link */}
      <div className="w-full max-w-md mx-auto flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <img
            src="/logo.png"
            alt="OnThiLab Mascot"
            className="size-9 object-contain"
          />
          <span className="font-heading text-xl font-bold tracking-tight text-slate-900">
            OnThi<span className="text-primary">Lab</span>
          </span>
        </Link>

        <Link
          to="/"
          className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
        >
          ← Về trang chủ
        </Link>
      </div>

      {/* Centered Auth Card */}
      <div className="w-full max-w-md mx-auto my-auto py-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-7 sm:p-9 shadow-sm">
          {/* Tab Switcher: Đăng nhập | Đăng ký */}
          <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-sm font-semibold">
            <button
              type="button"
              onClick={() => handleTabChange("login")}
              className={cn(
                "cursor-pointer rounded-lg py-2 transition-all duration-150 text-center",
                mode === "login"
                  ? "bg-white text-slate-900 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900",
              )}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              onClick={() => handleTabChange("register")}
              className={cn(
                "cursor-pointer rounded-lg py-2 transition-all duration-150 text-center",
                mode === "register"
                  ? "bg-white text-slate-900 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900",
              )}
            >
              Đăng ký tài khoản
            </button>
          </div>

          {/* Heading */}
          <div className="mt-6 text-center sm:text-left">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {mode === "login" ? "Chào mừng trở lại" : "Tạo tài khoản ôn thi"}
            </h1>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              {mode === "login"
                ? "Đăng nhập để làm bài thi, lưu đề yêu thích và xem phân tích kết quả."
                : "Tạo tài khoản miễn phí để ôn luyện đề FE không giới hạn và đồng bộ tiến độ."}
            </p>
          </div>

          {!configured ? (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              Chế độ xác thực chưa được cấu hình trong môi trường này.
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {/* Google Sign In/Up Button */}
              {webConfig.flags?.googleAuthEnabled && (
                <button
                  type="button"
                  disabled={Boolean(pending)}
                  onClick={() => void beginSignIn("Google")}
                  className="group flex min-h-11 w-full cursor-pointer items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-2xs transition-all duration-150 hover:bg-slate-50 hover:border-slate-400 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-wait disabled:opacity-60"
                >
                  <GoogleIcon />
                  <span>
                    {pending === "google"
                      ? "Đang chuyển hướng..."
                      : mode === "login"
                        ? "Tiếp tục với Google"
                        : "Đăng ký với Google"}
                  </span>
                </button>
              )}

              {/* Divider */}
              <div className="relative my-3 flex items-center justify-center">
                <div className="w-full border-t border-slate-200" />
                <span className="absolute bg-white px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  hoặc với email
                </span>
              </div>

              {/* Cognito Email Sign In/Up Button */}
              <button
                type="button"
                disabled={Boolean(pending)}
                onClick={() => void beginSignIn()}
                className="group flex min-h-11 w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-primary px-4 text-sm font-bold text-white shadow-xs transition-all duration-150 hover:bg-primary-strong active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:cursor-wait disabled:opacity-60"
              >
                <LockKeyhole size={17} aria-hidden="true" />
                <span>
                  {pending === "cognito"
                    ? "Đang chuyển hướng..."
                    : mode === "login"
                      ? "Đăng nhập bằng Email"
                      : "Đăng ký bằng Email"}
                </span>
                {!pending && (
                  <ArrowRight
                    size={16}
                    aria-hidden="true"
                    className="transition-transform duration-150 group-hover:translate-x-0.5"
                  />
                )}
              </button>
            </div>
          )}

          {/* Error Feedback */}
          {error && (
            <p
              role="alert"
              className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-danger"
            >
              {error}
            </p>
          )}

          {/* Toggle Helper Link */}
          <div className="mt-6 text-center text-xs text-slate-500">
            {mode === "login" ? (
              <>
                Chưa có tài khoản?{" "}
                <button
                  type="button"
                  onClick={() => handleTabChange("register")}
                  className="cursor-pointer font-bold text-primary hover:underline"
                >
                  Đăng ký miễn phí
                </button>
              </>
            ) : (
              <>
                Đã có tài khoản?{" "}
                <button
                  type="button"
                  onClick={() => handleTabChange("login")}
                  className="cursor-pointer font-bold text-primary hover:underline"
                >
                  Đăng nhập tại đây
                </button>
              </>
            )}
          </div>
        </div>

        {/* Footnote */}
        <p className="mt-6 text-center text-xs text-slate-400 leading-relaxed">
          Học liệu ôn thi Final Exam dành cho sinh viên FPT University
          <br />
          Hòa Lạc · TP.HCM · Đà Nẵng · Cần Thơ · Quy Nhơn
        </p>
      </div>

      {/* Bottom Legal Notice */}
      <footer className="w-full text-center text-[11px] text-slate-400">
        © 2026 OnThiLab. Tất cả đáp án và điểm số phục vụ mục đích tham khảo học
        tập.
      </footer>
    </main>
  );
}

export function RegisterPage() {
  return <LoginPage initialMode="register" />;
}

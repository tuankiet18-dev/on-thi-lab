import { Navigate } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  GraduationCap,
  LockKeyhole,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { webConfig } from "../lib/config";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
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

export function LoginPage() {
  const { configured, status, signIn } = useAuth();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState<"google" | "cognito">();

  if (status === "authenticated") {
    return <Navigate to="/" replace />;
  }

  const beginSignIn = async (provider?: "Google") => {
    setError(undefined);
    setPending(provider ? "google" : "cognito");
    try {
      await signIn(provider);
    } catch (reason) {
      setPending(undefined);
      setError(
        reason instanceof Error
          ? reason.message
          : "Không thể bắt đầu đăng nhập.",
      );
    }
  };

  return (
    <main className="grid min-h-screen bg-app lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-linear-to-br from-[#15377f] via-primary to-[#5b7ff0] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="relative z-10 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-white/15">
            <GraduationCap size={25} aria-hidden="true" />
          </span>
          <span className="font-heading text-2xl font-bold">
            OnThi<span className="text-blue-200">Lab</span>
          </span>
        </div>
        <div className="relative z-10 max-w-xl">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-200">
            Ôn thi FE hiệu quả
          </p>
          <h1 className="mt-4 font-heading text-4xl font-bold leading-tight xl:text-5xl">
            Bước vào phòng thi với sự chuẩn bị tốt nhất.
          </h1>
          <p className="mt-5 text-lg leading-8 text-blue-100">
            Luyện theo đề thật, đúng thời gian và xem lại đáp án tham khảo sau
            khi nộp bài.
          </p>
          <ul className="mt-8 space-y-4 text-blue-50">
            {[
              "Mô phỏng cấu trúc đề FE thực tế",
              "Theo dõi lịch sử và tiến độ ôn tập",
              "Đáp án được duyệt trước khi xuất bản",
            ].map((item) => (
              <li key={item} className="flex items-center gap-3">
                <CheckCircle2 size={20} className="text-cyan-300" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative z-10 text-sm text-blue-200">
          Điểm số và đáp án chỉ mang tính tham khảo.
        </p>
        <div
          className="absolute -right-28 -top-20 size-96 rounded-full bg-white/10 blur-2xl"
          aria-hidden="true"
        />
      </section>

      <section className="flex items-center justify-center p-5 sm:p-8 lg:p-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="grid size-10 place-items-center rounded-xl bg-primary text-white">
              <GraduationCap size={22} aria-hidden="true" />
            </span>
            <span className="font-heading text-2xl font-bold text-foreground">
              OnThi<span className="text-primary">Lab</span>
            </span>
          </div>

          <div className="rounded-3xl border border-border bg-white p-6 shadow-panel sm:p-8">
            <span className="grid size-12 place-items-center rounded-2xl bg-primary-soft text-primary">
              <BookOpenCheck size={24} aria-hidden="true" />
            </span>
            <h2 className="mt-6 font-heading text-3xl font-bold text-foreground">
              Chào mừng bạn
            </h2>
            <p className="mt-2 leading-7 text-slate-600">
              Đăng nhập để làm bài thi, lưu kết quả và tiếp tục ôn tập trên mọi
              thiết bị.
            </p>

            {!configured ? (
              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                Chế độ đăng nhập chưa được cấu hình trong môi trường này.
              </div>
            ) : (
              <div className="mt-7 space-y-3">
                {webConfig.flags?.googleAuthEnabled && (
                  <button
                    type="button"
                    disabled={Boolean(pending)}
                    onClick={() => void beginSignIn("Google")}
                    className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-3 rounded-xl border border-border-strong bg-white px-4 font-semibold text-slate-700 transition-colors hover:border-primary/40 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
                  >
                    <GoogleIcon />
                    {pending === "google"
                      ? "Đang chuyển hướng..."
                      : "Tiếp tục với Google"}
                  </button>
                )}
                <button
                  type="button"
                  disabled={Boolean(pending)}
                  onClick={() => void beginSignIn()}
                  className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-3 rounded-xl bg-primary px-4 font-bold text-white transition-colors hover:bg-primary-strong disabled:cursor-wait disabled:opacity-60"
                >
                  <LockKeyhole size={19} aria-hidden="true" />
                  {pending === "cognito"
                    ? "Đang chuyển hướng..."
                    : "Đăng nhập bằng email"}
                  {!pending && <ArrowRight size={18} aria-hidden="true" />}
                </button>
              </div>
            )}

            {error && (
              <p
                role="alert"
                className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-danger"
              >
                {error}
              </p>
            )}

            <p className="mt-6 text-center text-xs leading-5 text-slate-500">
              Khi tiếp tục, bạn đồng ý sử dụng OnThiLab cho mục đích học tập và
              hiểu rằng điểm số chỉ mang tính tham khảo.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

import { Link, Navigate } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpenCheck,
  Clock3,
  GraduationCap,
  LockKeyhole,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { webConfig } from "../lib/config";

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

const features = [
  {
    icon: Clock3,
    title: "Mô phỏng đề thi thực tế",
    description:
      "Cấu trúc đề FE chuẩn form, bấm giờ thời gian thực như thi thật.",
  },
  {
    icon: BookOpenCheck,
    title: "Đáp án kiểm duyệt kỹ lưỡng",
    description: "Được thẩm định học thuật và đối chiếu trước khi xuất bản.",
  },
  {
    icon: TrendingUp,
    title: "Thống kê & theo dõi tiến độ",
    description:
      "Nhận diện điểm mạnh và các chủ đề cần củng cố sau mỗi lần thi.",
  },
];

export function LoginPage() {
  const { configured, status, signIn } = useAuth();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState<"google" | "cognito">();

  useEffect(() => {
    const resetPending = () => setPending(undefined);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") resetPending();
    };

    // Cognito runs on another origin. When the user returns using Back or
    // closes the hosted login page, the browser may restore this route from
    // bfcache with the previous React state still intact.
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
    <main className="grid min-h-screen bg-app lg:grid-cols-[1.1fr_0.9fr]">
      {/* Left Brand Showcase Section (Soft UI Hero) */}
      <section className="relative hidden overflow-hidden bg-linear-to-br from-[#0e214d] via-[#1d4ed8] to-[#2563eb] p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
        {/* Top Header Branding */}
        <div className="relative z-10 flex items-center justify-between">
          <Link
            to="/"
            className="flex cursor-pointer items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-blue-300"
          >
            <img
              src="/logo.png"
              alt="OnThiLab Mascot"
              className="size-11 object-contain drop-shadow-sm transition-transform hover:scale-105"
            />
            <span className="font-heading text-2xl font-bold tracking-tight">
              OnThi<span className="text-blue-200">Lab</span>
            </span>
          </Link>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-blue-100 backdrop-blur-md">
            <Sparkles
              size={13}
              className="text-yellow-300"
              aria-hidden="true"
            />
            Luyện thi FE FPT
          </span>
        </div>

        {/* Center Content & Value Proposition */}
        <div className="relative z-10 my-auto max-w-xl py-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-300/25 bg-blue-400/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-blue-200">
            <span>Nền tảng luyện thi chuẩn đề</span>
          </div>

          <h1 className="mt-4 font-heading text-3xl font-bold leading-tight text-white xl:text-4xl">
            Bước vào phòng thi với sự chuẩn bị tốt nhất.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-blue-100/90 xl:text-lg">
            Luyện theo đề thật, đúng thời gian và xem lại lời giải chi tiết sau
            khi nộp bài để bứt phá điểm số.
          </p>

          {/* Feature Showcase Cards (Soft UI Cards) */}
          <div className="mt-8 space-y-3.5">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="flex items-start gap-3.5 rounded-2xl border border-white/15 bg-white/10 p-3.5 backdrop-blur-md transition-all duration-200 hover:border-white/25 hover:bg-white/15"
              >
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/20 text-cyan-200">
                  <feature.icon size={20} aria-hidden="true" />
                </div>
                <div>
                  <h2 className="font-heading text-sm font-bold text-white">
                    {feature.title}
                  </h2>
                  <p className="mt-0.5 text-xs leading-relaxed text-blue-100/80">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Meta */}
        <div className="relative z-10 flex items-center justify-between text-xs text-blue-200/90">
          <span className="flex items-center gap-1.5">
            <GraduationCap size={15} aria-hidden="true" />
            Học liệu dành cho sinh viên
          </span>
          <span>© 2026 OnThiLab</span>
        </div>

        {/* Ambient Decorative Gradient Orbs */}
        <div
          className="absolute -right-20 -top-20 size-80 rounded-full bg-cyan-400/20 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-24 -left-20 size-96 rounded-full bg-blue-900/40 blur-3xl"
          aria-hidden="true"
        />
      </section>

      {/* Right Authentication Panel */}
      <section className="flex items-center justify-center p-5 sm:p-8 lg:p-12">
        <div className="w-full max-w-md">
          {/* Mobile Header Logo */}
          <div className="mb-6 flex items-center justify-between lg:hidden">
            <Link
              to="/"
              className="flex items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25"
            >
              <img
                src="/logo.png"
                alt="OnThiLab Mascot"
                className="size-10 object-contain drop-shadow-sm"
              />
              <span className="font-heading text-2xl font-bold text-foreground">
                OnThi<span className="text-primary">Lab</span>
              </span>
            </Link>
          </div>

          {/* Main Auth Card */}
          <div className="rounded-3xl border border-border bg-white p-7 shadow-panel sm:p-9">
            {/* Header Icon */}
            <div className="grid size-12 place-items-center rounded-2xl bg-primary-soft text-primary shadow-xs">
              <BookOpenCheck size={24} aria-hidden="true" />
            </div>

            {/* Kicker & Title */}
            <p className="section-kicker mt-5">Cổng đăng nhập</p>
            <h2 className="mt-1.5 font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Chào mừng bạn
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Đăng nhập để làm bài thi, xem phân tích kết quả và đồng bộ tiến độ
              trên mọi thiết bị.
            </p>

            {!configured ? (
              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                Chế độ đăng nhập chưa được cấu hình trong môi trường này.
              </div>
            ) : (
              <div className="mt-7 space-y-3.5">
                {/* Google Sign In Button */}
                {webConfig.flags?.googleAuthEnabled && (
                  <button
                    type="button"
                    disabled={Boolean(pending)}
                    onClick={() => void beginSignIn("Google")}
                    className="group flex min-h-12 w-full cursor-pointer items-center justify-center gap-3 rounded-xl border border-border-strong bg-white px-4 text-sm font-semibold text-slate-700 shadow-xs transition-all duration-200 hover:border-primary/40 hover:bg-slate-50 hover:shadow-sm active:scale-[0.99] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25 disabled:cursor-wait disabled:opacity-60"
                  >
                    <GoogleIcon />
                    <span>
                      {pending === "google"
                        ? "Đang chuyển hướng..."
                        : "Tiếp tục với Google"}
                    </span>
                  </button>
                )}

                {/* Cognito Email Sign In Button */}
                <button
                  type="button"
                  disabled={Boolean(pending)}
                  onClick={() => void beginSignIn()}
                  className="group flex min-h-12 w-full cursor-pointer items-center justify-center gap-3 rounded-xl bg-primary px-4 text-sm font-bold text-white shadow-sm transition-all duration-200 hover:bg-primary-strong hover:shadow-md hover:shadow-primary/20 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25 disabled:cursor-wait disabled:opacity-60"
                >
                  <LockKeyhole size={18} aria-hidden="true" />
                  <span>
                    {pending === "cognito"
                      ? "Đang chuyển hướng..."
                      : "Đăng nhập bằng email"}
                  </span>
                  {!pending && (
                    <ArrowRight
                      size={18}
                      aria-hidden="true"
                      className="transition-transform duration-200 group-hover:translate-x-0.5"
                    />
                  )}
                </button>
              </div>
            )}

            {/* Error Feedback */}
            {error && (
              <p
                role="alert"
                className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-danger shadow-xs"
              >
                {error}
              </p>
            )}

            {/* Terms Footnote */}
            <p className="mt-6 text-center text-xs leading-5 text-slate-400">
              Khi tiếp tục, bạn đồng ý với Điều khoản sử dụng của OnThiLab và
              hiểu rằng điểm số chỉ mang tính tham khảo.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

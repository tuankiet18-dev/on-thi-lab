import {
  Archive,
  BarChart3,
  Bookmark,
  BookOpenCheck,
  ChevronDown,
  ClipboardList,
  FileText,
  FileUp,
  GraduationCap,
  LogIn,
  LogOut,
  LayoutDashboard,
  Menu,
  MessageSquareText,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { Link, Navigate, Outlet, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { cn } from "../lib/cn";
import { FeedbackDialog } from "./FeedbackDialog";

const navigation = [
  { label: "Tổng quan", to: "/", icon: LayoutDashboard },
  { label: "Kho đề thi", to: "/exams", icon: BookOpenCheck },
  { label: "Đề đã lưu", to: "/bookmarks", icon: Bookmark },
  { label: "Lịch sử làm bài", to: "/history", icon: ClipboardList },
  { label: "Thống kê", to: "/statistics", icon: BarChart3 },
];

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const { configured, error, session, signOut, status, studentProfile } =
    useAuth();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const isPublicAuthPage =
    pathname === "/login" || pathname === "/auth/callback";
  const isFocusMode = pathname.startsWith("/attempts/");
  const isAdmin =
    !configured ||
    studentProfile?.role === "admin" ||
    session?.user.groups.includes("admin") === true;
  const canContribute =
    isAdmin ||
    studentProfile?.role === "contributor" ||
    session?.user.groups.includes("contributor") === true;

  if (isPublicAuthPage) {
    return <Outlet />;
  }

  if (configured && status === "loading") {
    return (
      <div className="grid min-h-screen place-items-center bg-app">
        <p className="font-semibold text-slate-600">
          Đang kiểm tra phiên đăng nhập...
        </p>
      </div>
    );
  }

  if (configured && status === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }

  if (configured && status === "error") {
    return (
      <main className="grid min-h-dvh place-items-center bg-app p-5">
        <section className="w-full max-w-lg rounded-3xl border border-border bg-white p-8 text-center shadow-panel">
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Chưa thể tải hồ sơ
          </h1>
          <p className="mt-3 leading-7 text-slate-600">
            {error ?? "Kết nối tới API đang tạm thời gián đoạn."}
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="min-h-11 cursor-pointer rounded-xl bg-primary px-5 font-bold text-white hover:bg-primary-strong"
            >
              Thử lại
            </button>
            <button
              type="button"
              onClick={signOut}
              className="min-h-11 cursor-pointer rounded-xl border border-border-strong bg-white px-5 font-semibold text-slate-700 hover:bg-slate-50"
            >
              Đăng xuất
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (
    configured &&
    status === "authenticated" &&
    !studentProfile &&
    pathname !== "/onboarding"
  ) {
    return (
      <Navigate to="/onboarding" search={{ redirect: pathname }} replace />
    );
  }

  if (pathname === "/onboarding") {
    return <Outlet />;
  }

  if (isFocusMode) {
    return <Outlet />;
  }

  return (
    <div className="flex min-h-dvh flex-col bg-app">
      <a
        href="#main-content"
        className="fixed left-4 top-4 z-50 -translate-y-24 rounded-lg bg-foreground px-4 py-2 text-white transition-transform focus:translate-y-0"
      >
        Đi tới nội dung chính
      </a>

      <header className="sticky top-0 z-30 border-b border-border bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="flex cursor-pointer items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25"
            aria-label="OnThiLab - Trang chủ"
          >
            <img
              src="/logo.png"
              alt="OnThiLab Mascot"
              className="size-11 object-contain drop-shadow-sm transition-transform hover:scale-105"
            />
            <span className="font-heading text-xl font-bold tracking-tight text-foreground">
              OnThi<span className="text-primary">Lab</span>
            </span>
          </Link>

          <nav
            className="ml-6 hidden items-center gap-1 lg:flex"
            aria-label="Chính"
          >
            {navigation.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex min-h-10 cursor-pointer items-center gap-2 rounded-xl px-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25"
                activeProps={{
                  className: "bg-primary-soft text-primary",
                }}
                activeOptions={{ exact: item.to === "/" }}
              >
                <item.icon size={17} aria-hidden="true" />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {session ? (
              <div className="relative hidden sm:block">
                <button
                  type="button"
                  onClick={() => setAccountOpen((open) => !open)}
                  className="flex min-h-10 cursor-pointer items-center gap-2 rounded-xl px-2.5 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25"
                  aria-label="Mở menu tài khoản"
                  aria-expanded={accountOpen}
                >
                  <span className="grid size-8 place-items-center rounded-full bg-linear-to-br from-blue-500 to-indigo-600 text-sm font-bold text-white">
                    {initialsFor(session.user.name)}
                  </span>
                  <span className="text-left">
                    <span
                      className="block max-w-36 truncate text-sm font-semibold leading-4 text-foreground"
                      title={session.user.name}
                    >
                      {session.user.name}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {isAdmin ? "Quản trị viên" : "Sinh viên"}
                    </span>
                  </span>
                  <ChevronDown
                    size={16}
                    aria-hidden="true"
                    className="text-slate-400"
                  />
                </button>
                {accountOpen && (
                  <div className="absolute right-0 top-12 w-64 rounded-2xl border border-border bg-white p-2 shadow-modal">
                    <p className="truncate px-3 py-2 text-xs text-slate-500">
                      {session.user.email}
                    </p>
                    <Link
                      to="/profile"
                      onClick={() => setAccountOpen(false)}
                      className="flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      <UserRound size={17} aria-hidden="true" />
                      Hồ sơ của tôi
                    </Link>
                    {canContribute && (
                      <>
                        <div className="my-1 h-px bg-border" />
                        <p className="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                          Quản trị
                        </p>
                        <Link
                          to="/admin/import"
                          onClick={() => setAccountOpen(false)}
                          className="flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          <FileUp size={17} aria-hidden="true" />
                          Nhập đề
                        </Link>
                        <Link
                          to="/admin/drafts"
                          onClick={() => setAccountOpen(false)}
                          className="flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          <FileText size={17} aria-hidden="true" />
                          Đề chờ duyệt
                        </Link>
                        {isAdmin && (
                          <>
                            <Link
                              to="/admin/exams"
                              onClick={() => setAccountOpen(false)}
                              className="flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100"
                            >
                              <Archive size={17} aria-hidden="true" />
                              Kho đề
                            </Link>
                            <Link
                              to="/admin/catalog-management"
                              onClick={() => setAccountOpen(false)}
                              className="flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100"
                            >
                              <GraduationCap size={17} aria-hidden="true" />
                              Môn học
                            </Link>
                            <Link
                              to="/admin/users"
                              onClick={() => setAccountOpen(false)}
                              className="flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100"
                            >
                              <ShieldCheck size={17} aria-hidden="true" />
                              Phân quyền
                            </Link>
                            <Link
                              to="/admin/reports"
                              onClick={() => setAccountOpen(false)}
                              className="flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100"
                            >
                              <MessageSquareText size={17} aria-hidden="true" />
                              Quản lý báo cáo
                            </Link>
                            <Link
                              to="/admin/feedback"
                              onClick={() => setAccountOpen(false)}
                              className="flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100"
                            >
                              <MessageSquareText size={17} aria-hidden="true" />
                              Góp ý người dùng
                            </Link>
                          </>
                        )}
                      </>
                    )}
                    <div className="my-1 h-px bg-border" />
                    <button
                      type="button"
                      onClick={signOut}
                      className="flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      <LogOut size={17} aria-hidden="true" />
                      Đăng xuất
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/login"
                className="hidden min-h-10 cursor-pointer items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white hover:bg-primary-strong sm:flex"
              >
                <LogIn size={17} aria-hidden="true" />
                Đăng nhập
              </Link>
            )}
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="grid size-11 cursor-pointer place-items-center rounded-xl text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25 lg:hidden"
              aria-expanded={menuOpen}
              aria-controls="mobile-navigation"
              aria-label={menuOpen ? "Đóng menu" : "Mở menu"}
            >
              {menuOpen ? (
                <X aria-hidden="true" />
              ) : (
                <Menu aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav
            id="mobile-navigation"
            className="border-t border-border bg-white p-3 lg:hidden"
            aria-label="Di động"
          >
            <div className="mx-auto grid max-w-[1440px] gap-1">
              {navigation.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMenuOpen(false)}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100"
                  activeProps={{ className: "bg-primary-soft text-primary" }}
                  activeOptions={{ exact: item.to === "/" }}
                >
                  <item.icon size={18} aria-hidden="true" />
                  {item.label}
                </Link>
              ))}
              {canContribute && (
                <>
                  <div className="my-1 h-px bg-border" />
                  <p className="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                    Quản trị
                  </p>
                  <Link
                    to="/admin/import"
                    onClick={() => setMenuOpen(false)}
                    className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100"
                  >
                    <FileUp size={18} aria-hidden="true" />
                    Nhập đề
                  </Link>
                  <Link
                    to="/admin/drafts"
                    onClick={() => setMenuOpen(false)}
                    className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100"
                  >
                    <FileText size={18} aria-hidden="true" />
                    Đề chờ duyệt
                  </Link>
                  {isAdmin && (
                    <>
                      <Link
                        to="/admin/catalog-management"
                        onClick={() => setMenuOpen(false)}
                        className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100"
                      >
                        <GraduationCap size={18} aria-hidden="true" />
                        Môn học
                      </Link>
                      <Link
                        to="/admin/exams"
                        onClick={() => setMenuOpen(false)}
                        className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100"
                      >
                        <Archive size={18} aria-hidden="true" />
                        Kho đề
                      </Link>
                      <Link
                        to="/admin/users"
                        onClick={() => setMenuOpen(false)}
                        className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100"
                      >
                        <ShieldCheck size={18} aria-hidden="true" />
                        Phân quyền
                      </Link>
                      <Link
                        to="/admin/reports"
                        onClick={() => setMenuOpen(false)}
                        className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100"
                      >
                        <MessageSquareText size={18} aria-hidden="true" />
                        Quản lý báo cáo
                      </Link>
                      <Link
                        to="/admin/feedback"
                        onClick={() => setMenuOpen(false)}
                        className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100"
                      >
                        <MessageSquareText size={18} aria-hidden="true" />
                        Góp ý người dùng
                      </Link>
                    </>
                  )}
                </>
              )}
              {session ? (
                <>
                  <Link
                    to="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    <UserRound size={18} aria-hidden="true" />
                    Hồ sơ của tôi
                  </Link>
                  <button
                    type="button"
                    onClick={signOut}
                    className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    <LogOut size={18} aria-hidden="true" />
                    Đăng xuất
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  onClick={() => setMenuOpen(false)}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm font-semibold text-primary hover:bg-primary-soft"
                >
                  <LogIn size={18} aria-hidden="true" />
                  Đăng nhập
                </Link>
              )}
            </div>
          </nav>
        )}
      </header>

      <main
        id="main-content"
        className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
      >
        <Outlet />
      </main>

      <footer className="border-t border-border bg-white">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-4 py-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© 2026 OnThiLab. Điểm số chỉ mang tính tham khảo.</p>
          <button
            type="button"
            onClick={() => setFeedbackOpen(true)}
            className="inline-flex cursor-pointer items-center gap-2 self-start rounded-lg font-semibold text-primary transition-colors hover:text-primary-strong focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25"
          >
            <MessageSquareText size={16} aria-hidden="true" />
            Góp ý cho OnThiLab
          </button>
        </div>
      </footer>
      <FeedbackDialog
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
      />
    </div>
  );
}

function initialsFor(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <section className="grid min-h-[55vh] place-items-center">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-5 grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary">
          <ClipboardList size={25} aria-hidden="true" />
        </div>
        <h1 className="font-heading text-2xl font-bold text-foreground">
          {title}
        </h1>
        <p className="mt-2 text-slate-600">
          Module này đã có trong kiến trúc và sẽ được hoàn thiện ở sprint tiếp
          theo.
        </p>
        <Link
          to="/exams"
          className={cn(
            "mt-6 inline-flex min-h-11 cursor-pointer items-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-strong",
          )}
        >
          Mở kho đề thi
        </Link>
      </div>
    </section>
  );
}

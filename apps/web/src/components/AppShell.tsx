import {
  BarChart3,
  BookOpenCheck,
  ChevronDown,
  ClipboardList,
  FileUp,
  GraduationCap,
  LayoutDashboard,
  Menu,
  MessageSquareText,
  X,
} from "lucide-react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { cn } from "../lib/cn";

const navigation = [
  { label: "Tổng quan", to: "/", icon: LayoutDashboard },
  { label: "Kho đề thi", to: "/exams", icon: BookOpenCheck },
  { label: "Lịch sử làm bài", to: "/history", icon: ClipboardList },
  { label: "Thống kê", to: "/statistics", icon: BarChart3 },
];

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const isFocusMode = pathname.startsWith("/attempts/");

  if (isFocusMode) {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen bg-app">
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
            className="flex cursor-pointer items-center gap-2 rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25"
            aria-label="OnThiLab - Trang chủ"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-white shadow-sm">
              <GraduationCap aria-hidden="true" size={21} strokeWidth={2.4} />
            </span>
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
            <Link
              to="/admin/import"
              className="hidden min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-border-strong bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:border-primary/40 hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25 md:flex"
            >
              <FileUp size={17} aria-hidden="true" />
              Nhập đề
            </Link>
            <button
              type="button"
              className="hidden min-h-10 cursor-pointer items-center gap-2 rounded-xl px-2.5 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25 sm:flex"
              aria-label="Mở menu tài khoản"
            >
              <span className="grid size-8 place-items-center rounded-full bg-linear-to-br from-blue-500 to-indigo-600 text-sm font-bold text-white">
                KT
              </span>
              <span className="text-left">
                <span className="block text-sm font-semibold leading-4 text-foreground">
                  Kiet Tran
                </span>
                <span className="block text-xs text-slate-500">Sinh viên</span>
              </span>
              <ChevronDown
                size={16}
                aria-hidden="true"
                className="text-slate-400"
              />
            </button>
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
              <Link
                to="/admin/import"
                onClick={() => setMenuOpen(false)}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100"
              >
                <FileUp size={18} aria-hidden="true" />
                Nhập đề
              </Link>
            </div>
          </nav>
        )}
      </header>

      <main
        id="main-content"
        className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
      >
        <Outlet />
      </main>

      <footer className="border-t border-border bg-white">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-4 py-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© 2026 OnThiLab. Điểm số chỉ mang tính tham khảo.</p>
          <button
            type="button"
            className="inline-flex cursor-pointer items-center gap-2 self-start rounded-lg font-semibold text-primary transition-colors hover:text-primary-strong focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25"
          >
            <MessageSquareText size={16} aria-hidden="true" />
            Góp ý cho OnThiLab
          </button>
        </div>
      </footer>
    </div>
  );
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

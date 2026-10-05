import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock,
  FileCheck,
  FileText,
  MessageSquareText,
  RefreshCw,
  TrendingUp,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { AdminDashboard } from "@onthilab/contracts";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getAdminDashboard } from "../features/admin/api";
import { useAuth } from "../auth/AuthContext";

// ── Types ────────────────────────────────────────────────────────────────────

type DayFilter = 7 | 30 | 90;

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("vi-VN", {
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  href?: string;
  urgent?: boolean;
}

function StatCard({ label, value, icon, href, urgent }: StatCardProps) {
  const inner = (
    <div
      className={`flex items-center gap-4 rounded-2xl border bg-white p-5 transition-shadow hover:shadow-md ${
        urgent && value > 0
          ? "border-amber-300 ring-1 ring-amber-200"
          : "border-slate-200"
      }`}
    >
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
          urgent && value > 0
            ? "bg-amber-50 text-amber-600"
            : "bg-slate-100 text-slate-600"
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="truncate text-sm text-slate-500">{label}</p>
      </div>
    </div>
  );
  return href ? <Link to={href}>{inner}</Link> : inner;
}

interface ActionItemRowProps {
  type: string;
  examCode: string;
  examId: string;
  detail: string;
}

const ACTION_ICON: Record<string, React.ReactNode> = {
  pending_publish: <FileCheck size={16} />,
  missing_answers: <AlertCircle size={16} />,
  ocr_warning: <AlertTriangle size={16} />,
};

const ACTION_LINK: Record<string, string> = {
  pending_publish: "/admin/drafts",
  missing_answers: "/admin/drafts",
  ocr_warning: "/admin/review-ocr",
};

const ACTION_COLOR: Record<string, string> = {
  pending_publish: "bg-blue-50 text-blue-700 border-blue-200",
  missing_answers: "bg-red-50 text-red-700 border-red-200",
  ocr_warning: "bg-amber-50 text-amber-700 border-amber-200",
};

function ActionItemRow({ type, examCode, examId, detail }: ActionItemRowProps) {
  return (
    <Link
      to="/admin/exams/$examId/review"
      params={{ examId }}
      className="flex items-start gap-3 rounded-xl border border-slate-100 px-4 py-3 transition-colors hover:bg-slate-50"
    >
      <span
        className={`mt-0.5 flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${ACTION_COLOR[type] ?? ""}`}
      >
        {ACTION_ICON[type]}
        {examCode}
      </span>
      <p className="text-sm text-slate-700">{detail}</p>
    </Link>
  );
}

interface WidgetCardProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

function WidgetCard({
  title,
  icon,
  children,
  className = "",
}: WidgetCardProps) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white ${className}`}
    >
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
        <span className="text-slate-500">{icon}</span>
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function AdminDashboardPage() {
  const { session } = useAuth();
  const [days, setDays] = useState<DayFilter>(30);
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(
    async (selectedDays: DayFilter) => {
      if (!session?.idToken) return;
      setLoading(true);
      setError(null);
      try {
        const result = await getAdminDashboard(session.idToken, selectedDays);
        setData(result);
      } catch {
        setError("Không thể tải dữ liệu dashboard. Vui lòng thử lại.");
      } finally {
        setLoading(false);
      }
    },
    [session?.idToken],
  );

  useEffect(() => {
    void load(days);
  }, [load, days]);

  // Auto-refresh when tab is visible, every 60 seconds
  useEffect(() => {
    const startInterval = () => {
      intervalRef.current = setInterval(() => {
        if (!document.hidden) void load(days);
      }, 60_000);
    };
    startInterval();
    const onVisibilityChange = () => {
      if (!document.hidden) {
        void load(days);
        if (intervalRef.current) clearInterval(intervalRef.current);
        startInterval();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [load, days]);

  const DAY_OPTIONS: { value: DayFilter; label: string }[] = [
    { value: 7, label: "7 ngày" },
    { value: 30, label: "30 ngày" },
    { value: 90, label: "90 ngày" },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] px-4 py-8 md:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Tổng quan quản trị
          </h1>
          {data && (
            <p className="mt-1 text-xs text-slate-400">
              Cập nhật lúc {formatDateTime(data.asOf)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Day filter */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1">
            {DAY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDays(opt.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  days === opt.value
                    ? "bg-blue-600 text-white"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void load(days)}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Làm mới
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-slate-100"
            />
          ))}
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Quick Stats */}
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Chỉ số nhanh
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
              <StatCard
                label="Chờ xuất bản"
                value={data.quickStats.pendingReview}
                icon={<Clock size={20} />}
                href="/admin/drafts"
                urgent
              />
              <StatCard
                label="Báo lỗi mở"
                value={data.quickStats.openReports}
                icon={<AlertCircle size={20} />}
                href="/admin/reports"
                urgent
              />
              <StatCard
                label="Góp ý mới"
                value={data.quickStats.newFeedback}
                icon={<MessageSquareText size={20} />}
                href="/admin/feedback"
                urgent
              />
              <StatCard
                label="Đề đã xuất bản"
                value={data.quickStats.publishedExams}
                icon={<BookOpen size={20} />}
                href="/admin/exams"
              />
              <StatCard
                label={`Lượt hoàn tất (${days}N)`}
                value={data.quickStats.completedAttempts}
                icon={<CheckCircle2 size={20} />}
              />
              <StatCard
                label={`Người làm đề (${days}N)`}
                value={data.quickStats.activeUsers}
                icon={<Users size={20} />}
              />
            </div>
          </section>

          {/* Action items + Usage chart */}
          <div className="grid gap-6 lg:grid-cols-5">
            {/* Action items — given priority by taking more columns on wide screens */}
            <WidgetCard
              title="Việc cần xử lý"
              icon={<AlertCircle size={16} />}
              className="lg:col-span-2"
            >
              {data.actionItems.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-slate-400">
                  <CheckCircle2 size={28} className="text-green-400" />
                  <span>Không có việc cần xử lý</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {data.actionItems.map((item, idx) => (
                    <ActionItemRow key={idx} {...item} />
                  ))}
                </div>
              )}
            </WidgetCard>

            {/* Usage trend chart */}
            <WidgetCard
              title={`Sử dụng ${days} ngày gần nhất`}
              icon={<TrendingUp size={16} />}
              className="lg:col-span-3"
            >
              {data.usageTrend.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">
                  Chưa có dữ liệu
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={data.usageTrend.map((pt) => ({
                      ...pt,
                      date: formatDate(pt.date),
                    }))}
                    barSize={6}
                    barGap={2}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid #e2e8f0",
                        boxShadow: "0 2px 8px rgba(0,0,0,.06)",
                        fontSize: 12,
                      }}
                    />
                    <Bar
                      dataKey="started"
                      name="Bắt đầu"
                      fill="#93c5fd"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="completed"
                      name="Hoàn tất"
                      fill="#1d4ed8"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="newUsers"
                      name="Người mới"
                      fill="#f59e0b"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </WidgetCard>
          </div>

          {/* Content quality */}
          <div className="grid gap-6 md:grid-cols-3">
            {/* Reports by category */}
            <WidgetCard
              title="Báo lỗi theo loại"
              icon={<BarChart3 size={16} />}
            >
              {data.contentQuality.reportsByCategory.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-400">
                  Không có báo lỗi nào
                </p>
              ) : (
                <ul className="space-y-2">
                  {data.contentQuality.reportsByCategory.map((row) => (
                    <li
                      key={row.category}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-slate-600">{row.category}</span>
                      <span className="font-semibold text-slate-900">
                        {row.count}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </WidgetCard>

            {/* Top exams */}
            <WidgetCard
              title={`Đề làm nhiều nhất (${days}N)`}
              icon={<TrendingUp size={16} />}
            >
              {data.contentQuality.topExams.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-400">
                  Chưa có lượt làm
                </p>
              ) : (
                <ul className="space-y-2">
                  {data.contentQuality.topExams.map((row, idx) => (
                    <li key={row.examId} className="flex items-center gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                        {idx + 1}
                      </span>
                      <Link
                        to="/exams/$examId"
                        params={{ examId: row.examId }}
                        className="flex-1 truncate text-sm font-medium text-blue-700 hover:underline"
                      >
                        {row.examCode}
                      </Link>
                      <span className="text-sm font-semibold text-slate-900">
                        {row.attempts}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </WidgetCard>

            {/* Unpopular exams */}
            <WidgetCard
              title={`Đề chưa có lượt làm (${days}N)`}
              icon={<FileText size={16} />}
            >
              {data.contentQuality.unpopularExams.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-400">
                  Tất cả đề đều có lượt làm
                </p>
              ) : (
                <ul className="space-y-2">
                  {data.contentQuality.unpopularExams.map((row) => (
                    <li key={row.examId}>
                      <Link
                        to="/exams/$examId"
                        params={{ examId: row.examId }}
                        className="block rounded-lg px-2 py-1 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        {row.examCode}
                        <span className="ml-2 text-xs font-normal text-slate-400">
                          xuất bản {formatDate(row.publishedAt)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </WidgetCard>
          </div>
        </div>
      )}
    </div>
  );
}

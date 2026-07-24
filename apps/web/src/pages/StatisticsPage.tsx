import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Badge } from "../components/ui/Badge";
import { getStudentStatistics } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
export function StatisticsPage() {
  const { session } = useAuth();

  const {
    data: stats,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["statistics", session?.idToken],
    queryFn: async () => {
      if (!session) throw new Error("Unauthorized");
      return getStudentStatistics(session.idToken);
    },
    enabled: !!session,
  });

  if (isError) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-900">
          <h3 className="font-semibold">Đã có lỗi xảy ra</h3>
          <p className="mt-2 text-sm">
            {error instanceof Error ? error.message : "Không thể tải thống kê."}
          </p>
          <button
            onClick={() => refetch()}
            className="mt-4 rounded-lg bg-rose-100 px-4 py-2 text-sm font-medium hover:bg-rose-200"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="mx-auto max-w-5xl animate-pulse space-y-6">
        <div className="h-10 w-1/3 rounded-lg bg-slate-200" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="h-32 rounded-xl bg-slate-200" />
          <div className="h-32 rounded-xl bg-slate-200" />
          <div className="h-32 rounded-xl bg-slate-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header>
        <h1 className="font-heading text-3xl font-bold text-slate-900">
          Thống kê học tập
        </h1>
        <p className="mt-2 text-slate-600">
          Tổng quan về quá trình làm bài và điểm số của bạn.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="flex flex-col rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/50">
          <span className="text-sm font-medium text-slate-500">
            Tổng số bài đã nộp
          </span>
          <span className="mt-2 font-heading text-4xl font-semibold text-slate-900">
            {stats.totalAttempts}
          </span>
        </div>
        <div className="flex flex-col rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/50">
          <span className="text-sm font-medium text-slate-500">
            Điểm số trung bình
          </span>
          <span className="mt-2 font-heading text-4xl font-semibold text-slate-900">
            {stats.averageScore !== null ? stats.averageScore.toFixed(2) : "--"}
          </span>
        </div>
        <div className="flex flex-col rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/50">
          <span className="text-sm font-medium text-slate-500">
            Điểm số cao nhất
          </span>
          <span className="mt-2 font-heading text-4xl font-semibold text-slate-900">
            {stats.highestScore !== null ? stats.highestScore.toFixed(2) : "--"}
          </span>
        </div>
      </div>

      <section>
        <h2 className="font-heading text-xl font-semibold text-slate-900 mb-4">
          Lịch sử bài làm gần đây
        </h2>
        {stats.recentAttempts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center">
            <h3 className="font-heading text-lg font-medium text-slate-900">
              Chưa có dữ liệu
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              Bạn chưa hoàn thành bài thi nào. Hãy bắt đầu luyện tập ngay nhé!
            </p>
            <Link
              to="/exams"
              className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Chọn đề thi
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/50">
            <ul className="divide-y divide-slate-100">
              {stats.recentAttempts.map((attempt) => (
                <li
                  key={attempt.id}
                  className="flex items-center justify-between p-4 hover:bg-slate-50"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {attempt.examCode}
                    </p>
                    <p className="text-sm text-slate-500">
                      Nộp lúc:{" "}
                      {attempt.submittedAt
                        ? new Date(attempt.submittedAt).toLocaleString("vi-VN")
                        : "--"}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    {attempt.score !== null && (
                      <Badge tone={attempt.score >= 5 ? "green" : "pink"}>
                        {attempt.score.toFixed(2)} điểm
                      </Badge>
                    )}
                    <Link
                      to={`/results/$attemptId`}
                      params={{ attemptId: attempt.id }}
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                    >
                      Xem chi tiết &rarr;
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {stats.recentAttempts.length > 0 && (
        <section>
          <h2 className="font-heading text-xl font-semibold text-slate-900 mb-4">
            Tiến độ điểm số
          </h2>
          <div className="h-80 w-full rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/50">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={[...stats.recentAttempts]
                  .reverse()
                  .filter((a) => a.score !== null)
                  .map((a) => ({
                    name: a.examCode,
                    score: a.score,
                    date: a.submittedAt
                      ? new Date(a.submittedAt).toLocaleDateString("vi-VN")
                      : "",
                  }))}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e2e8f0"
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  dy={10}
                />
                <YAxis
                  domain={[0, 10]}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "none",
                    boxShadow:
                      "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
                  }}
                  labelStyle={{
                    fontWeight: 600,
                    color: "#0f172a",
                    marginBottom: "4px",
                  }}
                  formatter={(value: number) => [
                    `${value.toFixed(2)} điểm`,
                    "Điểm số",
                  ]}
                  labelFormatter={(label, payload) => {
                    const date = payload[0]?.payload.date;
                    return date ? `${label} (${date})` : label;
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#4f46e5"
                  strokeWidth={3}
                  activeDot={{ r: 6, strokeWidth: 0, fill: "#4f46e5" }}
                  dot={{
                    r: 4,
                    strokeWidth: 2,
                    fill: "#fff",
                    stroke: "#4f46e5",
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}
    </div>
  );
}

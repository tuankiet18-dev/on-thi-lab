import { useEffect, useState, useMemo } from "react";
import { Link, Navigate } from "@tanstack/react-router";
import {
  FileText,
  ArrowRight,
  Loader2,
  Calendar,
  Trash2,
  Search,
  Filter,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { getAllAdminExams, deleteExam } from "../lib/api";
import type { AdminExamSummary } from "@onthilab/contracts";

export function AdminExamsPage() {
  const { session, studentProfile, configured } = useAuth();
  const [exams, setExams] = useState<AdminExamSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [deletingId, setDeletingId] = useState<string>();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const canContribute =
    !configured ||
    studentProfile?.role === "admin" ||
    studentProfile?.role === "contributor" ||
    session?.user.groups.some((group) =>
      ["admin", "contributor"].includes(group),
    );

  useEffect(() => {
    if (!session || !canContribute) return;

    setLoading(true);
    getAllAdminExams(session.idToken)
      .then(setExams)
      .catch(() => setError("Không thể tải danh sách kho đề."))
      .finally(() => setLoading(false));
  }, [session, canContribute]);

  const handleDelete = async (
    examId: string,
    examCode: string,
    status: string,
  ) => {
    if (!session) return;
    const isPublished = status === "published";
    const msg = isPublished
      ? `Đề ${examCode} đã được xuất bản. Việc xóa sẽ chuyển trạng thái của đề thành "Đã hủy" (cancelled) để không ảnh hưởng đến lịch sử làm bài. Bạn có chắc chắn không?`
      : `Bạn có chắc chắn muốn xóa hoàn toàn đề nháp ${examCode} không? Hành động này không thể hoàn tác.`;

    if (!window.confirm(msg)) return;

    try {
      setDeletingId(examId);
      await deleteExam(examId, session.idToken);
      if (isPublished) {
        setExams((prev) =>
          prev.map((d) =>
            d.id === examId ? { ...d, status: "cancelled" } : d,
          ),
        );
      } else {
        setExams((prev) => prev.filter((d) => d.id !== examId));
      }
    } catch (e) {
      alert("Đã xảy ra lỗi khi xóa đề thi.");
    } finally {
      setDeletingId(undefined);
    }
  };

  const filteredExams = useMemo(() => {
    return exams.filter((exam) => {
      const matchesSearch =
        exam.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        exam.courseCode.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || exam.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [exams, searchQuery, statusFilter]);

  if (!canContribute) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="section-kicker">Quản lý Đề thi</p>
        <h1 className="section-title">Kho đề</h1>
        <p className="mt-2 text-slate-500">
          Quản lý tất cả đề thi có trong hệ thống bao gồm đề nháp, đã xuất bản
          và đã hủy.
        </p>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={18}
          />
          <input
            type="text"
            placeholder="Tìm kiếm theo mã đề hoặc môn học..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="text-slate-400" size={18} />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white py-2.5 pl-3 pr-8 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="published">Đã xuất bản</option>
            <option value="draft">Đang nháp</option>
            <option value="review">Chờ duyệt</option>
            <option value="cancelled">Đã hủy</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="animate-spin text-slate-400" size={32} />
        </div>
      ) : filteredExams.length === 0 ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center bg-white">
          <FileText size={48} className="text-slate-300" />
          <h3 className="mt-4 font-heading text-lg font-bold text-slate-700">
            Không tìm thấy đề thi
          </h3>
          <p className="mt-2 text-slate-500">
            Không có đề thi nào phù hợp với điều kiện lọc hoặc hệ thống chưa có
            đề thi nào.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-6 py-4 font-heading font-bold">Mã Đề</th>
                <th className="px-6 py-4 font-heading font-bold">Môn học</th>
                <th className="px-6 py-4 font-heading font-bold">Người tạo</th>
                <th className="px-6 py-4 font-heading font-bold">Thời gian</th>
                <th className="px-6 py-4 font-heading font-bold">Trạng thái</th>
                <th className="px-6 py-4 text-right font-heading font-bold">
                  Hành động
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExams.map((exam) => (
                <tr
                  key={exam.id}
                  className={`group transition-colors hover:bg-slate-50 ${exam.status === "cancelled" ? "opacity-60 grayscale" : ""}`}
                >
                  <td className="px-6 py-4 font-bold text-slate-900">
                    {exam.code}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                      {exam.courseCode}
                    </span>
                    <span className="ml-2 text-xs text-slate-500">
                      {exam.semester}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {exam.creatorName}
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={14} />
                      {new Date(exam.createdAt).toLocaleDateString("vi-VN")}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {exam.status === "draft" && (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                        Đang nháp
                      </span>
                    )}
                    {exam.status === "review" && (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                        Chờ duyệt
                      </span>
                    )}
                    {exam.status === "published" && (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                        Đã xuất bản
                      </span>
                    )}
                    {exam.status === "cancelled" && (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                        Đã hủy
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      {(exam.status === "draft" ||
                        exam.status === "review") && (
                        <Link
                          to="/admin/exams/$examId/review"
                          params={{ examId: exam.id }}
                          className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"
                        >
                          Duyệt
                        </Link>
                      )}

                      {exam.status === "published" && (
                        <Link
                          to="/exams/$examId"
                          params={{ examId: exam.id }}
                          className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"
                        >
                          Xem
                        </Link>
                      )}
                      {exam.status !== "cancelled" && (
                        <button
                          type="button"
                          title="Xóa đề này"
                          disabled={deletingId === exam.id}
                          onClick={() =>
                            handleDelete(exam.id, exam.code, exam.status)
                          }
                          className="text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors"
                        >
                          {deletingId === exam.id ? (
                            <Loader2 size={18} className="animate-spin" />
                          ) : (
                            <Trash2 size={18} />
                          )}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

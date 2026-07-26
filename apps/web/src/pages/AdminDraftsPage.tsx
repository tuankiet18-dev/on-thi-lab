import { useEffect, useState } from "react";
import { Link, Navigate } from "@tanstack/react-router";
import { FileText, ArrowRight, Loader2, Calendar, Trash2 } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { getDraftExams, deleteExam } from "../lib/api";
import type { AdminExamSummary } from "@onthilab/contracts";

export function AdminDraftsPage() {
  const { session, studentProfile, configured } = useAuth();
  const [drafts, setDrafts] = useState<AdminExamSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [deletingId, setDeletingId] = useState<string>();

  const handleDelete = async (examId: string, examCode: string) => {
    if (!session) return;
    if (
      !window.confirm(
        `Bạn có chắc chắn muốn xóa đề nháp ${examCode} không? Hành động này không thể hoàn tác.`,
      )
    )
      return;

    try {
      setDeletingId(examId);
      await deleteExam(examId, session.idToken);
      setDrafts((prev) => prev.filter((d) => d.id !== examId));
    } catch (e) {
      alert("Đã xảy ra lỗi khi xóa đề thi.");
    } finally {
      setDeletingId(undefined);
    }
  };

  const canContribute =
    !configured ||
    studentProfile?.role === "admin" ||
    studentProfile?.role === "contributor" ||
    session?.user.groups.some((group) =>
      ["admin", "contributor"].includes(group),
    );
  const isAdmin =
    !configured ||
    studentProfile?.role === "admin" ||
    session?.user.groups.includes("admin") === true;

  useEffect(() => {
    if (!session || !canContribute) return;

    setLoading(true);
    getDraftExams(session.idToken)
      .then(setDrafts)
      .catch(() => setError("Không thể tải danh sách đề chờ duyệt."))
      .finally(() => setLoading(false));
  }, [session, canContribute]);

  if (!canContribute) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="section-kicker">Quản lý Đề thi</p>
        <h1 className="section-title">Đề chờ duyệt</h1>
        <p className="mt-2 text-slate-500">
          Danh sách các đề đã được nhập vào hệ thống nhưng chưa được xuất bản.
        </p>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="animate-spin text-slate-400" size={32} />
        </div>
      ) : drafts.length === 0 ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center">
          <FileText size={48} className="text-slate-300" />
          <h3 className="mt-4 font-heading text-lg font-bold text-slate-700">
            Không có đề chờ duyệt
          </h3>
          <p className="mt-2 text-slate-500">
            Tất cả các đề nhập vào đều đã được xuất bản hoặc hiện hệ thống chưa
            có đề nháp nào.
          </p>
          <Link
            to="/admin/import"
            className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"
          >
            Nhập đề mới <ArrowRight size={16} />
          </Link>
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
              {drafts.map((draft) => (
                <tr
                  key={draft.id}
                  className="group transition-colors hover:bg-slate-50"
                >
                  <td className="px-6 py-4 font-bold text-slate-900">
                    {draft.code}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                      {draft.courseCode}
                    </span>
                    <span className="ml-2 text-xs text-slate-500">
                      {draft.semester}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {draft.creatorName}
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={14} />
                      {new Date(draft.createdAt).toLocaleDateString("vi-VN")}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {draft.status === "draft" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                        Đang nháp
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                        Đang duyệt
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        to="/admin/exams/$examId/review"
                        params={{ examId: draft.id }}
                        className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"
                      >
                        Tiếp tục duyệt <ArrowRight size={16} />
                      </Link>
                      {isAdmin && (
                        <button
                          type="button"
                          title="Xóa đề này"
                          disabled={deletingId === draft.id}
                          onClick={() => handleDelete(draft.id, draft.code)}
                          className="text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors"
                        >
                          {deletingId === draft.id ? (
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

import { Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { Report } from "@onthilab/contracts";
import {
  Check,
  CheckCircle2,
  Maximize2,
  MessageSquareWarning,
  X,
} from "lucide-react";
import { ImageViewerModal } from "../components/ImageViewerModal";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { cn } from "../lib/cn";
import { listReports, resolveReport } from "../lib/api";
import { questionImageUrl } from "../lib/question-image-url";

function ReportCard({
  report,
  onResolve,
  resolving,
}: {
  report: Report;
  onResolve: (
    reportId: string,
    status: "resolved" | "rejected",
    correctOptions?: number[],
  ) => void;
  resolving: boolean;
}) {
  const [correctOptions, setCorrectOptions] = useState<number[]>(
    report.question?.correctOptions ?? [],
  );
  const [imageExpanded, setImageExpanded] = useState(false);

  const toggleOption = (index: number) => {
    if (report.question?.type === "single") {
      setCorrectOptions([index]);
    } else {
      setCorrectOptions((prev) =>
        prev.includes(index)
          ? prev.filter((i) => i !== index)
          : [...prev, index].sort((a, b) => a - b),
      );
    }
  };

  return (
    <>
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-border bg-white px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="font-heading text-lg font-bold text-slate-800">
              {report.question
                ? `${report.question.courseCode} · Đề ${report.question.examCode}`
                : "Báo cáo lỗi"}
            </span>
          </div>
          <span className="text-sm font-medium text-slate-500">
            {new Intl.DateTimeFormat("vi-VN", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(report.createdAt))}
          </span>
        </div>

        <div className="flex flex-col lg:flex-row">
          {report.question ? (
            <div className="flex-1 bg-slate-50 p-4 sm:p-6">
              <button
                type="button"
                onClick={() => setImageExpanded(true)}
                className="group relative block w-full cursor-zoom-in rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25"
                aria-label="Phóng to ảnh câu hỏi"
              >
                <img
                  src={questionImageUrl(report.question.imageUrl)}
                  alt="Câu hỏi bị báo lỗi"
                  className="min-h-32 w-full rounded-xl border border-border bg-white object-contain sm:max-h-[350px]"
                />
                <span className="absolute bottom-2 right-2 inline-flex min-h-10 items-center gap-2 rounded-lg bg-slate-950/75 px-3 text-xs font-semibold text-white opacity-100 backdrop-blur-sm transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100">
                  <Maximize2 size={15} aria-hidden="true" />
                  Phóng to
                </span>
              </button>
            </div>
          ) : (
            <div className="flex-1 bg-slate-50 p-6 text-sm text-slate-500">
              Không thể tải dữ liệu câu hỏi.
            </div>
          )}

          <div className="flex w-full flex-col justify-between border-t border-border bg-white p-4 sm:p-6 lg:w-[340px] lg:border-l lg:border-t-0">
            <div className="space-y-6">
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-700">
                  Sinh viên phản hồi:
                </p>
                <div className="flex gap-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 border border-amber-100/50">
                  <MessageSquareWarning
                    className="mt-0.5 shrink-0 text-amber-600"
                    size={16}
                  />
                  <p className="leading-relaxed">{report.detail}</p>
                </div>
              </div>

              {report.question && (
                <div>
                  <p className="mb-2 text-sm font-semibold text-slate-700">
                    Sửa đáp án đúng:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(report.question.options?.length > 0
                      ? report.question.options
                      : Array.from({ length: 4 })
                    ).map((_, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => toggleOption(index)}
                        className={cn(
                          "flex h-11 w-11 items-center justify-center rounded-lg border-2 font-heading text-lg font-bold transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25",
                          correctOptions.includes(index)
                            ? "border-primary bg-primary text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:border-primary/50 hover:bg-primary/5",
                        )}
                      >
                        {String.fromCharCode(65 + index)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row lg:flex-col pt-4 border-t border-border">
              <Button
                icon={<Check size={18} />}
                onClick={() => onResolve(report.id, "resolved", correctOptions)}
                disabled={resolving}
                className="w-full"
              >
                Xác nhận lỗi
              </Button>
              <Button
                variant="secondary"
                icon={<X size={18} />}
                onClick={() => onResolve(report.id, "rejected")}
                disabled={resolving}
                className="w-full"
              >
                Từ chối
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {report.question && (
        <ImageViewerModal
          isOpen={imageExpanded}
          onClose={() => setImageExpanded(false)}
          imageUrl={questionImageUrl(report.question.imageUrl)}
          imageAlt="Ảnh câu hỏi báo lỗi"
          title={`Câu hỏi: ${report.question.courseCode} · Đề ${report.question.examCode}`}
          subtitle="Chế độ xem chi tiết câu hỏi báo lỗi"
        />
      )}
    </>
  );
}

export function AdminReportPage() {
  const { session } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }

    let active = true;
    void listReports(session.idToken)
      .then((result) => {
        if (active) setReports(result);
      })
      .catch(() => {
        if (active) setError("Không thể tải danh sách báo cáo.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [session]);

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  const handleResolve = async (
    reportId: string,
    status: "resolved" | "rejected",
    correctOptions?: number[],
  ) => {
    setResolvingId(reportId);
    try {
      const resolved = await resolveReport(session.idToken, reportId, {
        status,
        resolution: status === "resolved" ? "Đã sửa đáp án." : "Không có lỗi.",
        correctOptions: status === "resolved" ? correctOptions : undefined,
      });
      setReports((prev) => prev.filter((r) => r.id !== resolved.id));
    } catch (error) {
      alert("Lỗi khi xử lý báo cáo.");
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <header>
        <p className="section-kicker">Quản trị viên</p>
        <h1 className="section-title">Xử lý báo lỗi</h1>
      </header>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : loading ? (
        <Card className="mx-auto min-h-[400px] animate-pulse bg-slate-100/50" />
      ) : reports.length === 0 ? (
        <Card className="flex min-h-[300px] flex-col items-center justify-center p-8 text-center">
          <CheckCircle2
            className="mb-4 text-emerald-400"
            size={56}
            strokeWidth={1.5}
            aria-hidden="true"
          />
          <p className="font-heading text-xl font-bold text-slate-700">
            Tuyệt vời!
          </p>
          <p className="mt-2 max-w-md text-slate-500">
            Không có báo cáo lỗi nào đang chờ xử lý. Bạn đã hoàn thành tất cả
            công việc.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {reports.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              onResolve={handleResolve}
              resolving={resolvingId === report.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

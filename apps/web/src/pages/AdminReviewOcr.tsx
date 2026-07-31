import {
  type ExamOcrStatus,
  type OcrQuestionStatus,
} from "@onthilab/contracts";
import {
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import {
  approveOcrQuestion,
  getExamOcrStatus,
  rejectOcrQuestion,
  retryOcrQuestion,
  setExamPresentationMode,
} from "../lib/api";
import { cn } from "../lib/cn";
import { questionImageUrl } from "../lib/question-image-url";
import { useAuth } from "../auth/AuthContext";

export function AdminReviewOcr({
  revisionId,
  isReadOnly,
  onOcrCompleted,
}: {
  revisionId: string;
  isReadOnly: boolean;
  onOcrCompleted?: () => void;
}) {
  const { session } = useAuth();
  const [status, setStatus] = useState<ExamOcrStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentText, setCurrentText] = useState("");
  const [workingQuestionId, setWorkingQuestionId] = useState<string | null>(
    null,
  );

  const loadStatus = async (isRefresh = false) => {
    if (!session) return;
    if (isRefresh) setRefreshing(true);
    try {
      const data = await getExamOcrStatus(session.idToken, revisionId);
      setStatus(data);
      if (data.canPublish && onOcrCompleted) {
        onOcrCompleted();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadStatus();
    const interval = setInterval(() => {
      void loadStatus(false);
    }, 10000); // Poll every 10s for OCR progress
    return () => clearInterval(interval);
  }, [session, revisionId]);

  if (loading || !status) {
    return (
      <div className="flex h-48 items-center justify-center">
        <LoaderCircle className="animate-spin text-primary" size={24} />
      </div>
    );
  }

  const { ocrProgress, questions } = status;
  const total = ocrProgress.total;
  const completed =
    total - ocrProgress.pending - ocrProgress.needsReview - ocrProgress.failed;
  const progressPercent = total > 0 ? (completed / total) * 100 : 0;

  const handleApprove = async (question: OcrQuestionStatus) => {
    if (!session || isReadOnly) return;
    setWorkingQuestionId(question.questionId);
    try {
      await approveOcrQuestion(
        session.idToken,
        question.questionId,
        currentText || question.textContent || "",
      );
      await loadStatus();
      setCurrentText("");
    } catch (e) {
      console.error(e);
    } finally {
      setWorkingQuestionId(null);
    }
  };

  const handleReject = async (questionId: string) => {
    if (!session || isReadOnly) return;
    setWorkingQuestionId(questionId);
    try {
      await rejectOcrQuestion(session.idToken, questionId);
      await loadStatus();
      setCurrentText("");
    } catch (e) {
      console.error(e);
    } finally {
      setWorkingQuestionId(null);
    }
  };

  const handleRetry = async (questionId: string) => {
    if (!session || isReadOnly) return;
    setWorkingQuestionId(questionId);
    try {
      await retryOcrQuestion(session.idToken, questionId);
      await loadStatus();
      setCurrentText("");
    } catch (e) {
      console.error(e);
    } finally {
      setWorkingQuestionId(null);
    }
  };

  const handleDisableOcr = async () => {
    if (!session || isReadOnly) return;
    if (
      !window.confirm(
        "Bạn có chắc muốn vô hiệu hóa OCR và chuyển toàn bộ đề này sang hiển thị ảnh gốc? Hành động này sẽ bỏ qua quá trình duyệt.",
      )
    ) {
      return;
    }
    setWorkingQuestionId("all");
    try {
      await setExamPresentationMode(session.idToken, revisionId, "image");
      await loadStatus();
    } catch (e) {
      console.error(e);
    } finally {
      setWorkingQuestionId(null);
    }
  };

  // Find next question to review
  const activeQuestion =
    questions.find(
      (q) =>
        q.ocrStatus === "needs_review" ||
        q.ocrStatus === "failed" ||
        q.ocrStatus === "pending",
    ) || questions[0];

  if (!activeQuestion) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border text-slate-500">
        Không có câu hỏi nào cần duyệt.
        {!isReadOnly && (
          <Button
            variant="secondary"
            className="mt-4 ml-4"
            onClick={handleDisableOcr}
            disabled={workingQuestionId === "all"}
          >
            Vô hiệu hóa OCR (Chuyển sang Ảnh gốc)
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <main className="contents">
        <Card className="overflow-hidden xl:col-start-1 xl:row-start-1 xl:self-start">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="font-heading text-lg font-bold">
              Câu {activeQuestion.order}
            </h2>
            <div className="flex items-center gap-2">
              <Badge
                tone={
                  activeQuestion.ocrStatus === "approved"
                    ? "green"
                    : activeQuestion.ocrStatus === "failed"
                      ? "pink"
                      : activeQuestion.ocrStatus === "needs_review"
                        ? "amber"
                        : "slate"
                }
              >
                {activeQuestion.ocrStatus}
              </Badge>
              {!isReadOnly && (
                <Button
                  variant="secondary"
                  onClick={handleDisableOcr}
                  disabled={workingQuestionId === "all"}
                >
                  Chuyển toàn đề sang Ảnh
                </Button>
              )}
            </div>
          </div>
          <div className="bg-slate-50 p-3 sm:p-5">
            <img
              src={questionImageUrl(activeQuestion.imageUrl)}
              alt={`Câu hỏi ${activeQuestion.order}`}
              className="min-h-48 w-full rounded-xl border border-border bg-white object-contain mb-4"
            />
            {activeQuestion.ocrStatus === "pending" ||
            activeQuestion.ocrStatus === "processing" ? (
              <div className="flex items-center justify-center p-8 text-slate-500 gap-2">
                <LoaderCircle className="animate-spin" size={20} />
                Đang xử lý OCR...
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-700">
                  Nội dung OCR:
                </label>
                <textarea
                  className="input-base min-h-[150px] font-mono text-sm resize-y"
                  value={currentText || activeQuestion.textContent || ""}
                  onChange={(e) => setCurrentText(e.target.value)}
                  disabled={
                    isReadOnly ||
                    workingQuestionId === activeQuestion.questionId
                  }
                />
              </div>
            )}
          </div>
        </Card>

        <aside className="space-y-4 xl:col-start-2 xl:row-start-1 xl:self-start">
          <Card className="p-5 sm:p-6">
            <h2 className="font-heading text-lg font-bold mb-4">
              Tiến trình OCR
            </h2>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-semibold text-slate-700">Đã hoàn tất</span>
              <span className="font-bold tabular-nums text-primary">
                {completed}/{total}
              </span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-slate-100 mb-6"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={completed}
            >
              <div
                className="h-full rounded-full bg-primary transition-transform duration-200"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="rounded-lg bg-emerald-50 p-3">
                <p className="text-xs font-semibold text-emerald-800">
                  Approved
                </p>
                <p className="mt-1 text-xl font-bold text-emerald-900">
                  {ocrProgress.approved}
                </p>
              </div>
              <div className="rounded-lg bg-amber-50 p-3">
                <p className="text-xs font-semibold text-amber-800">
                  Needs Review
                </p>
                <p className="mt-1 text-xl font-bold text-amber-900">
                  {ocrProgress.needsReview}
                </p>
              </div>
              <div className="rounded-lg bg-red-50 p-3">
                <p className="text-xs font-semibold text-red-800">Failed</p>
                <p className="mt-1 text-xl font-bold text-red-900">
                  {ocrProgress.failed}
                </p>
              </div>
              <div className="rounded-lg bg-slate-100 p-3">
                <p className="text-xs font-semibold text-slate-700">Pending</p>
                <p className="mt-1 text-xl font-bold text-slate-900">
                  {ocrProgress.pending}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => void loadStatus(true)}
              icon={
                <RefreshCw
                  size={16}
                  className={cn(refreshing && "animate-spin")}
                />
              }
            >
              Làm mới trạng thái
            </Button>
          </Card>

          {activeQuestion.ocrStatus !== "pending" && !isReadOnly && (
            <Card className="p-5 sm:p-6 flex flex-col gap-3">
              <Button
                type="button"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={workingQuestionId === activeQuestion.questionId}
                onClick={() => void handleApprove(activeQuestion)}
                icon={<CheckCircle2 size={18} />}
              >
                Lưu nội dung Text
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="w-full text-red-700 hover:bg-red-50"
                disabled={workingQuestionId === activeQuestion.questionId}
                onClick={() => void handleReject(activeQuestion.questionId)}
                icon={<XCircle size={18} />}
              >
                Hủy bỏ (dùng ảnh gốc)
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                disabled={workingQuestionId === activeQuestion.questionId}
                onClick={() => void handleRetry(activeQuestion.questionId)}
                icon={<RefreshCw size={18} />}
              >
                Thử OCR lại
              </Button>
            </Card>
          )}

          {activeQuestion.flagReasons.length > 0 && (
            <Card className="p-4 border-amber-200 bg-amber-50">
              <div className="flex items-start gap-2">
                <CircleAlert className="mt-0.5 text-amber-600" size={18} />
                <div>
                  <h3 className="font-semibold text-amber-900">Cần chú ý</h3>
                  <ul className="mt-2 space-y-1 text-sm text-amber-800 list-disc list-inside">
                    {activeQuestion.flagReasons.map((reason, i) => (
                      <li key={i}>{reason}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          )}
        </aside>
      </main>
    </div>
  );
}

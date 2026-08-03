import {
  type ExamOcrStatus,
  type OcrQuestionStatus,
} from "@onthilab/contracts";
import {
  CheckCircle2,
  CircleAlert,
  ImageOff,
  LoaderCircle,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import {
  approveOcrQuestion,
  getExamOcrStatus,
  rejectOcrQuestion,
  retryOcrQuestion,
  retryRevisionOcr,
  setExamPresentationMode,
} from "../lib/api";
import { cn } from "../lib/cn";
import { questionImageUrl } from "../lib/question-image-url";

const statusLabel: Record<OcrQuestionStatus["ocrStatus"], string> = {
  pending: "Chờ OCR",
  processing: "Đang OCR",
  approved: "Đã duyệt",
  needs_review: "Cần kiểm tra",
  failed: "Lỗi OCR",
};

const flagLabel: Record<string, string> = {
  low_confidence: "Độ tin cậy OCR thấp",
  has_formula: "Có công thức hoặc ký hiệu đặc biệt",
  has_table: "Có bảng hoặc bố cục phức tạp",
  has_code_block: "Có khối mã hoặc định dạng đặc biệt",
  low_resolution: "Ảnh có độ phân giải thấp",
  missing_option_labels: "Không nhận diện đủ nhãn lựa chọn A–F",
  invalid_option_count: "Số lựa chọn không hợp lệ",
  answer_out_of_range: "Đáp án đã lưu không khớp số lựa chọn OCR",
  too_short: "Nội dung OCR quá ngắn",
  possible_graph_or_diagram: "Có thể chứa biểu đồ, hình hoặc sơ đồ",
  admin_marked_unsupported: "Đã chọn dùng ảnh gốc",
};

function statusTone(status: OcrQuestionStatus["ocrStatus"]) {
  if (status === "approved") return "green" as const;
  if (status === "needs_review") return "amber" as const;
  if (status === "failed") return "pink" as const;
  return "slate" as const;
}

export function AdminReviewOcr({
  revisionId,
  isReadOnly,
  onOcrCompleted,
  onOcrUpdated,
}: {
  revisionId: string;
  isReadOnly: boolean;
  onOcrCompleted?: () => void;
  /** Refreshes the answer-review tab after canonical OCR options are saved. */
  onOcrUpdated?: () => void;
}) {
  const { session } = useAuth();
  const [status, setStatus] = useState<ExamOcrStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(
    null,
  );
  const [currentText, setCurrentText] = useState("");
  const [currentOptions, setCurrentOptions] = useState<string[]>([]);
  const [workingQuestionId, setWorkingQuestionId] = useState<string | null>(
    null,
  );
  const [formError, setFormError] = useState<string | null>(null);

  const loadStatus = async (isRefresh = false) => {
    if (!session) return;
    if (isRefresh) setRefreshing(true);
    try {
      const data = await getExamOcrStatus(session.idToken, revisionId);
      setStatus(data);
      if (data.canPublish) onOcrCompleted?.();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadStatus();
    const interval = window.setInterval(() => void loadStatus(), 10_000);
    return () => window.clearInterval(interval);
  }, [session, revisionId]);

  const activeQuestion = useMemo(() => {
    if (!status) return null;
    return (
      status.questions.find(
        (question) => question.questionId === selectedQuestionId,
      ) ??
      status.questions.find((question) => question.ocrStatus !== "approved") ??
      status.questions[0] ??
      null
    );
  }, [selectedQuestionId, status]);

  useEffect(() => {
    if (!activeQuestion) return;
    setCurrentText(activeQuestion.textContent ?? "");
    setCurrentOptions(activeQuestion.options ?? []);
    setFormError(null);
  }, [activeQuestion?.questionId]);

  const handleApprove = async () => {
    if (!session || !activeQuestion || isReadOnly) return;
    const textContent = currentText.trim();
    const options = currentOptions.map((option) => option.trim());
    if (!textContent) {
      setFormError("Nhập nội dung câu hỏi trước khi lưu.");
      return;
    }
    if (
      options.length < 2 ||
      options.length > 6 ||
      options.some((option) => !option)
    ) {
      setFormError(
        "Câu hỏi cần từ 2 đến 6 lựa chọn, không lựa chọn nào được trống.",
      );
      return;
    }

    setWorkingQuestionId(activeQuestion.questionId);
    try {
      await approveOcrQuestion(session.idToken, activeQuestion.questionId, {
        textContent,
        options,
      });
      await loadStatus();
      onOcrUpdated?.();
    } catch (error) {
      console.error(error);
      setFormError("Không thể lưu kết quả OCR. Hãy thử lại.");
    } finally {
      setWorkingQuestionId(null);
    }
  };

  const handleMarkForReview = async () => {
    if (!session || !activeQuestion || isReadOnly) return;
    setWorkingQuestionId(activeQuestion.questionId);
    try {
      await rejectOcrQuestion(session.idToken, activeQuestion.questionId);
      await loadStatus();
    } catch (error) {
      console.error(error);
    } finally {
      setWorkingQuestionId(null);
    }
  };

  const handleRetry = async () => {
    if (!session || !activeQuestion || isReadOnly) return;
    setWorkingQuestionId(activeQuestion.questionId);
    try {
      await retryOcrQuestion(session.idToken, activeQuestion.questionId);
      await loadStatus();
    } catch (error) {
      console.error(error);
    } finally {
      setWorkingQuestionId(null);
    }
  };

  const handleRetryPending = async () => {
    if (!session || isReadOnly) return;
    setWorkingQuestionId("all");
    try {
      // Reapplying OCR mode is intentionally idempotent: the API queues only
      // pending questions. This recovers a completed import whose first SQS
      // enqueue was unavailable without re-running approved questions.
      await setExamPresentationMode(
        session.idToken,
        revisionId,
        status?.presentationMode === "image"
          ? "hybrid"
          : (status?.presentationMode ?? "hybrid"),
      );
      await loadStatus();
    } catch (error) {
      console.error(error);
    } finally {
      setWorkingQuestionId(null);
    }
  };

  const handleRetryAll = async () => {
    if (!session || isReadOnly) return;
    if (
      !window.confirm(
        "OCR lại toàn bộ đề? Thao tác này gọi Textract cho tất cả câu, bao gồm câu đã duyệt.",
      )
    ) {
      return;
    }
    setWorkingQuestionId("all");
    try {
      await retryRevisionOcr(session.idToken, revisionId);
      await loadStatus();
    } catch (error) {
      console.error(error);
    } finally {
      setWorkingQuestionId(null);
    }
  };

  const handleDisableOcr = async () => {
    if (!session || isReadOnly) return;
    if (
      !window.confirm(
        "Chuyển toàn bộ đề sang ảnh gốc? Các kết quả OCR vẫn được giữ để bạn có thể bật lại sau.",
      )
    ) {
      return;
    }
    setWorkingQuestionId("all");
    try {
      await setExamPresentationMode(session.idToken, revisionId, "image");
      await loadStatus();
    } catch (error) {
      console.error(error);
    } finally {
      setWorkingQuestionId(null);
    }
  };

  const handleEnableHybrid = async () => {
    if (!session || isReadOnly) return;
    setWorkingQuestionId("all");
    try {
      await setExamPresentationMode(session.idToken, revisionId, "hybrid");
      await loadStatus();
    } catch (error) {
      console.error(error);
    } finally {
      setWorkingQuestionId(null);
    }
  };

  if (loading || !status || !activeQuestion) {
    return (
      <div className="flex h-48 items-center justify-center">
        <LoaderCircle className="animate-spin text-primary" size={24} />
      </div>
    );
  }

  const { ocrProgress, questions } = status;
  const processed = total(ocrProgress) - ocrProgress.pending;
  const progressPercent =
    total(ocrProgress) > 0 ? (processed / total(ocrProgress)) * 100 : 0;
  const isProcessing =
    activeQuestion.ocrStatus === "pending" ||
    activeQuestion.ocrStatus === "processing";
  const isWorking = workingQuestionId === activeQuestion.questionId;
  const imageFallbackCount = questions.filter(
    (question) => question.contentMode === "image",
  ).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-lg font-bold">Duyệt nội dung OCR</h2>
          <p className="mt-1 text-sm text-slate-600">
            {status.presentationMode === "hybrid"
              ? "Câu OCR hợp lệ dùng text; câu có cảnh báo tự dùng ảnh gốc."
              : "Kiểm tra nhanh các câu được gắn cờ. Câu sạch đã được lưu sẵn."}
          </p>
        </div>
        {!isReadOnly && (
          <div className="flex flex-wrap gap-2">
            {status.presentationMode !== "hybrid" && (
              <Button
                type="button"
                variant="secondary"
                onClick={handleEnableHybrid}
                disabled={workingQuestionId === "all"}
              >
                Dùng text + ảnh dự phòng
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              onClick={handleDisableOcr}
              disabled={workingQuestionId === "all"}
              icon={<ImageOff size={17} />}
            >
              Dùng ảnh gốc cho đề này
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Card className="overflow-hidden xl:self-start">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
            <div className="flex items-center gap-2">
              <h3 className="font-heading text-lg font-bold">
                Câu {activeQuestion.order}
              </h3>
              <Badge tone={statusTone(activeQuestion.ocrStatus)}>
                {statusLabel[activeQuestion.ocrStatus]}
              </Badge>
              {status.presentationMode === "hybrid" && (
                <Badge
                  tone={
                    activeQuestion.contentMode === "text" ? "blue" : "amber"
                  }
                >
                  Student:{" "}
                  {activeQuestion.contentMode === "text" ? "Text" : "Ảnh"}
                </Badge>
              )}
            </div>
            {activeQuestion.confidence !== null && (
              <span className="text-sm font-semibold text-slate-600">
                OCR {Math.round(activeQuestion.confidence * 100)}%
              </span>
            )}
          </div>

          <div className="space-y-5 bg-slate-50 p-3 sm:p-5">
            <img
              src={questionImageUrl(activeQuestion.imageUrl)}
              alt={`Ảnh gốc câu ${activeQuestion.order}`}
              className="min-h-48 w-full rounded-xl border border-border bg-white object-contain"
            />

            {isProcessing ? (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-white p-8 text-slate-500">
                <LoaderCircle className="animate-spin" size={20} />
                {activeQuestion.ocrStatus === "pending"
                  ? "Đang chờ OCR..."
                  : "Đang trích xuất text..."}
              </div>
            ) : (
              <div className="space-y-4 rounded-xl border border-border bg-white p-4 sm:p-5">
                <label className="block text-sm font-semibold text-slate-700">
                  Nội dung câu hỏi
                  <textarea
                    className="input-base mt-2 min-h-32 w-full resize-y font-mono text-sm"
                    value={currentText}
                    onChange={(event) => setCurrentText(event.target.value)}
                    disabled={isReadOnly || isWorking}
                  />
                </label>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label className="text-sm font-semibold text-slate-700">
                      Lựa chọn
                    </label>
                    {!isReadOnly && currentOptions.length < 6 && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary/80"
                        onClick={() =>
                          setCurrentOptions((options) => [...options, ""])
                        }
                      >
                        <Plus size={16} /> Thêm lựa chọn
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {currentOptions.map((option, index) => (
                      <div
                        key={`${activeQuestion.questionId}-${index}`}
                        className="flex items-center gap-2"
                      >
                        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                          {String.fromCharCode(65 + index)}
                        </span>
                        <input
                          className="input-base min-w-0 flex-1"
                          value={option}
                          onChange={(event) =>
                            setCurrentOptions((options) =>
                              options.map((item, optionIndex) =>
                                optionIndex === index
                                  ? event.target.value
                                  : item,
                              ),
                            )
                          }
                          disabled={isReadOnly || isWorking}
                          aria-label={`Lựa chọn ${String.fromCharCode(65 + index)}`}
                        />
                        {!isReadOnly && currentOptions.length > 2 && (
                          <button
                            type="button"
                            className="grid size-10 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-700"
                            onClick={() =>
                              setCurrentOptions((options) =>
                                options.filter(
                                  (_, optionIndex) => optionIndex !== index,
                                ),
                              )
                            }
                            aria-label={`Xóa lựa chọn ${String.fromCharCode(65 + index)}`}
                          >
                            <Trash2 size={17} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {formError && (
                  <p className="text-sm font-medium text-red-700">
                    {formError}
                  </p>
                )}
                {activeQuestion.validationIssues.length > 0 && (
                  <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                    {activeQuestion.validationIssues.join(" ")}
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>

        <aside className="space-y-4 xl:self-start">
          <Card className="p-5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-slate-700">Đã xử lý</span>
              <span className="font-bold tabular-nums text-primary">
                {processed}/{total(ocrProgress)}
              </span>
            </div>
            <div
              className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={total(ocrProgress)}
              aria-valuenow={processed}
            >
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <StatusStat
                label="Đã duyệt"
                value={ocrProgress.approved}
                className="bg-emerald-50 text-emerald-900"
              />
              <StatusStat
                label="Cần xem"
                value={ocrProgress.needsReview}
                className="bg-amber-50 text-amber-900"
              />
              <StatusStat
                label="Lỗi"
                value={ocrProgress.failed}
                className="bg-red-50 text-red-900"
              />
              <StatusStat
                label="Chờ"
                value={ocrProgress.pending}
                className="bg-slate-100 text-slate-900"
              />
            </div>
            {status.presentationMode === "hybrid" && (
              <p className="mt-3 text-sm text-slate-600">
                {questions.length - imageFallbackCount} câu dùng text ·{" "}
                {imageFallbackCount} câu dùng ảnh gốc
              </p>
            )}
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              <Button
                type="button"
                variant="secondary"
                onClick={() => void loadStatus(true)}
                icon={
                  <RefreshCw
                    size={16}
                    className={cn(refreshing && "animate-spin")}
                  />
                }
              >
                Làm mới
              </Button>
              {!isReadOnly && ocrProgress.pending > 0 && (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={workingQuestionId === "all"}
                  onClick={() => void handleRetryPending()}
                  icon={<RefreshCw size={16} />}
                >
                  OCR lại câu chờ
                </Button>
              )}
              {!isReadOnly && (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={workingQuestionId === "all"}
                  onClick={() => void handleRetryAll()}
                  icon={<RefreshCw size={16} />}
                >
                  OCR lại toàn bộ đề
                </Button>
              )}
            </div>
          </Card>

          {!isProcessing && !isReadOnly && (
            <Card className="space-y-3 p-5">
              <Button
                type="button"
                className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
                disabled={isWorking}
                onClick={() => void handleApprove()}
                icon={<CheckCircle2 size={18} />}
              >
                Xác nhận câu này
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                disabled={isWorking}
                onClick={() => void handleRetry()}
                icon={<RefreshCw size={18} />}
              >
                OCR lại câu này
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="w-full text-amber-800 hover:bg-amber-50"
                disabled={isWorking}
                onClick={() => void handleMarkForReview()}
                icon={<CircleAlert size={18} />}
              >
                Dùng ảnh gốc cho câu này
              </Button>
            </Card>
          )}

          {activeQuestion.flagReasons.length > 0 && (
            <Card className="border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-2">
                <CircleAlert className="mt-0.5 text-amber-600" size={18} />
                <div>
                  <h3 className="font-semibold text-amber-900">Cần chú ý</h3>
                  <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-amber-800">
                    {activeQuestion.flagReasons.map((reason) => (
                      <li key={reason}>{flagLabel[reason] ?? reason}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          )}
        </aside>
      </div>

      <Card className="p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-heading font-bold">Danh sách câu</h3>
          <span className="text-sm text-slate-500">Bấm để mở nhanh</span>
        </div>
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-10 lg:grid-cols-[repeat(15,minmax(0,1fr))]">
          {questions.map((question) => (
            <button
              key={question.questionId}
              type="button"
              onClick={() => setSelectedQuestionId(question.questionId)}
              className={cn(
                "relative min-h-10 rounded-lg border text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25",
                selectedQuestionId === question.questionId ||
                  (!selectedQuestionId &&
                    activeQuestion.questionId === question.questionId)
                  ? "border-primary bg-primary text-white"
                  : question.ocrStatus === "approved"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : question.ocrStatus === "needs_review"
                      ? "border-amber-200 bg-amber-50 text-amber-800"
                      : question.ocrStatus === "failed"
                        ? "border-red-200 bg-red-50 text-red-800"
                        : "border-slate-200 bg-white text-slate-600",
              )}
              aria-label={`Mở câu ${question.order}: ${statusLabel[question.ocrStatus]}`}
            >
              {question.order}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

function total(progress: ExamOcrStatus["ocrProgress"]) {
  return progress.total;
}

function StatusStat({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div className={cn("rounded-lg p-3", className)}>
      <p className="text-xs font-semibold">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

import type {
  DraftExamReview,
  QuestionType,
  ReviewQuestion,
} from "@onthilab/contracts";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Maximize2,
  Save,
  ShieldCheck,
  X,
} from "lucide-react";
import { Link, Navigate, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import {
  ApiError,
  getDraftExamReview,
  markExamReviewReady,
  saveQuestionReviewAnswer,
} from "../lib/api";
import { cn } from "../lib/cn";

export function AdminReviewPage() {
  const { examId } = useParams({ from: "/admin/exams/$examId/review" });
  const { configured, session, studentProfile } = useAuth();
  const [review, setReview] = useState<DraftExamReview | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [questionType, setQuestionType] = useState<QuestionType>("single");
  const [optionCount, setOptionCount] = useState(4);
  const [selectedOptions, setSelectedOptions] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [markingReady, setMarkingReady] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [imageExpanded, setImageExpanded] = useState(false);
  const canContribute =
    !configured ||
    studentProfile?.role === "admin" ||
    studentProfile?.role === "contributor" ||
    session?.user.groups.some((group) =>
      ["admin", "contributor"].includes(group),
    );

  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }

    let active = true;
    void getDraftExamReview(session.idToken, examId)
      .then((result) => {
        if (active) setReview(result);
      })
      .catch((reason) => {
        if (!active) return;
        setError(
          reason instanceof ApiError && reason.code === "EXAM_NOT_FOUND"
            ? "Không tìm thấy đề nháp hoặc đề đã được xuất bản."
            : "Không thể tải dữ liệu duyệt đáp án.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [examId, session]);

  const currentQuestion = review?.questions[currentIndex];
  useEffect(() => {
    if (!currentQuestion) return;
    setQuestionType(currentQuestion.type);
    setOptionCount(currentQuestion.options.length);
    setSelectedOptions(currentQuestion.correctOptions);
    setError("");
  }, [currentQuestion]);

  useEffect(() => {
    if (!imageExpanded) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setImageExpanded(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [imageExpanded]);

  const isReadOnly = review?.status === "review";
  const isDirty = useMemo(() => {
    if (!currentQuestion) return false;
    return (
      currentQuestion.type !== questionType ||
      currentQuestion.options.length !== optionCount ||
      [...currentQuestion.correctOptions].sort().join(",") !==
        [...selectedOptions].sort().join(",")
    );
  }, [currentQuestion, optionCount, questionType, selectedOptions]);

  if (!canContribute) {
    return <Navigate to="/" replace />;
  }

  const chooseType = (type: QuestionType) => {
    setFeedback("");
    setQuestionType(type);
    if (type === "single" && selectedOptions.length > 1) {
      setSelectedOptions(selectedOptions.slice(0, 1));
    }
  };

  const chooseOptionCount = (count: number) => {
    setFeedback("");
    setOptionCount(count);
    setSelectedOptions((current) => current.filter((option) => option < count));
  };

  const toggleAnswer = (option: number) => {
    setFeedback("");
    setSelectedOptions((current) => {
      if (questionType === "single") return [option];
      return current.includes(option)
        ? current.filter((value) => value !== option)
        : [...current, option].sort((left, right) => left - right);
    });
  };

  const goToQuestion = (index: number) => {
    if (isDirty && !isReadOnly) {
      setFeedback("");
      setError("Hãy lưu thay đổi trước khi chuyển sang câu khác.");
      return;
    }
    setFeedback("");
    setCurrentIndex(index);
  };

  const saveCurrent = async (moveNext: boolean) => {
    if (!session || !review || !currentQuestion || isReadOnly) return;
    if (selectedOptions.length === 0) {
      setError("Hãy chọn ít nhất một đáp án đúng.");
      return;
    }

    setSaving(true);
    setError("");
    setFeedback("");
    try {
      const saved = await saveQuestionReviewAnswer(
        session.idToken,
        review.examId,
        currentQuestion.id,
        {
          type: questionType,
          optionCount,
          correctOptions: selectedOptions,
        },
      );
      const questions = review.questions.map((question) =>
        question.id === saved.id
          ? { ...question, ...saved, imageUrl: question.imageUrl }
          : question,
      );
      const answeredCount = questions.filter(
        (question) => question.correctOptions.length > 0,
      ).length;
      setReview({ ...review, questions, answeredCount });
      setFeedback(`Đã lưu đáp án câu ${saved.order}.`);
      if (moveNext && currentIndex < questions.length - 1) {
        setCurrentIndex((index) => index + 1);
      }
    } catch (reason) {
      setError(
        reason instanceof ApiError && reason.code === "EXAM_NOT_EDITABLE"
          ? "Đề đã hoàn tất duyệt và không thể sửa thêm."
          : "Không thể lưu đáp án. Vui lòng thử lại.",
      );
    } finally {
      setSaving(false);
    }
  };

  const completeReview = async () => {
    if (!session || !review || review.answeredCount !== review.questionCount) {
      return;
    }
    setMarkingReady(true);
    setError("");
    try {
      const result = await markExamReviewReady(session.idToken, review.examId);
      setReview({ ...review, status: result.status });
      setFeedback("Đề đã chuyển sang trạng thái chờ Admin xuất bản.");
    } catch (reason) {
      setError(
        reason instanceof ApiError && reason.code === "ANSWERS_INCOMPLETE"
          ? "Vẫn còn câu chưa có đáp án."
          : "Không thể hoàn tất duyệt. Vui lòng thử lại.",
      );
    } finally {
      setMarkingReady(false);
    }
  };

  if (loading) {
    return (
      <div className="grid min-h-[55vh] place-items-center">
        <p className="flex items-center gap-2 font-semibold text-slate-600">
          <LoaderCircle className="animate-spin" aria-hidden="true" />
          Đang tải đề nháp...
        </p>
      </div>
    );
  }

  if (!session) {
    return (
      <Card className="mx-auto max-w-lg p-8 text-center">
        <h1 className="font-heading text-2xl font-bold">Cần đăng nhập</h1>
        <p className="mt-2 text-slate-600">
          Đăng nhập bằng tài khoản Contributor hoặc Admin để duyệt đáp án.
        </p>
      </Card>
    );
  }

  if (error && !review) {
    return (
      <Card className="mx-auto max-w-lg p-8 text-center">
        <h1 className="font-heading text-2xl font-bold">Chưa thể mở đề</h1>
        <p className="mt-2 text-slate-600">{error}</p>
        <Link
          to="/admin/import"
          className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 py-2 font-semibold text-white"
        >
          <ArrowLeft size={17} aria-hidden="true" />
          Quay lại nhập đề
        </Link>
      </Card>
    );
  }

  if (!review || !currentQuestion) return null;

  const progress = Math.round(
    (review.answeredCount / review.questionCount) * 100,
  );

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <Link
        to="/admin/import"
        className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg text-sm font-semibold text-slate-600 hover:text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25"
      >
        <ArrowLeft size={17} aria-hidden="true" />
        Quay lại nhập đề
      </Link>

      <header className="flex flex-col gap-4 rounded-2xl border border-border bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={review.status === "review" ? "green" : "amber"}>
              {review.status === "review" ? "Chờ xuất bản" : "Đang duyệt"}
            </Badge>
            <span className="text-sm text-slate-500">
              {review.courseCode} · {review.semester} · {review.campus.name}
            </span>
          </div>
          <h1 className="mt-2 font-heading text-2xl font-bold text-foreground">
            Duyệt đáp án {review.examCode}
          </h1>
          <p className="mt-1 text-sm text-slate-600">{review.courseName}</p>
        </div>
        <div className="w-full max-w-sm">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-slate-700">Tiến độ duyệt</span>
            <span className="font-bold tabular-nums text-primary">
              {review.answeredCount}/{review.questionCount}
            </span>
          </div>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-label="Tiến độ duyệt đáp án"
            aria-valuemin={0}
            aria-valuemax={review.questionCount}
            aria-valuenow={review.answeredCount}
          >
            <div
              className="h-full rounded-full bg-primary transition-transform duration-200"
              style={{
                width: `${progress}%`,
              }}
            />
          </div>
        </div>
      </header>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
        <main className="space-y-5">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="font-heading text-lg font-bold">
                Câu {currentQuestion.order}
              </h2>
              <span className="text-sm tabular-nums text-slate-500">
                {currentIndex + 1}/{review.questionCount}
              </span>
            </div>
            <div className="bg-slate-50 p-3 sm:p-5">
              <button
                type="button"
                onClick={() => setImageExpanded(true)}
                className="group relative block w-full cursor-zoom-in rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25"
                aria-label={`Mở rộng ảnh câu hỏi ${currentQuestion.order}`}
              >
                <img
                  src={currentQuestion.imageUrl}
                  alt={`Câu hỏi ${currentQuestion.order} của đề ${review.examCode}`}
                  width={1920}
                  height={620}
                  className="min-h-48 w-full rounded-xl border border-border bg-white object-contain"
                />
                <span className="absolute bottom-2 right-2 inline-flex min-h-10 items-center gap-2 rounded-lg bg-slate-950/75 px-3 text-xs font-semibold text-white opacity-100 backdrop-blur-sm transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100">
                  <Maximize2 size={15} aria-hidden="true" />
                  Phóng to
                </span>
              </button>
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <fieldset disabled={isReadOnly}>
                <legend className="text-sm font-bold text-slate-700">
                  Loại câu hỏi
                </legend>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(["single", "multiple"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => chooseType(type)}
                      className={cn(
                        "min-h-11 cursor-pointer rounded-xl border px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25",
                        questionType === type
                          ? "border-primary bg-primary-soft text-primary"
                          : "border-border bg-white text-slate-600 hover:bg-slate-50",
                      )}
                      aria-pressed={questionType === type}
                    >
                      {type === "single" ? "Chọn một" : "Chọn nhiều"}
                    </button>
                  ))}
                </div>
              </fieldset>

              <label className="form-field">
                <span>Số lựa chọn</span>
                <select
                  className="input-base"
                  value={optionCount}
                  disabled={isReadOnly}
                  onChange={(event) =>
                    chooseOptionCount(Number(event.target.value))
                  }
                >
                  {[2, 3, 4, 5, 6].map((count) => (
                    <option key={count} value={count}>
                      {count} đáp án
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <fieldset className="mt-6" disabled={isReadOnly}>
              <legend className="text-sm font-bold text-slate-700">
                Đáp án đúng
              </legend>
              <p className="mt-1 text-sm text-slate-500">
                {questionType === "single"
                  ? "Chọn chính xác một đáp án."
                  : "Chọn toàn bộ đáp án đúng của câu."}
              </p>
              <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-6">
                {Array.from({ length: optionCount }, (_, option) => {
                  const selected = selectedOptions.includes(option);
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => toggleAnswer(option)}
                      className={cn(
                        "relative min-h-14 cursor-pointer rounded-xl border text-lg font-bold transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25",
                        selected
                          ? "border-primary bg-primary text-white"
                          : "border-border-strong bg-white text-slate-700 hover:border-primary/50 hover:bg-primary-soft",
                      )}
                      aria-pressed={selected}
                      aria-label={`Đáp án ${String.fromCharCode(65 + option)}${selected ? ", đã chọn" : ""}`}
                    >
                      {selected && (
                        <Check
                          size={14}
                          className="absolute right-1.5 top-1.5"
                          aria-hidden="true"
                        />
                      )}
                      {String.fromCharCode(65 + option)}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="mt-6 min-h-6" aria-live="polite">
              {error && (
                <p className="text-sm font-semibold text-red-700" role="alert">
                  {error}
                </p>
              )}
              {!error && feedback && (
                <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                  <CheckCircle2 size={16} aria-hidden="true" />
                  {feedback}
                </p>
              )}
              {!error && !feedback && isDirty && !isReadOnly && (
                <p className="text-sm text-amber-700">Có thay đổi chưa lưu.</p>
              )}
            </div>

            <div className="mt-4 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={currentIndex === 0 || saving}
                  onClick={() => goToQuestion(currentIndex - 1)}
                  icon={<ChevronLeft size={17} />}
                >
                  Câu trước
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={
                    currentIndex === review.questions.length - 1 || saving
                  }
                  onClick={() => goToQuestion(currentIndex + 1)}
                >
                  Câu sau
                  <ChevronRight size={17} aria-hidden="true" />
                </Button>
              </div>
              {!isReadOnly && (
                <Button
                  type="button"
                  disabled={saving || selectedOptions.length === 0}
                  onClick={() => void saveCurrent(true)}
                  icon={
                    saving ? (
                      <LoaderCircle
                        size={17}
                        className="animate-spin"
                        aria-hidden="true"
                      />
                    ) : currentIndex === review.questions.length - 1 ? (
                      <Save size={17} aria-hidden="true" />
                    ) : (
                      <ArrowRight size={17} aria-hidden="true" />
                    )
                  }
                >
                  {saving
                    ? "Đang lưu..."
                    : currentIndex === review.questions.length - 1
                      ? "Lưu đáp án"
                      : "Lưu & câu tiếp"}
                </Button>
              )}
            </div>
          </Card>
        </main>

        <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading font-bold">Danh sách câu</h2>
              <span className="text-xs text-slate-500">
                Bấm để chuyển nhanh
              </span>
            </div>
            <div className="mt-4 grid grid-cols-6 gap-2 sm:grid-cols-10 xl:grid-cols-6">
              {review.questions.map((question, index) => {
                const answered = question.correctOptions.length > 0;
                const active = index === currentIndex;
                return (
                  <button
                    key={question.id}
                    type="button"
                    onClick={() => goToQuestion(index)}
                    className={cn(
                      "relative grid size-11 cursor-pointer place-items-center rounded-lg border text-sm font-bold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25",
                      active
                        ? "border-primary bg-primary text-white"
                        : answered
                          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                          : "border-border bg-white text-slate-600 hover:border-primary/40 hover:bg-primary-soft",
                    )}
                    aria-label={`Câu ${question.order}${answered ? ", đã có đáp án" : ", chưa có đáp án"}`}
                    aria-current={active ? "step" : undefined}
                  >
                    {question.order}
                    {answered && !active && (
                      <Check
                        size={10}
                        className="absolute right-0.5 top-0.5"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </Card>

          <Card
            className={cn(
              "p-5",
              review.status === "review"
                ? "border-emerald-200 bg-emerald-50"
                : "border-blue-200 bg-blue-50",
            )}
          >
            <div className="flex items-start gap-3">
              <ShieldCheck
                className={
                  review.status === "review"
                    ? "text-emerald-700"
                    : "text-primary"
                }
                aria-hidden="true"
              />
              <div>
                <h2 className="font-heading font-bold">
                  {review.status === "review"
                    ? "Đã hoàn tất duyệt"
                    : "Hoàn tất bước duyệt"}
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {review.status === "review"
                    ? "Đề đang chờ Admin kiểm tra lần cuối và xuất bản."
                    : review.answeredCount === review.questionCount
                      ? "Tất cả câu đã có đáp án. Hãy chuyển đề sang bước xuất bản."
                      : `Còn ${review.questionCount - review.answeredCount} câu chưa có đáp án.`}
                </p>
              </div>
            </div>
            {review.status === "draft" && (
              <Button
                type="button"
                className="mt-4 w-full"
                disabled={
                  review.answeredCount !== review.questionCount || markingReady
                }
                onClick={() => void completeReview()}
                icon={
                  markingReady ? (
                    <LoaderCircle
                      size={17}
                      className="animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <CheckCircle2 size={17} aria-hidden="true" />
                  )
                }
              >
                {markingReady ? "Đang hoàn tất..." : "Hoàn tất duyệt đáp án"}
              </Button>
            )}
          </Card>
        </aside>
      </div>

      {imageExpanded && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-slate-950/90 p-3 backdrop-blur-sm sm:p-6"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setImageExpanded(false);
          }}
        >
          <div className="mb-3 flex items-center justify-between text-white">
            <p className="font-heading font-bold">
              Câu {currentQuestion.order} · kéo ngang để xem toàn bộ
            </p>
            <button
              type="button"
              onClick={() => setImageExpanded(false)}
              className="grid size-11 cursor-pointer place-items-center rounded-xl bg-white/10 transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-white/40"
              aria-label="Đóng ảnh phóng to"
            >
              <X aria-hidden="true" />
            </button>
          </div>
          <section
            role="dialog"
            aria-modal="true"
            aria-label={`Ảnh phóng to câu ${currentQuestion.order}`}
            className="min-h-0 flex-1 overflow-auto rounded-xl bg-white"
          >
            <img
              src={currentQuestion.imageUrl}
              alt={`Ảnh phóng to câu hỏi ${currentQuestion.order}`}
              width={1920}
              height={620}
              className="h-auto min-w-[1000px] max-w-none sm:min-w-full"
            />
          </section>
        </div>
      )}
    </div>
  );
}

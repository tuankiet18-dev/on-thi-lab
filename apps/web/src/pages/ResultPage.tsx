import type { Attempt, Exam } from "@onthilab/contracts";
import { isExactAnswer } from "@onthilab/contracts";
import {
  ArrowLeft,
  Bookmark,
  Check,
  CheckCircle2,
  Clock3,
  Flag,
  Image,
  RotateCcw,
  Target,
  X,
} from "lucide-react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { QuestionContent } from "../components/QuestionContent";
import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { demoAnswerKey, demoExam } from "../data/demo";
import {
  createReport,
  getAttemptSession,
  getBookmarks,
  setExamBookmark,
  setQuestionBookmark,
} from "../lib/api";
import { loadAttempt, resetDemoAttempt } from "../lib/attempt-storage";
import { questionImageUrl } from "../lib/question-image-url";

type ReviewFilter = "all" | "correct" | "incorrect" | "unanswered";

export function ResultPage() {
  const { attemptId } = useParams({ from: "/results/$attemptId" });
  const navigate = useNavigate();
  const { configured, session } = useAuth();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reportedQuestion, setReportedQuestion] = useState<string | null>(null);
  const [reportDetail, setReportDetail] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportedList, setReportedList] = useState<Set<string>>(new Set());
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(
    null,
  );
  const [zoomedImage, setZoomedImage] = useState<null | {
    imageUrl: string;
    imageAlt: string;
    textContent?: string | null;
    options?: string[] | null;
  }>(null);
  const [bookmarkedExam, setBookmarkedExam] = useState(false);
  const [bookmarkedQuestions, setBookmarkedQuestions] = useState<Set<string>>(
    new Set(),
  );
  const [bookmarkLoading, setBookmarkLoading] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoomedImage(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    let active = true;
    if (!configured) {
      const local = loadAttempt(attemptId);
      if (local?.result) {
        setAttempt({
          id: "00000000-0000-4000-8000-000000000001",
          examId: "00000000-0000-4000-8000-000000000002",
          status: local.result.status,
          startedAt: local.startedAt,
          expiresAt: local.expiresAt,
          answers: local.answers,
          questionOrder: demoExam.questions.map((question) => question.id),
          result: {
            ...local.result,
            attemptId: "00000000-0000-4000-8000-000000000001",
          },
          correctAnswers: demoAnswerKey,
        });
        setExam(demoExam);
      } else {
        setError("Bài thi này chưa được nộp hoặc dữ liệu đã bị xóa.");
      }
      setLoading(false);
      return;
    }
    if (!session) return;

    void getAttemptSession(session.idToken, attemptId)
      .then(({ attempt: loadedAttempt, exam: loadedExam }) => {
        if (!loadedAttempt.result) {
          throw new Error("Attempt is not submitted");
        }
        if (!active) return;
        setAttempt(loadedAttempt);
        setExam(loadedExam);
        void getBookmarks(session.idToken)
          .then((bookmarks) => {
            if (!active) return;
            setBookmarkedExam(
              bookmarks.exams.some((saved) => saved.id === loadedExam.id),
            );
            setBookmarkedQuestions(
              new Set(
                bookmarks.questions.map((question) => question.questionId),
              ),
            );
          })
          .catch(() => {
            // Bookmarks are a convenience feature; the submitted result must
            // remain usable if this separate request is unavailable.
          });
      })
      .catch(() => {
        if (active) setError("Chưa thể tải kết quả bài thi.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [attemptId, configured, session]);

  const handleSubmitReport = async (questionId: string) => {
    if (!session || !reportDetail.trim()) return;
    setReportLoading(true);
    try {
      await createReport(session.idToken, attemptId, questionId, {
        category: "wrong_answer",
        detail: reportDetail,
      });
      setReportedList((prev) => new Set(prev).add(questionId));
      setReportedQuestion(null);
      setReportDetail("");
    } catch (error) {
      alert("Đã xảy ra lỗi khi gửi báo cáo.");
    } finally {
      setReportLoading(false);
    }
  };

  async function toggleExamBookmark() {
    if (!session || !exam || bookmarkLoading) return;
    const next = !bookmarkedExam;
    setBookmarkLoading(`exam:${exam.id}`);
    try {
      setBookmarkedExam(await setExamBookmark(session.idToken, exam.id, next));
    } finally {
      setBookmarkLoading(null);
    }
  }

  async function toggleQuestionBookmark(questionId: string) {
    if (!session || bookmarkLoading) return;
    const next = !bookmarkedQuestions.has(questionId);
    setBookmarkLoading(`question:${questionId}`);
    try {
      const saved = await setQuestionBookmark(
        session.idToken,
        questionId,
        next,
      );
      setBookmarkedQuestions((current) => {
        const updated = new Set(current);
        if (saved) updated.add(questionId);
        else updated.delete(questionId);
        return updated;
      });
    } finally {
      setBookmarkLoading(null);
    }
  }

  if (loading) {
    return (
      <Card className="mx-auto min-h-72 max-w-5xl animate-pulse bg-slate-100" />
    );
  }

  if (!attempt?.result || !exam || error) {
    return (
      <Card className="mx-auto max-w-lg p-8 text-center">
        <h1 className="font-heading text-2xl font-bold">Chưa có kết quả</h1>
        <p className="mt-2 text-slate-600">
          {error || "Bài thi này chưa được nộp."}
        </p>
        <Link
          to="/exams"
          className="mt-6 inline-flex min-h-11 cursor-pointer items-center rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white"
        >
          Quay lại kho đề
        </Link>
      </Card>
    );
  }

  const result = attempt.result;
  const answerKey = attempt.correctAnswers ?? {};
  const questionsById = new Map(
    exam.questions.map((question) => [question.id, question]),
  );
  const orderedQuestions = attempt.questionOrder
    .map((questionId) => questionsById.get(questionId))
    .filter((question): question is Exam["questions"][number] =>
      Boolean(question),
    );
  const reviewItems = orderedQuestions.map((question, index) => {
    const selected = attempt.answers[question.id] ?? [];
    const correct = answerKey[question.id] ?? [];
    return {
      question,
      index,
      selected,
      correct,
      isUnanswered: selected.length === 0,
      isCorrect: isExactAnswer(selected, correct),
    };
  });
  const reviewCounts = {
    all: reviewItems.length,
    correct: reviewItems.filter((item) => item.isCorrect).length,
    incorrect: reviewItems.filter(
      (item) => !item.isCorrect && !item.isUnanswered,
    ).length,
    unanswered: reviewItems.filter((item) => item.isUnanswered).length,
  };
  const filteredReviewItems = reviewItems.filter((item) => {
    if (reviewFilter === "all") return true;
    if (reviewFilter === "correct") return item.isCorrect;
    if (reviewFilter === "unanswered") return item.isUnanswered;
    return !item.isCorrect && !item.isUnanswered;
  });
  const examIdForRetry = exam.id;
  const circumference = 2 * Math.PI * 54;
  const dashOffset = circumference * (1 - result.score / 10);

  function retry() {
    if (!configured) resetDemoAttempt();
    void navigate({
      to: "/exams/$examId",
      params: { examId: configured ? examIdForRetry : demoExam.id },
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        to="/exams"
        className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg text-sm font-semibold text-slate-600 hover:text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20"
      >
        <ArrowLeft size={17} aria-hidden="true" />
        Về kho đề thi
      </Link>

      <Card className="overflow-hidden">
        <div className="grid gap-8 bg-linear-to-br from-[#173b8f] to-primary p-7 text-white sm:p-10 lg:grid-cols-[1fr_220px] lg:items-center">
          <div>
            <Badge tone="amber">
              {result.status === "auto_submitted"
                ? "Đã tự động nộp"
                : "Đã hoàn thành"}
            </Badge>
            <h1 className="mt-5 font-heading text-3xl font-bold">
              Kết quả thi thử {exam.courseCode}
            </h1>
            <p className="mt-2 text-blue-100">
              {exam.code} · Điểm số tham khảo
            </p>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm text-blue-100">
              <span className="flex items-center gap-2">
                <CheckCircle2 size={17} aria-hidden="true" />
                {result.correctCount}/{result.questionCount} câu đúng
              </span>
              <span className="flex items-center gap-2">
                <Clock3 size={17} aria-hidden="true" />
                Nộp lúc{" "}
                {new Intl.DateTimeFormat("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(result.submittedAt))}
              </span>
            </div>
          </div>
          <div className="relative mx-auto grid size-40 place-items-center">
            <svg
              className="-rotate-90"
              width="144"
              height="144"
              aria-hidden="true"
            >
              <circle
                cx="72"
                cy="72"
                r="54"
                fill="none"
                stroke="rgba(255,255,255,.2)"
                strokeWidth="12"
              />
              <circle
                cx="72"
                cy="72"
                r="54"
                fill="none"
                stroke="white"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
              />
            </svg>
            <div className="absolute text-center">
              <span className="font-heading text-4xl font-bold">
                {result.score}
              </span>
              <span className="block text-xs text-blue-100">trên 10</span>
            </div>
          </div>
        </div>
        <div className="grid gap-px bg-border sm:grid-cols-3">
          {[
            [
              "Chính xác",
              `${Math.round((result.correctCount / result.questionCount) * 100)}%`,
            ],
            ["Câu đúng", String(result.correctCount)],
            ["Cần xem lại", String(result.questionCount - result.correctCount)],
          ].map(([label, value]) => (
            <div key={label} className="bg-white p-5 text-center">
              <p className="font-heading text-2xl font-bold text-foreground">
                {value}
              </p>
              <p className="mt-1 text-sm text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button onClick={retry} icon={<RotateCcw size={17} />}>
          Làm lại đề này
        </Button>
        <Link
          to="/statistics"
          className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border-strong bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25"
        >
          <Target size={17} aria-hidden="true" />
          Xem thống kê
        </Link>
        {configured && (
          <Button
            variant="secondary"
            onClick={() => void toggleExamBookmark()}
            disabled={bookmarkLoading !== null}
            icon={
              <Bookmark
                size={17}
                fill={bookmarkedExam ? "currentColor" : "none"}
              />
            }
          >
            {bookmarkLoading === `exam:${exam.id}`
              ? "Đang cập nhật..."
              : bookmarkedExam
                ? "Đã lưu đề"
                : "Lưu đề này"}
          </Button>
        )}
      </div>

      <section>
        <div className="mb-4">
          <p className="section-kicker">Đối chiếu đáp án</p>
          <h2 className="section-title">Xem lại bài làm</h2>
          <p className="mt-2 text-sm text-slate-500">
            Việc xử lý report không thay đổi điểm của lần thi đã hoàn thành.
          </p>
        </div>
        <div
          className="mb-5 flex flex-wrap gap-2"
          role="group"
          aria-label="Lọc câu hỏi theo kết quả"
        >
          {[
            ["all", "Tất cả"],
            ["incorrect", "Sai"],
            ["unanswered", "Chưa trả lời"],
            ["correct", "Đúng"],
          ].map(([value, label]) => {
            const filter = value as ReviewFilter;
            return (
              <button
                key={filter}
                type="button"
                onClick={() => setReviewFilter(filter)}
                aria-pressed={reviewFilter === filter}
                className={`min-h-11 cursor-pointer rounded-xl border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25 ${
                  reviewFilter === filter
                    ? "border-primary bg-primary text-white"
                    : "border-border-strong bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {label} ({reviewCounts[filter]})
              </button>
            );
          })}
        </div>
        <div className="space-y-3">
          {filteredReviewItems.map(
            ({
              question,
              index,
              selected,
              correct,
              isCorrect,
              isUnanswered,
            }) => {
              const isExpanded = expandedQuestionId === question.id;

              return (
                <Card key={question.id} className="p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <span
                      className={`grid size-10 shrink-0 place-items-center rounded-xl ${
                        isCorrect
                          ? "bg-emerald-50 text-emerald-700"
                          : isUnanswered
                            ? "bg-amber-50 text-amber-700"
                            : "bg-red-50 text-red-700"
                      }`}
                    >
                      {isCorrect ? (
                        <Check size={20} aria-hidden="true" />
                      ) : (
                        <X size={20} aria-hidden="true" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-heading font-bold text-foreground">
                        Câu {index + 1} ·{" "}
                        {question.type === "multiple"
                          ? "Nhiều đáp án"
                          : "Một đáp án"}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-500">
                        {isCorrect
                          ? "Trả lời đúng"
                          : isUnanswered
                            ? "Chưa trả lời"
                            : "Cần xem lại"}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                        <span className="text-slate-600">
                          Bạn chọn:{" "}
                          <strong
                            className={
                              isCorrect ? "text-emerald-700" : "text-red-700"
                            }
                          >
                            {selected.length
                              ? selected
                                  .map((value) => question.options[value])
                                  .join(", ")
                              : "Chưa trả lời"}
                          </strong>
                        </span>
                        <span className="text-slate-600">
                          Đáp án:{" "}
                          <strong className="text-emerald-700">
                            {correct
                              .map((value) => question.options[value])
                              .join(", ")}
                          </strong>
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 self-start sm:self-auto">
                      {configured && (
                        <button
                          type="button"
                          onClick={() =>
                            void toggleQuestionBookmark(question.id)
                          }
                          disabled={bookmarkLoading !== null}
                          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3 text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20 disabled:opacity-50"
                          aria-pressed={bookmarkedQuestions.has(question.id)}
                        >
                          <Bookmark
                            size={16}
                            fill={
                              bookmarkedQuestions.has(question.id)
                                ? "currentColor"
                                : "none"
                            }
                            aria-hidden="true"
                          />
                          {bookmarkedQuestions.has(question.id)
                            ? "Đã lưu"
                            : "Lưu câu"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedQuestionId((current) =>
                            current === question.id ? null : question.id,
                          )
                        }
                        className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3 text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20"
                        aria-expanded={isExpanded}
                      >
                        <Image size={16} aria-hidden="true" />
                        {isExpanded ? "Ẩn câu hỏi" : "Xem câu hỏi"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (reportedQuestion === question.id) {
                            setReportedQuestion(null);
                          } else {
                            setReportedQuestion(question.id);
                            setReportDetail("");
                          }
                        }}
                        disabled={reportedList.has(question.id)}
                        className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3 text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20 disabled:opacity-50"
                      >
                        <Flag size={16} aria-hidden="true" />
                        {reportedList.has(question.id)
                          ? "Đã báo lỗi"
                          : "Báo lỗi"}
                      </button>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="mt-4 overflow-hidden rounded-xl border border-border bg-slate-50">
                      <QuestionContent
                        presentationMode={exam?.presentationMode ?? "image"}
                        imageUrl={questionImageUrl(question.imageUrl)}
                        imageAlt={question.imageAlt}
                        textContent={question.textContent}
                        options={question.options}
                        onExpandImage={() =>
                          setZoomedImage({
                            imageUrl: questionImageUrl(question.imageUrl),
                            imageAlt: question.imageAlt,
                            textContent: question.textContent,
                            options: question.options,
                          })
                        }
                      />
                    </div>
                  )}
                  {reportedQuestion === question.id &&
                    !reportedList.has(question.id) && (
                      <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                        <p className="mb-2 font-semibold">
                          Báo lỗi câu hỏi này
                        </p>
                        <textarea
                          value={reportDetail}
                          onChange={(e) => setReportDetail(e.target.value)}
                          placeholder="Vui lòng mô tả chi tiết lỗi (ví dụ: Sai đáp án, hình ảnh mờ...)"
                          className="w-full rounded-md border border-blue-200 bg-white p-3 focus:outline-none focus:ring-2 focus:ring-primary/50"
                          rows={3}
                          disabled={reportLoading}
                        />
                        <div className="mt-3 flex justify-end gap-2">
                          <Button
                            variant="secondary"
                            onClick={() => setReportedQuestion(null)}
                            disabled={reportLoading}
                          >
                            Hủy
                          </Button>
                          <Button
                            onClick={() => handleSubmitReport(question.id)}
                            disabled={reportLoading || !reportDetail.trim()}
                          >
                            {reportLoading ? "Đang gửi..." : "Gửi báo cáo"}
                          </Button>
                        </div>
                      </div>
                    )}
                </Card>
              );
            },
          )}
        </div>
      </section>

      {zoomedImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Ảnh phóng to"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 sm:p-8"
          onClick={() => setZoomedImage(null)}
        >
          <button
            onClick={() => setZoomedImage(null)}
            className="absolute top-4 right-4 sm:top-6 sm:right-6 inline-flex size-12 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md transition-all hover:bg-black/80 hover:scale-110 focus-visible:outline-none"
            aria-label="Đóng ảnh"
          >
            <X size={28} aria-hidden="true" />
          </button>
          <div
            className="w-full max-w-5xl rounded-xl bg-white p-4 overflow-auto max-h-[90dvh]"
            onClick={(e) => e.stopPropagation()}
          >
            <QuestionContent
              presentationMode={exam?.presentationMode ?? "image"}
              imageUrl={zoomedImage.imageUrl}
              imageAlt={zoomedImage.imageAlt}
              textContent={zoomedImage.textContent}
              options={zoomedImage.options}
            />
          </div>
        </div>
      )}
    </div>
  );
}

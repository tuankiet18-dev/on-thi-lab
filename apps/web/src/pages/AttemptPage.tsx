import type { Attempt, Exam } from "@onthilab/contracts";
import {
  AlertTriangle,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Flag,
  GraduationCap,
  Maximize2,
  Save,
  Send,
  X,
} from "lucide-react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QuestionContent } from "../components/QuestionContent";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { demoExam } from "../data/demo";
import {
  getAttemptSession,
  saveAttemptAnswer,
  submitAttempt as submitRemoteAttempt,
} from "../lib/api";
import {
  createOrResumeAttempt,
  loadAttempt,
  saveAttempt as saveLocalAttempt,
  submitAttempt as submitLocalAttempt,
} from "../lib/attempt-storage";
import { cn } from "../lib/cn";
import { questionImageUrl } from "../lib/question-image-url";

type SaveState = "saved" | "saving" | "offline";

function formatTime(totalSeconds: number): string {
  const safeSeconds = Math.max(totalSeconds, 0);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function AttemptPage() {
  const { attemptId } = useParams({ from: "/attempts/$attemptId" });
  const navigate = useNavigate();
  const { configured, session } = useAuth();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [flagged, setFlagged] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [showSubmit, setShowSubmit] = useState(false);
  const [imageExpanded, setImageExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const sequence = useRef(0);
  const pendingSaves = useRef<Promise<void>>(Promise.resolve());
  const didAutoSubmit = useRef(false);

  useEffect(() => {
    let active = true;
    if (!configured) {
      const local = loadAttempt(attemptId) ?? createOrResumeAttempt();
      const localAttempt: Attempt = {
        id: "00000000-0000-4000-8000-000000000001",
        examId: "00000000-0000-4000-8000-000000000002",
        status: local.result?.status ?? "in_progress",
        startedAt: local.startedAt,
        expiresAt: local.expiresAt,
        answers: local.answers,
        questionOrder: demoExam.questions.map((question) => question.id),
        result: local.result ?? null,
      };
      setAttempt(localAttempt);
      setExam(demoExam);
      setFlagged(local.flagged);
      setRemainingSeconds(
        Math.max(
          0,
          Math.ceil((Date.parse(local.expiresAt) - Date.now()) / 1_000),
        ),
      );
      setLoading(false);
      return;
    }
    if (!session) return;

    void getAttemptSession(session.idToken, attemptId)
      .then(({ attempt: loadedAttempt, exam: loadedExam }) => {
        if (!active) return;
        setAttempt(loadedAttempt);
        setExam(loadedExam);
        setRemainingSeconds(
          Math.max(
            0,
            Math.ceil(
              (Date.parse(loadedAttempt.expiresAt) - Date.now()) / 1_000,
            ),
          ),
        );
        if (loadedAttempt.result) {
          void navigate({
            to: "/results/$attemptId",
            params: { attemptId: loadedAttempt.id },
            replace: true,
          });
        }
      })
      .catch(() => {
        if (active) setError("Không thể tải lượt thi này.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [attemptId, configured, navigate, session]);

  const questions = useMemo(() => {
    if (!attempt || !exam) return [];
    const byId = new Map(
      exam.questions.map((question) => [question.id, question]),
    );
    return attempt.questionOrder
      .map((questionId) => byId.get(questionId))
      .filter((question): question is Exam["questions"][number] =>
        Boolean(question),
      );
  }, [attempt, exam]);
  const question = questions[currentIndex];
  const answeredCount = attempt
    ? Object.values(attempt.answers).filter((answer) => answer.length > 0)
        .length
    : 0;
  const selectedOptions =
    attempt && question ? (attempt.answers[question.id] ?? []) : [];
  const progress =
    questions.length === 0
      ? 0
      : Math.round((answeredCount / questions.length) * 100);
  const isLowTime = remainingSeconds <= 300;

  const finishAttempt = useCallback(
    async (reason: "user" | "timeout") => {
      if (!attempt || submitting) return;
      setSubmitting(true);
      setError("");
      try {
        await pendingSaves.current;
        if (!configured) {
          const local = loadAttempt(attemptId) ?? createOrResumeAttempt();
          const submitted = submitLocalAttempt(
            { ...local, answers: attempt.answers, flagged },
            reason,
          );
          await navigate({
            to: "/results/$attemptId",
            params: { attemptId: submitted.id },
            replace: true,
          });
          return;
        }
        if (!session) return;
        await submitRemoteAttempt(session.idToken, attempt.id, reason);
        await navigate({
          to: "/results/$attemptId",
          params: { attemptId: attempt.id },
          replace: true,
        });
      } catch {
        setError("Không thể nộp bài. Hệ thống sẽ tiếp tục giữ đáp án đã lưu.");
        setSubmitting(false);
      }
    },
    [attempt, attemptId, configured, flagged, navigate, session, submitting],
  );

  useEffect(() => {
    if (!attempt || attempt.result) return;
    const interval = window.setInterval(() => {
      const next = Math.max(
        0,
        Math.ceil((Date.parse(attempt.expiresAt) - Date.now()) / 1_000),
      );
      setRemainingSeconds(next);
      if (next === 0 && !didAutoSubmit.current) {
        didAutoSubmit.current = true;
        void finishAttempt("timeout");
      }
    }, 1_000);
    return () => window.clearInterval(interval);
  }, [attempt, finishAttempt]);

  useEffect(() => {
    const warnBeforeLeave = (event: BeforeUnloadEvent) => {
      if (attempt && !attempt.result) event.preventDefault();
    };
    window.addEventListener("beforeunload", warnBeforeLeave);
    return () => window.removeEventListener("beforeunload", warnBeforeLeave);
  }, [attempt]);

  useEffect(() => {
    if (!showSubmit || submitting) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowSubmit(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [showSubmit, submitting]);

  useEffect(() => {
    if (!imageExpanded) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setImageExpanded(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [imageExpanded]);

  function persistLocalAnswers(nextAttempt: Attempt, nextFlagged = flagged) {
    const local = loadAttempt(attemptId) ?? createOrResumeAttempt();
    saveLocalAttempt({
      ...local,
      answers: nextAttempt.answers,
      flagged: nextFlagged,
    });
  }

  function chooseOption(optionIndex: number) {
    if (!attempt || !question) return;
    const current = attempt.answers[question.id] ?? [];
    const nextSelection =
      question.type === "single"
        ? [optionIndex]
        : current.includes(optionIndex)
          ? current.filter((index) => index !== optionIndex)
          : [...current, optionIndex].sort((left, right) => left - right);
    const nextAttempt = {
      ...attempt,
      answers: { ...attempt.answers, [question.id]: nextSelection },
    };
    setAttempt(nextAttempt);
    setSaveState("saving");

    if (!configured) {
      persistLocalAnswers(nextAttempt);
      window.setTimeout(() => setSaveState("saved"), 250);
      return;
    }
    if (!session) return;
    sequence.current = Math.max(
      sequence.current + 1,
      Math.floor(Date.now() / 1_000),
    );
    const currentSequence = sequence.current;
    pendingSaves.current = pendingSaves.current
      .then(async () => {
        await saveAttemptAnswer(session.idToken, attempt.id, {
          questionId: question.id,
          selectedOptions: nextSelection,
          sequence: currentSequence,
        });
        setSaveState("saved");
      })
      .catch(() => {
        setSaveState("offline");
      });
  }

  function toggleFlag() {
    if (!attempt || !question) return;
    const nextFlagged = flagged.includes(question.id)
      ? flagged.filter((id) => id !== question.id)
      : [...flagged, question.id];
    setFlagged(nextFlagged);
    if (!configured) persistLocalAnswers(attempt, nextFlagged);
  }

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-slate-50">
        <p className="font-semibold text-slate-600">Đang chuẩn bị bài thi...</p>
      </div>
    );
  }

  if (!attempt || !exam || !question) {
    return (
      <div className="grid min-h-dvh place-items-center bg-slate-50 p-4">
        <Card className="max-w-md p-7 text-center">
          <h1 className="font-heading text-2xl font-bold">
            Chưa thể mở bài thi
          </h1>
          <p className="mt-2 text-slate-600">
            {error || "Dữ liệu bài thi không đầy đủ."}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-50 text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-3 px-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <img
              src="/logo.png"
              alt="OnThiLab Mascot"
              className="size-10 object-contain drop-shadow-sm shrink-0"
            />
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-xs font-semibold text-slate-500">
                {exam.courseCode} · {exam.semester}
              </p>
              <h1 className="truncate font-heading text-sm font-bold">
                Thi thử FE
              </h1>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <div
              className={cn(
                "hidden items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold sm:flex",
                saveState === "offline"
                  ? "bg-red-50 text-red-700"
                  : "bg-slate-100 text-slate-600",
              )}
              aria-live="polite"
            >
              {saveState === "saved" ? (
                <Check size={15} aria-hidden="true" />
              ) : (
                <Save size={15} aria-hidden="true" />
              )}
              {saveState === "saved"
                ? "Đã lưu"
                : saveState === "saving"
                  ? "Đang lưu..."
                  : "Mất kết nối"}
            </div>
            <div
              className={cn(
                "flex min-w-24 items-center justify-center gap-2 rounded-xl px-3 py-2 font-heading text-base font-bold tabular-nums sm:min-w-28",
                isLowTime
                  ? "bg-red-50 text-red-700"
                  : "bg-primary-soft text-primary",
              )}
              aria-label={`Thời gian còn lại ${formatTime(remainingSeconds)}`}
            >
              <Clock3 size={18} aria-hidden="true" />
              {formatTime(remainingSeconds)}
            </div>
            <Button
              className="min-h-10 px-3 sm:px-4"
              icon={<Send size={16} />}
              onClick={() => setShowSubmit(true)}
            >
              <span className="hidden sm:inline">Nộp bài</span>
              <span className="sm:hidden">Nộp</span>
            </Button>
          </div>
        </div>
      </header>

      {error && (
        <div
          className="mx-auto mt-4 max-w-[1560px] rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="mx-auto grid max-w-[1600px] gap-4 p-3 sm:p-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <main className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3 lg:hidden">
            <p className="text-sm font-semibold text-slate-600">
              Câu {currentIndex + 1}/{questions.length}
            </p>
            <p className="text-sm text-slate-500">{answeredCount} đã trả lời</p>
          </div>

          <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
              <div className="flex items-center gap-3">
                <span className="font-heading text-lg font-bold">
                  Câu {currentIndex + 1}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  {question.type === "single"
                    ? "Chọn 1 đáp án"
                    : "Chọn nhiều đáp án"}
                </span>
              </div>
              <button
                type="button"
                onClick={toggleFlag}
                className={cn(
                  "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20",
                  flagged.includes(question.id)
                    ? "bg-amber-50 text-amber-700"
                    : "text-slate-500 hover:bg-slate-100 hover:text-foreground",
                )}
              >
                <Flag
                  size={17}
                  fill={flagged.includes(question.id) ? "currentColor" : "none"}
                  aria-hidden="true"
                />
                Đánh dấu
              </button>
            </div>

            <div className="bg-white p-3 sm:p-6">
              <QuestionContent
                presentationMode={question.contentMode}
                textContent={question.textContent}
                options={question.options}
                showOptions={false}
                imageUrl={questionImageUrl(question.imageUrl)}
                imageAlt={question.imageAlt}
                order={currentIndex + 1}
                onExpandImage={() => setImageExpanded(true)}
              />
            </div>

            <div className="border-t border-border bg-slate-50/80 p-4 sm:p-5">
              <fieldset>
                <legend className="mb-3 text-sm font-semibold text-slate-600">
                  Chọn đáp án của bạn:
                </legend>
                <div className="flex flex-col items-start gap-3">
                  <div className="grid w-full gap-2 sm:grid-cols-2">
                    {question.options.map((option, optionIndex) => {
                      const selected = selectedOptions.includes(optionIndex);
                      return (
                        <button
                          key={option}
                          type="button"
                          role={
                            question.type === "single" ? "radio" : "checkbox"
                          }
                          aria-checked={selected}
                          onClick={() => chooseOption(optionIndex)}
                          className={cn(
                            "group relative flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-xl border-2 px-3 text-left transition-[color,background-color,border-color,box-shadow,transform] duration-200 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/40 motion-reduce:transform-none motion-reduce:transition-none",
                            selected
                              ? "border-primary bg-primary text-white shadow-md shadow-primary/20"
                              : "border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm",
                          )}
                          aria-label={`Chọn đáp án ${String.fromCharCode(65 + optionIndex)}: ${option}`}
                        >
                          <span
                            className={cn(
                              "grid size-8 shrink-0 place-items-center rounded-lg text-sm font-bold",
                              selected
                                ? "bg-white/20 text-white"
                                : "bg-slate-100 text-slate-700",
                            )}
                          >
                            {String.fromCharCode(65 + optionIndex)}
                          </span>
                          <span className="whitespace-pre-wrap text-sm font-medium sm:text-base">
                            {option}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="secondary"
                      className="min-w-28"
                      disabled={currentIndex === 0}
                      onClick={() =>
                        setCurrentIndex((index) => Math.max(0, index - 1))
                      }
                      icon={<ChevronLeft size={18} />}
                    >
                      Câu trước
                    </Button>
                    <Button
                      className="min-w-28"
                      disabled={currentIndex === questions.length - 1}
                      onClick={() =>
                        setCurrentIndex((index) =>
                          Math.min(questions.length - 1, index + 1),
                        )
                      }
                    >
                      Câu sau
                      <ChevronRight size={18} aria-hidden="true" />
                    </Button>
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  Đáp án được lưu tự động sau khi chọn.
                </p>
              </fieldset>
            </div>
          </section>

          <nav
            className="mt-4 flex gap-2 overflow-x-auto rounded-2xl border border-border bg-white p-3 lg:hidden"
            aria-label="Danh sách câu hỏi"
          >
            {questions.map((item, index) => (
              <QuestionNumber
                key={item.id}
                number={index + 1}
                current={currentIndex === index}
                answered={(attempt.answers[item.id]?.length ?? 0) > 0}
                flagged={flagged.includes(item.id)}
                onClick={() => setCurrentIndex(index)}
              />
            ))}
          </nav>
        </main>

        <aside className="hidden lg:block">
          <div className="sticky top-21 rounded-2xl border border-border bg-white p-5 shadow-card">
            <div className="flex items-center justify-between">
              <h2 className="font-heading font-bold">Danh sách câu</h2>
              <span className="text-xs font-semibold text-slate-500">
                {answeredCount}/{questions.length}
              </span>
            </div>
            <div
              className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
              aria-label="Tiến độ trả lời"
              aria-valuenow={answeredCount}
              aria-valuemin={0}
              aria-valuemax={questions.length}
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-5 grid grid-cols-5 gap-2">
              {questions.map((item, index) => (
                <QuestionNumber
                  key={item.id}
                  number={index + 1}
                  current={currentIndex === index}
                  answered={(attempt.answers[item.id]?.length ?? 0) > 0}
                  flagged={flagged.includes(item.id)}
                  onClick={() => setCurrentIndex(index)}
                />
              ))}
            </div>
            <div className="mt-6 space-y-2.5 border-t border-border pt-5 text-xs text-slate-500">
              <Legend color="bg-primary" label="Câu hiện tại" />
              <Legend color="bg-emerald-500" label="Đã trả lời" />
              <Legend
                color="border-2 border-slate-300 bg-white"
                label="Chưa trả lời"
              />
              <Legend color="bg-amber-400" label="Đã đánh dấu" />
            </div>
            <div className="mt-5 flex items-start gap-2 rounded-xl bg-blue-50 p-3 text-xs leading-5 text-blue-800">
              <Bookmark
                size={15}
                className="mt-0.5 shrink-0"
                aria-hidden="true"
              />
              Câu trả lời được lưu tự động vào hệ thống.
            </div>
          </div>
        </aside>
      </div>

      {showSubmit && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target && !submitting) {
              setShowSubmit(false);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="submit-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-modal sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <span className="grid size-11 place-items-center rounded-xl bg-amber-50 text-amber-700">
                <AlertTriangle size={22} aria-hidden="true" />
              </span>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowSubmit(false)}
                className="grid size-11 cursor-pointer place-items-center rounded-xl text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20"
                aria-label="Đóng hộp thoại"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <h2
              id="submit-title"
              className="mt-5 font-heading text-xl font-bold"
            >
              Xác nhận nộp bài?
            </h2>
            <p className="mt-2 leading-6 text-slate-600">
              Bạn đã trả lời{" "}
              <strong>
                {answeredCount}/{questions.length}
              </strong>{" "}
              câu. Sau khi nộp, bạn không thể thay đổi đáp án.
            </p>
            {answeredCount < questions.length && (
              <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">
                Còn {questions.length - answeredCount} câu chưa trả lời.
              </p>
            )}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Button
                variant="secondary"
                disabled={submitting}
                onClick={() => setShowSubmit(false)}
              >
                Tiếp tục làm
              </Button>
              <Button
                disabled={submitting}
                onClick={() => void finishAttempt("user")}
                icon={<Send size={17} />}
              >
                {submitting ? "Đang nộp..." : "Nộp bài"}
              </Button>
            </div>
          </section>
        </div>
      )}

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
              Câu {currentIndex + 1} · kéo ngang để xem toàn bộ
            </p>
            <button
              type="button"
              onClick={() => setImageExpanded(false)}
              className="grid size-11 cursor-pointer place-items-center rounded-xl bg-white/10 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-white/40"
              aria-label="Đóng ảnh phóng to"
            >
              <X aria-hidden="true" />
            </button>
          </div>
          <section
            role="dialog"
            aria-modal="true"
            aria-label={`Ảnh phóng to câu ${currentIndex + 1}`}
            className="min-h-0 flex-1 overflow-auto rounded-xl bg-white p-4"
          >
            <QuestionContent
              presentationMode={question.contentMode}
              textContent={question.textContent}
              options={question.options}
              imageUrl={questionImageUrl(question.imageUrl)}
              imageAlt={`Chi tiết ${question.imageAlt}`}
            />
          </section>
        </div>
      )}
    </div>
  );
}

function QuestionNumber({
  number,
  current,
  answered,
  flagged,
  onClick,
}: {
  number: number;
  current: boolean;
  answered: boolean;
  flagged: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={current ? "step" : undefined}
      aria-label={`Câu ${number}${answered ? ", đã trả lời" : ""}${flagged ? ", đã đánh dấu" : ""}`}
      className={cn(
        "relative grid size-10 shrink-0 cursor-pointer place-items-center rounded-lg border text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20",
        current
          ? "border-primary bg-primary text-white"
          : answered
            ? "border-emerald-500 bg-emerald-50 text-emerald-700"
            : "border-slate-300 bg-white text-slate-600 hover:border-primary hover:text-primary",
      )}
    >
      {number}
      {flagged && (
        <span
          className="absolute -right-1 -top-1 size-2.5 rounded-full border-2 border-white bg-amber-400"
          aria-hidden="true"
        />
      )}
    </button>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("size-3 rounded", color)} aria-hidden="true" />
      {label}
    </div>
  );
}

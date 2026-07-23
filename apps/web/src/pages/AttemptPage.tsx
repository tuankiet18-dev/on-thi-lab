import {
  AlertTriangle,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Flag,
  GraduationCap,
  Save,
  Send,
  X,
} from "lucide-react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../components/ui/Button";
import { demoExam } from "../data/demo";
import {
  createOrResumeAttempt,
  loadAttempt,
  saveAttempt,
  submitAttempt,
  type LocalAttempt,
} from "../lib/attempt-storage";
import { cn } from "../lib/cn";

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
  const [attempt, setAttempt] = useState<LocalAttempt>(() => {
    return loadAttempt(attemptId) ?? createOrResumeAttempt();
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    Math.max(0, Math.ceil((Date.parse(attempt.expiresAt) - Date.now()) / 1000)),
  );
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [showSubmit, setShowSubmit] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didAutoSubmit = useRef(false);

  const finishAttempt = useCallback(
    (reason: "user" | "timeout") => {
      const submitted = submitAttempt(attempt, reason);
      setAttempt(submitted);
      void navigate({
        to: "/results/$attemptId",
        params: { attemptId: submitted.id },
        replace: true,
      });
    },
    [attempt, navigate],
  );

  useEffect(() => {
    const interval = window.setInterval(() => {
      const next = Math.max(
        0,
        Math.ceil((Date.parse(attempt.expiresAt) - Date.now()) / 1000),
      );
      setRemainingSeconds(next);
      if (next === 0 && !didAutoSubmit.current && !attempt.result) {
        didAutoSubmit.current = true;
        finishAttempt("timeout");
      }
    }, 1_000);

    return () => window.clearInterval(interval);
  }, [attempt.expiresAt, attempt.result, finishAttempt]);

  useEffect(() => {
    const warnBeforeLeave = (event: BeforeUnloadEvent) => {
      if (!attempt.result) {
        event.preventDefault();
      }
    };
    window.addEventListener("beforeunload", warnBeforeLeave);
    return () => window.removeEventListener("beforeunload", warnBeforeLeave);
  }, [attempt.result]);

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );

  const question = demoExam.questions[currentIndex] ?? demoExam.questions[0]!;
  const answeredCount = Object.values(attempt.answers).filter(
    (answer) => answer.length > 0,
  ).length;
  const selectedOptions = attempt.answers[question.id] ?? [];
  const isLowTime = remainingSeconds <= 300;

  const progress = useMemo(
    () => Math.round((answeredCount / demoExam.questionCount) * 100),
    [answeredCount],
  );

  function updateAttempt(nextAttempt: LocalAttempt) {
    setAttempt(nextAttempt);
    saveAttempt(nextAttempt);
    setSaveState(navigator.onLine ? "saving" : "offline");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setSaveState(navigator.onLine ? "saved" : "offline");
    }, 450);
  }

  function chooseOption(optionIndex: number) {
    const current = attempt.answers[question.id] ?? [];
    const nextSelection =
      question.type === "single"
        ? [optionIndex]
        : current.includes(optionIndex)
          ? current.filter((index) => index !== optionIndex)
          : [...current, optionIndex].sort((a, b) => a - b);
    updateAttempt({
      ...attempt,
      answers: { ...attempt.answers, [question.id]: nextSelection },
    });
  }

  function toggleFlag() {
    const isFlagged = attempt.flagged.includes(question.id);
    updateAttempt({
      ...attempt,
      flagged: isFlagged
        ? attempt.flagged.filter((id) => id !== question.id)
        : [...attempt.flagged, question.id],
    });
  }

  return (
    <div className="min-h-screen bg-slate-50 text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-3 px-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-white">
              <GraduationCap size={20} aria-hidden="true" />
            </span>
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-xs font-semibold text-slate-500">
                {demoExam.courseCode} · {demoExam.semester}
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

      <div className="mx-auto grid max-w-[1600px] gap-4 p-3 sm:p-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <main className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3 lg:hidden">
            <p className="text-sm font-semibold text-slate-600">
              Câu {currentIndex + 1}/{demoExam.questionCount}
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
                  "inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20",
                  attempt.flagged.includes(question.id)
                    ? "bg-amber-50 text-amber-700"
                    : "text-slate-500 hover:bg-slate-100 hover:text-foreground",
                )}
              >
                <Flag
                  size={17}
                  fill={
                    attempt.flagged.includes(question.id)
                      ? "currentColor"
                      : "none"
                  }
                  aria-hidden="true"
                />
                Đánh dấu
              </button>
            </div>

            <div className="bg-white p-3 sm:p-6">
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <img
                  src={question.imageUrl}
                  alt={question.imageAlt}
                  className="h-auto max-h-[55vh] w-full object-contain"
                  width="1200"
                  height="520"
                />
              </div>
            </div>

            <div className="border-t border-border bg-slate-50/80 p-4 sm:p-6">
              <fieldset>
                <legend className="mb-3 text-sm font-semibold text-slate-600">
                  Chọn đáp án của bạn:
                </legend>
                <div
                  className={cn(
                    "grid gap-3",
                    question.options.length > 4 && "sm:grid-cols-2",
                  )}
                >
                  {question.options.map((option, optionIndex) => {
                    const selected = selectedOptions.includes(optionIndex);
                    return (
                      <button
                        key={option}
                        type="button"
                        role={question.type === "single" ? "radio" : "checkbox"}
                        aria-checked={selected}
                        onClick={() => chooseOption(optionIndex)}
                        className={cn(
                          "group flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border bg-white px-4 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20",
                          selected
                            ? "border-primary bg-primary-soft text-primary shadow-sm"
                            : "border-border-strong text-slate-700 hover:border-blue-300 hover:bg-blue-50/40",
                        )}
                      >
                        <span
                          className={cn(
                            "grid size-8 shrink-0 place-items-center border text-sm font-bold transition-colors",
                            question.type === "single"
                              ? "rounded-full"
                              : "rounded-lg",
                            selected
                              ? "border-primary bg-primary text-white"
                              : "border-slate-300 bg-white text-slate-600 group-hover:border-primary",
                          )}
                        >
                          {selected ? (
                            <Check size={16} aria-hidden="true" />
                          ) : (
                            option
                          )}
                        </span>
                        <span className="font-semibold">Đáp án {option}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-border p-4 sm:p-5">
              <Button
                variant="secondary"
                disabled={currentIndex === 0}
                onClick={() =>
                  setCurrentIndex((index) => Math.max(0, index - 1))
                }
                icon={<ChevronLeft size={18} />}
              >
                Câu trước
              </Button>
              <Button
                disabled={currentIndex === demoExam.questionCount - 1}
                onClick={() =>
                  setCurrentIndex((index) =>
                    Math.min(demoExam.questionCount - 1, index + 1),
                  )
                }
              >
                Câu tiếp
                <ChevronRight size={18} aria-hidden="true" />
              </Button>
            </div>
          </section>

          <nav
            className="mt-4 flex gap-2 overflow-x-auto rounded-2xl border border-border bg-white p-3 lg:hidden"
            aria-label="Danh sách câu hỏi"
          >
            {demoExam.questions.map((item, index) => (
              <QuestionNumber
                key={item.id}
                number={index + 1}
                current={currentIndex === index}
                answered={(attempt.answers[item.id]?.length ?? 0) > 0}
                flagged={attempt.flagged.includes(item.id)}
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
                {answeredCount}/{demoExam.questionCount}
              </span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-5 grid grid-cols-5 gap-2">
              {demoExam.questions.map((item, index) => (
                <QuestionNumber
                  key={item.id}
                  number={index + 1}
                  current={currentIndex === index}
                  answered={(attempt.answers[item.id]?.length ?? 0) > 0}
                  flagged={attempt.flagged.includes(item.id)}
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
              Câu trả lời được lưu tự động trên thiết bị này.
            </div>
          </div>
        </aside>
      </div>

      {showSubmit && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setShowSubmit(false);
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
                onClick={() => setShowSubmit(false)}
                className="grid size-10 cursor-pointer place-items-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20"
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
                {answeredCount}/{demoExam.questionCount}
              </strong>{" "}
              câu. Sau khi nộp, bạn không thể thay đổi đáp án.
            </p>
            {answeredCount < demoExam.questionCount && (
              <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">
                Còn {demoExam.questionCount - answeredCount} câu chưa trả lời.
              </p>
            )}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Button variant="secondary" onClick={() => setShowSubmit(false)}>
                Tiếp tục làm
              </Button>
              <Button
                onClick={() => finishAttempt("user")}
                icon={<Send size={17} />}
              >
                Nộp bài
              </Button>
            </div>
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

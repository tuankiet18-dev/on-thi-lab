import type { ReviewQuestion } from "@onthilab/contracts";
import { AlertTriangle, Check } from "lucide-react";
import { Card } from "../../../components/ui/Card";
import { cn } from "../../../lib/cn";

type ReviewQuestionNavigatorProps = {
  autoSavedCount: number;
  currentIndex: number;
  onQuestionChange: (index: number) => void;
  onFilterChange: (value: "answers" | "options" | "all") => void;
  pendingCount: number;
  optionWarningCount: number;
  questions: ReviewQuestion[];
  filter: "answers" | "options" | "all";
};

export function ReviewQuestionNavigator({
  autoSavedCount,
  currentIndex,
  onQuestionChange,
  onFilterChange,
  pendingCount,
  optionWarningCount,
  questions,
  filter,
}: ReviewQuestionNavigatorProps) {
  return (
    <Card className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading font-bold">Danh sách câu</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {autoSavedCount} tự lưu · {pendingCount} cần xác nhận đáp án ·{" "}
            {optionWarningCount} cảnh báo lựa chọn
          </p>
        </div>
        <div
          className="inline-flex rounded-xl border border-border bg-slate-50 p-1"
          aria-label="Lọc danh sách câu"
        >
          <button
            type="button"
            onClick={() => onFilterChange("answers")}
            className={cn(
              "min-h-10 cursor-pointer rounded-lg px-3 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25",
              filter === "answers"
                ? "bg-white text-primary shadow-sm"
                : "text-slate-600",
            )}
            aria-pressed={filter === "answers"}
          >
            Cần xác nhận ({pendingCount})
          </button>
          <button
            type="button"
            onClick={() => onFilterChange("options")}
            className={cn(
              "min-h-10 cursor-pointer rounded-lg px-3 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25",
              filter === "options"
                ? "bg-white text-primary shadow-sm"
                : "text-slate-600",
            )}
            aria-pressed={filter === "options"}
          >
            OCR cảnh báo ({optionWarningCount})
          </button>
          <button
            type="button"
            onClick={() => onFilterChange("all")}
            className={cn(
              "min-h-10 cursor-pointer rounded-lg px-3 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25",
              filter === "all"
                ? "bg-white text-primary shadow-sm"
                : "text-slate-600",
            )}
            aria-pressed={filter === "all"}
          >
            Tất cả ({questions.length})
          </button>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-6 gap-2 sm:grid-cols-10 xl:grid-cols-12">
        {questions.map((question, index) => {
          const answered = question.correctOptions.length > 0;
          const suggested = question.aiSuggestion?.status === "suggested";
          const optionWarning = ["uncertain", "conflict", "failed"].includes(
            question.optionCountCheck?.status ?? "",
          );
          const active = index === currentIndex;
          if (filter === "answers" && answered && !active) return null;
          if (filter === "options" && !optionWarning && !active) return null;
          return (
            <button
              key={question.id}
              type="button"
              onClick={() => onQuestionChange(index)}
              className={cn(
                "relative grid size-11 cursor-pointer place-items-center rounded-lg border text-sm font-bold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25",
                active
                  ? "border-primary bg-primary text-white"
                  : optionWarning
                    ? "border-amber-300 bg-amber-50 text-amber-800"
                    : answered
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : suggested
                        ? "border-amber-300 bg-amber-50 text-amber-800"
                        : "border-border bg-white text-slate-600 hover:border-primary/40 hover:bg-primary-soft",
              )}
              aria-label={`Câu ${question.order}${answered ? ", đã có đáp án" : `, ${question.answerReviewReason?.message ?? "chưa có đáp án"}`}${optionWarning ? `, ${question.optionCountCheck?.reason ?? "OCR cần kiểm tra"}` : ""}`}
              title={
                optionWarning
                  ? (question.optionCountCheck?.reason ?? undefined)
                  : question.answerReviewReason?.message
              }
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
              {(optionWarning || (suggested && !answered)) && !active && (
                <AlertTriangle
                  size={9}
                  className="absolute right-0.5 top-0.5"
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

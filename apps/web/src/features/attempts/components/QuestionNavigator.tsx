import { Bookmark } from "lucide-react";
import { cn } from "../../../lib/cn";

interface QuestionNavigatorProps {
  questionIds: string[];
  currentIndex: number;
  answers: Record<string, number[]>;
  flaggedQuestionIds: string[];
  answeredCount: number;
  onSelect: (index: number) => void;
}

export function MobileQuestionNavigator(props: QuestionNavigatorProps) {
  return (
    <nav
      className="mt-4 flex gap-2 overflow-x-auto rounded-2xl border border-border bg-white p-3 lg:hidden"
      aria-label="Danh sách câu hỏi"
    >
      {renderQuestionNumbers(props)}
    </nav>
  );
}

export function DesktopQuestionNavigator(props: QuestionNavigatorProps) {
  const progress = Math.round(
    (props.answeredCount / props.questionIds.length) * 100,
  );
  return (
    <aside className="hidden lg:block">
      <div className="sticky top-21 rounded-2xl border border-border bg-white p-5 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-bold">Danh sách câu</h2>
          <span className="text-xs font-semibold text-slate-500">
            {props.answeredCount}/{props.questionIds.length}
          </span>
        </div>
        <div
          className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-label="Tiến độ trả lời"
          aria-valuenow={props.answeredCount}
          aria-valuemin={0}
          aria-valuemax={props.questionIds.length}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-5 grid grid-cols-5 gap-2">
          {renderQuestionNumbers(props)}
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
          <Bookmark size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
          Câu trả lời được lưu tự động vào hệ thống.
        </div>
      </div>
    </aside>
  );
}

function renderQuestionNumbers(props: QuestionNavigatorProps) {
  return props.questionIds.map((questionId, index) => (
    <QuestionNumber
      key={questionId}
      number={index + 1}
      current={props.currentIndex === index}
      answered={(props.answers[questionId]?.length ?? 0) > 0}
      flagged={props.flaggedQuestionIds.includes(questionId)}
      onClick={() => props.onSelect(index)}
    />
  ));
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

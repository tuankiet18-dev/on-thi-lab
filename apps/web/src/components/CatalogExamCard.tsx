import type { AttemptSummary, ExamSummary } from "@onthilab/contracts";
import { Link } from "@tanstack/react-router";
import { ArrowRight, BookOpenCheck, Clock3, MapPin } from "lucide-react";
import { Badge } from "./ui/Badge";

interface CatalogExamCardProps {
  exam: ExamSummary;
  attempt?: AttemptSummary;
  showExamType: boolean;
}

interface CatalogAction {
  label: string;
  status?: string;
  statusTone?: "amber" | "green";
}

function getCatalogAction(attempt?: AttemptSummary): CatalogAction {
  if (attempt?.status === "in_progress") {
    return {
      label: "Tiếp tục làm",
      status: "Đang làm dở",
      statusTone: "amber",
    };
  }
  if (attempt?.result) {
    return {
      label: "Xem kết quả",
      status: "Đã hoàn thành",
      statusTone: "green",
    };
  }
  return { label: "Xem đề" };
}

function CardContent({
  exam,
  action,
  showExamType,
  attempt,
}: {
  exam: ExamSummary;
  action: CatalogAction;
  showExamType: boolean;
  attempt?: AttemptSummary;
}) {
  return (
    <>
      <div className="flex items-start gap-3">
        <span
          className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft font-heading text-sm font-bold text-primary"
          aria-hidden="true"
        >
          {exam.courseCode.slice(0, 3)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {showExamType && <Badge tone="blue">{exam.examType}</Badge>}
            <Badge tone="slate">{exam.semester}</Badge>
            {exam.isRetake && <Badge tone="pink">Retake</Badge>}
          </div>
          <p className="mt-3 text-xs font-bold uppercase tracking-wider text-primary">
            {exam.courseCode} · {exam.code}
          </p>
          <h2
            className="mt-1 line-clamp-2 font-heading text-lg font-bold leading-6 text-foreground"
            title={exam.courseName}
          >
            {exam.courseName}
          </h2>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-600">
        <span className="flex items-center gap-1.5">
          <BookOpenCheck size={15} aria-hidden="true" />
          {exam.questionCount} câu
        </span>
        <span className="flex items-center gap-1.5">
          <Clock3 size={15} aria-hidden="true" />
          {exam.durationMinutes} phút
        </span>
        <span className="flex items-center gap-1.5">
          <MapPin size={15} aria-hidden="true" />
          {exam.campus}
        </span>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
        <span className="inline-flex min-h-6 items-center gap-1.5 text-sm font-semibold text-slate-600">
          {action.status ? (
            <>
              <Badge tone={action.statusTone}>{action.status}</Badge>
              {attempt?.result && (
                <span className="text-slate-500">
                  Điểm {attempt.result.score}/10
                </span>
              )}
            </>
          ) : (
            "Sẵn sàng luyện tập"
          )}
        </span>
        <span className="inline-flex min-h-11 shrink-0 items-center gap-1.5 text-sm font-bold text-primary">
          {action.label}
          <ArrowRight
            size={16}
            className="transition-transform duration-200 group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </span>
      </div>
    </>
  );
}

export function CatalogExamCard({
  exam,
  attempt,
  showExamType,
}: CatalogExamCardProps) {
  const action = getCatalogAction(attempt);
  const className =
    "group flex min-h-72 cursor-pointer flex-col rounded-2xl border border-border bg-white p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-panel active:translate-y-0 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25";
  const content = (
    <CardContent
      exam={exam}
      action={action}
      attempt={attempt}
      showExamType={showExamType}
    />
  );

  if (attempt?.status === "in_progress") {
    return (
      <Link
        to="/attempts/$attemptId"
        params={{ attemptId: attempt.id }}
        className={className}
        aria-label={`Tiếp tục làm đề ${exam.courseCode}: ${exam.courseName}`}
      >
        {content}
      </Link>
    );
  }

  if (attempt?.result) {
    return (
      <Link
        to="/results/$attemptId"
        params={{ attemptId: attempt.id }}
        className={className}
        aria-label={`Xem kết quả đề ${exam.courseCode}: ${exam.courseName}`}
      >
        {content}
      </Link>
    );
  }

  return (
    <Link
      to="/exams/$examId"
      params={{ examId: exam.id }}
      className={className}
      aria-label={`Xem đề ${exam.courseCode}: ${exam.courseName}`}
    >
      {content}
    </Link>
  );
}

export function CatalogExamCardSkeleton() {
  return (
    <div
      className="min-h-72 animate-pulse rounded-2xl border border-border bg-white p-5 shadow-card"
      aria-hidden="true"
    >
      <div className="flex gap-3">
        <div className="size-11 rounded-xl bg-slate-100" />
        <div className="flex-1 space-y-3">
          <div className="h-5 w-28 rounded-full bg-slate-100" />
          <div className="h-3 w-2/3 rounded bg-slate-100" />
          <div className="h-6 w-full rounded bg-slate-100" />
        </div>
      </div>
      <div className="mt-6 flex gap-3">
        <div className="h-4 w-16 rounded bg-slate-100" />
        <div className="h-4 w-16 rounded bg-slate-100" />
        <div className="h-4 w-24 rounded bg-slate-100" />
      </div>
      <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
        <div className="h-4 w-28 rounded bg-slate-100" />
        <div className="h-5 w-20 rounded bg-slate-100" />
      </div>
    </div>
  );
}

import type { DraftExamReview } from "@onthilab/contracts";
import { Badge } from "../../../components/ui/Badge";

type ReviewHeaderProps = {
  review: DraftExamReview;
};

export function ReviewHeader({ review }: ReviewHeaderProps) {
  const progress = Math.round(
    (review.answeredCount / review.questionCount) * 100,
  );

  return (
    <header className="flex flex-col gap-4 rounded-2xl border border-border bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={review.status === "draft" ? "amber" : "green"}>
            {review.status === "published"
              ? "Đã xuất bản"
              : review.status === "review"
                ? "Chờ xuất bản"
                : "Đang duyệt"}
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
          <span className="font-semibold text-slate-700">Đáp án đã lưu</span>
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
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </header>
  );
}

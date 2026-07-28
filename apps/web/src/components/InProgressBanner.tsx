import type { AttemptSummary } from "@onthilab/contracts";
import { ArrowRight, PlayCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";

interface InProgressBannerProps {
  attempt: AttemptSummary;
}

/**
 * Displays a prominent banner when the student has an in-progress attempt.
 * Renders null when there is no in-progress attempt — the parent is
 * responsible for not rendering this component at all in that case.
 */
export function InProgressBanner({ attempt }: InProgressBannerProps) {
  return (
    <section aria-label="Bài đang làm dở">
      <div className="flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-center gap-3">
          <span
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-600"
            aria-hidden="true"
          >
            <PlayCircle size={21} />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-700">
              Bài đang làm dở
            </p>
            <p className="mt-0.5 truncate font-heading text-base font-bold text-amber-900">
              {attempt.courseCode} · {attempt.examCode}
            </p>
          </div>
        </div>
        <Link
          to="/attempts/$attemptId"
          params={{ attemptId: attempt.id }}
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 self-start rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-amber-600 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-amber-400/40 sm:self-auto"
        >
          Tiếp tục làm bài
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

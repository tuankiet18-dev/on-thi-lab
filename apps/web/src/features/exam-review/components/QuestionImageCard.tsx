import type { ReviewQuestion } from "@onthilab/contracts";
import { Maximize2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Card } from "../../../components/ui/Card";
import { questionImageUrl } from "../../../lib/question-image-url";

type QuestionImageCardProps = {
  currentIndex: number;
  examCode: string;
  question: ReviewQuestion;
  questionCount: number;
};

export function QuestionImageCard({
  currentIndex,
  examCode,
  question,
  questionCount,
}: QuestionImageCardProps) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [expanded]);

  const imageUrl = questionImageUrl(question.imageUrl);

  return (
    <>
      <Card className="overflow-hidden xl:col-start-1 xl:row-start-1 xl:self-start">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="font-heading text-lg font-bold">
            Câu {question.order}
          </h2>
          <span className="text-sm tabular-nums text-slate-500">
            {currentIndex + 1}/{questionCount}
          </span>
        </div>
        <div className="bg-slate-50 p-3 sm:p-5">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="group relative block w-full cursor-zoom-in rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25"
            aria-label={`Mở rộng ảnh câu hỏi ${question.order}`}
          >
            <img
              src={imageUrl}
              alt={`Câu hỏi ${question.order} của đề ${examCode}`}
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

      {expanded && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-slate-950/90 p-3 backdrop-blur-sm sm:p-6"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setExpanded(false);
          }}
        >
          <div className="mb-3 flex items-center justify-between text-white">
            <p className="font-heading font-bold">
              Câu {question.order} · kéo ngang để xem toàn bộ
            </p>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="grid size-11 cursor-pointer place-items-center rounded-xl bg-white/10 transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-white/40"
              aria-label="Đóng ảnh phóng to"
            >
              <X aria-hidden="true" />
            </button>
          </div>
          <section
            role="dialog"
            aria-modal="true"
            aria-label={`Ảnh phóng to câu ${question.order}`}
            className="min-h-0 flex-1 overflow-auto rounded-xl bg-white"
          >
            <img
              src={imageUrl}
              alt={`Ảnh phóng to câu hỏi ${question.order}`}
              width={1920}
              height={620}
              className="h-auto min-w-[1000px] max-w-none sm:min-w-full"
            />
          </section>
        </div>
      )}
    </>
  );
}

import type { ReviewQuestion } from "@onthilab/contracts";
import { Maximize2 } from "lucide-react";
import { useState } from "react";
import { Card } from "../../../components/ui/Card";
import { ImageViewerModal } from "../../../components/ImageViewerModal";
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

      <ImageViewerModal
        isOpen={expanded}
        onClose={() => setExpanded(false)}
        imageUrl={imageUrl}
        imageAlt={`Ảnh phóng to câu hỏi ${question.order}`}
        title={`Câu ${question.order} / ${questionCount}`}
        subtitle={`Đề ${examCode}`}
      />
    </>
  );
}

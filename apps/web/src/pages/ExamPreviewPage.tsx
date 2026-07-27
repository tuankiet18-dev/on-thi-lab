import type { Exam } from "@onthilab/contracts";
import { Link, useParams } from "@tanstack/react-router";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Eye,
  Info,
  Maximize2,
  Play,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { demoExam } from "../data/demo";
import { getPublishedExam } from "../lib/api";
import { cn } from "../lib/cn";
import { questionImageUrl } from "../lib/question-image-url";

export function ExamPreviewPage() {
  const { examId } = useParams({ from: "/exams/$examId/preview" });
  const { configured, session } = useAuth();
  const [exam, setExam] = useState<Exam | null>(configured ? null : demoExam);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(Boolean(session));
  const [error, setError] = useState("");
  const [imageExpanded, setImageExpanded] = useState(false);

  useEffect(() => {
    if (!exam) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input (not likely here, but good practice)
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if (e.key === "ArrowLeft") {
        setCurrentIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === "ArrowRight") {
        setCurrentIndex((prev) =>
          Math.min(exam.questions.length - 1, prev + 1),
        );
      } else if (e.key === "Escape") {
        setImageExpanded(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [exam]);

  useEffect(() => {
    if (!session) return;
    let active = true;
    setLoading(true);
    void getPublishedExam(session.idToken, examId)
      .then((result) => {
        if (active) {
          setExam(result);
          setCurrentIndex(0);
        }
      })
      .catch(() => {
        if (active) setError("Không thể tải đề để xem trước.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [examId, session]);

  if (loading) {
    return (
      <Card className="mx-auto min-h-72 max-w-5xl animate-pulse bg-slate-100" />
    );
  }

  if (!exam || error) {
    return (
      <Card className="mx-auto max-w-lg p-8 text-center">
        <h1 className="font-heading text-2xl font-bold">Chưa thể xem đề</h1>
        <p className="mt-2 text-slate-600">
          {error || "Đề thi không tồn tại hoặc chưa được xuất bản."}
        </p>
        <Link
          to="/exams"
          className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-primary px-4 font-bold text-white"
        >
          Quay lại kho đề
        </Link>
      </Card>
    );
  }

  const question = exam.questions[currentIndex];
  if (!question) return null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/exams/$examId"
          params={{ examId: exam.id }}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg text-sm font-semibold text-slate-600 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20"
        >
          <ArrowLeft size={17} aria-hidden="true" />
          Thông tin đề thi
        </Link>
        <Link
          to="/exams/$examId"
          params={{ examId: exam.id }}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25"
        >
          <Play size={17} fill="currentColor" aria-hidden="true" />
          Bắt đầu thi thử
        </Link>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-border bg-linear-to-r from-primary-soft to-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            {/* <Badge tone="blue">Chế độ xem đề</Badge> */}
            <Badge tone="slate">{exam.code}</Badge>
          </div>
          <h1 className="mt-3 font-heading text-2xl font-bold text-foreground sm:text-3xl">
            {exam.courseName}
          </h1>
          {/* <p className="mt-2 flex items-start gap-2 text-sm leading-6 text-slate-600">
            <Info
              size={17}
              className="mt-0.5 shrink-0 text-primary"
              aria-hidden="true"
            />
            Đây là chế độ chỉ đọc: không tính thời gian, không dùng lượt thi và
            không hiển thị đáp án.
          </p> */}
        </div>
      </Card>

      <Card className="w-full flex flex-col overflow-hidden shadow-panel">
        <div className="flex flex-1 relative min-h-[30vh]">
          {/* Center Image */}
          <div className="flex-1 relative bg-white flex items-center justify-center p-6 sm:p-12">
            <img
              src={questionImageUrl(question.imageUrl)}
              alt={question.imageAlt}
              className="max-h-[75vh] w-full object-contain cursor-zoom-in transition-transform hover:scale-[1.01]"
              onClick={() => setImageExpanded(true)}
            />

            <button
              onClick={() => setImageExpanded(true)}
              className="absolute top-4 right-4 inline-flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors"
              aria-label="Phóng to ảnh"
            >
              <Maximize2 size={18} aria-hidden="true" />
            </button>

            {/* Navigation Arrows */}
            <button
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((index) => index - 1)}
              className="absolute left-4 top-1/2 -translate-y-1/2 inline-flex size-10 sm:size-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 shadow-sm transition-all hover:bg-primary hover:text-white hover:scale-110 disabled:hidden focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20"
              aria-label="Câu trước"
            >
              <ChevronLeft size={24} aria-hidden="true" />
            </button>

            <button
              disabled={currentIndex === exam.questions.length - 1}
              onClick={() => setCurrentIndex((index) => index + 1)}
              className="absolute right-4 top-1/2 -translate-y-1/2 inline-flex size-10 sm:size-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 shadow-sm transition-all hover:bg-primary hover:text-white hover:scale-110 disabled:hidden focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20"
              aria-label="Câu sau"
            >
              <ChevronRight size={24} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Bottom Pagination */}
        <div className="border-t border-border bg-slate-50 p-4">
          <div className="flex items-center justify-start gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-300">
            {exam.questions.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setCurrentIndex(index)}
                aria-current={index === currentIndex ? "step" : undefined}
                className={cn(
                  "shrink-0 grid min-h-10 min-w-10 cursor-pointer place-items-center rounded-lg border text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25",
                  index === currentIndex
                    ? "border-primary bg-primary text-white scale-110 shadow-sm"
                    : "border-border bg-white text-slate-500 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600",
                )}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {imageExpanded && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Ảnh phóng to câu ${currentIndex + 1}`}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/90 p-4 sm:p-8"
          onClick={() => setImageExpanded(false)}
        >
          <div className="absolute top-4 sm:top-6 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-6 py-2 text-sm sm:text-base font-bold tracking-widest text-white backdrop-blur-md">
            Câu {currentIndex + 1} / {exam.questions.length}
          </div>

          <button
            disabled={currentIndex === 0}
            onClick={(e) => {
              e.stopPropagation();
              setCurrentIndex((index) => index - 1);
            }}
            className="absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 inline-flex size-12 sm:size-16 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md transition-all hover:bg-black/80 hover:scale-110 disabled:hidden focus-visible:outline-none"
            aria-label="Câu trước"
          >
            <ChevronLeft size={36} aria-hidden="true" />
          </button>

          <button
            disabled={currentIndex === exam.questions.length - 1}
            onClick={(e) => {
              e.stopPropagation();
              setCurrentIndex((index) => index + 1);
            }}
            className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 inline-flex size-12 sm:size-16 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md transition-all hover:bg-black/80 hover:scale-110 disabled:hidden focus-visible:outline-none"
            aria-label="Câu sau"
          >
            <ChevronRight size={36} aria-hidden="true" />
          </button>

          <img
            src={questionImageUrl(question.imageUrl)}
            alt={question.imageAlt}
            className="max-h-[90dvh] max-w-[90vw] rounded-xl bg-white object-contain shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

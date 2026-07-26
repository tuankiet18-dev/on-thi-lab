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

export function ExamPreviewPage() {
  const { examId } = useParams({ from: "/exams/$examId/preview" });
  const { configured, session } = useAuth();
  const [exam, setExam] = useState<Exam | null>(configured ? null : demoExam);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(Boolean(session));
  const [error, setError] = useState("");
  const [imageExpanded, setImageExpanded] = useState(false);

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
            <Badge tone="blue">Chế độ xem đề</Badge>
            <Badge tone="slate">{exam.code}</Badge>
          </div>
          <h1 className="mt-3 font-heading text-2xl font-bold text-foreground sm:text-3xl">
            {exam.courseName}
          </h1>
          <p className="mt-2 flex items-start gap-2 text-sm leading-6 text-slate-600">
            <Info
              size={17}
              className="mt-0.5 shrink-0 text-primary"
              aria-hidden="true"
            />
            Đây là chế độ chỉ đọc: không tính thời gian, không dùng lượt thi và
            không hiển thị đáp án.
          </p>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
            <div>
              <p className="font-heading text-lg font-bold text-foreground">
                Câu {currentIndex + 1}
              </p>
              <p className="mt-0.5 text-sm text-slate-500">
                {question.type === "multiple"
                  ? "Chọn nhiều đáp án"
                  : "Chọn một đáp án"}{" "}
                · {question.options.length} lựa chọn
              </p>
            </div>
            <span className="rounded-lg bg-primary-soft px-3 py-1.5 text-sm font-bold text-primary">
              {currentIndex + 1}/{exam.questions.length}
            </span>
          </div>

          <div className="p-4 sm:p-6">
            <button
              type="button"
              onClick={() => setImageExpanded(true)}
              className="group relative block w-full overflow-hidden rounded-xl border border-border bg-slate-50 text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25"
              aria-label={`Phóng to ảnh câu ${currentIndex + 1}`}
            >
              <img
                src={question.imageUrl}
                alt={question.imageAlt}
                className="max-h-[680px] w-full object-contain"
              />
              <span className="absolute bottom-3 right-3 inline-flex min-h-10 items-center gap-2 rounded-lg bg-slate-900/80 px-3 text-sm font-semibold text-white opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                <Maximize2 size={16} aria-hidden="true" />
                Phóng to
              </span>
            </button>

            <div className="mt-5" aria-label="Các lựa chọn của câu hỏi">
              <p className="text-sm font-semibold text-slate-600">
                Lựa chọn trong đề
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                {question.options.map((option) => (
                  <span
                    key={option}
                    className={cn(
                      "grid size-12 place-items-center border-2 text-lg font-bold text-slate-600",
                      question.type === "single"
                        ? "rounded-full"
                        : "rounded-xl",
                    )}
                  >
                    {option}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-sm text-slate-500">
                Đáp án được mở khi bạn hoàn thành một lượt thi thử.
              </p>
            </div>

            <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-5">
              <Button
                variant="secondary"
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex((index) => index - 1)}
                icon={<ChevronLeft size={18} />}
              >
                Câu trước
              </Button>
              <Button
                disabled={currentIndex === exam.questions.length - 1}
                onClick={() => setCurrentIndex((index) => index + 1)}
                icon={<ChevronRight size={18} />}
              >
                Câu sau
              </Button>
            </div>
          </div>
        </Card>

        <aside className="space-y-4">
          <Card className="p-5 lg:sticky lg:top-24">
            <div className="flex items-center gap-2">
              <Eye className="text-primary" size={19} aria-hidden="true" />
              <h2 className="font-heading font-bold text-foreground">
                Danh sách câu
              </h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Chọn số để chuyển nhanh.
            </p>
            <div className="mt-4 grid grid-cols-5 gap-2">
              {exam.questions.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCurrentIndex(index)}
                  aria-current={index === currentIndex ? "step" : undefined}
                  className={cn(
                    "grid min-h-11 cursor-pointer place-items-center rounded-xl border text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25",
                    index === currentIndex
                      ? "border-primary bg-primary text-white"
                      : "border-border bg-white text-slate-600 hover:border-blue-300 hover:bg-primary-soft",
                  )}
                >
                  {index + 1}
                </button>
              ))}
            </div>
          </Card>
        </aside>
      </div>

      {imageExpanded && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Ảnh phóng to câu ${currentIndex + 1}`}
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 p-4"
          onClick={() => setImageExpanded(false)}
        >
          <img
            src={question.imageUrl}
            alt={question.imageAlt}
            className="max-h-[90dvh] max-w-full rounded-xl bg-white object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

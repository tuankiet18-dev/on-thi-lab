import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock3,
  Flag,
  RotateCcw,
  Target,
  X,
} from "lucide-react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { demoAnswerKey, demoExam } from "../data/demo";
import {
  loadAttempt,
  resetDemoAttempt,
  type LocalAttempt,
} from "../lib/attempt-storage";

export function ResultPage() {
  const { attemptId } = useParams({ from: "/results/$attemptId" });
  const navigate = useNavigate();
  const [attempt] = useState<LocalAttempt | null>(() => loadAttempt(attemptId));
  const [reportedQuestion, setReportedQuestion] = useState<string | null>(null);

  if (!attempt?.result) {
    return (
      <Card className="mx-auto max-w-lg p-8 text-center">
        <h1 className="font-heading text-2xl font-bold">Chưa có kết quả</h1>
        <p className="mt-2 text-slate-600">
          Bài thi này chưa được nộp hoặc dữ liệu đã bị xóa.
        </p>
        <Link
          to="/exams/$examId"
          params={{ examId: demoExam.id }}
          className="mt-6 inline-flex min-h-11 cursor-pointer items-center rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white"
        >
          Quay lại đề thi
        </Link>
      </Card>
    );
  }

  const result = attempt.result;
  const circumference = 2 * Math.PI * 54;
  const dashOffset = circumference * (1 - result.score / 10);

  function retry() {
    resetDemoAttempt();
    void navigate({
      to: "/exams/$examId",
      params: { examId: demoExam.id },
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        to="/"
        className="inline-flex cursor-pointer items-center gap-2 rounded-lg text-sm font-semibold text-slate-600 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20"
      >
        <ArrowLeft size={17} aria-hidden="true" />
        Về tổng quan
      </Link>

      <Card className="overflow-hidden">
        <div className="grid gap-8 bg-linear-to-br from-[#173b8f] to-primary p-7 text-white sm:p-10 lg:grid-cols-[1fr_220px] lg:items-center">
          <div>
            <Badge tone="amber">
              {result.status === "auto_submitted"
                ? "Đã tự động nộp"
                : "Đã hoàn thành"}
            </Badge>
            <h1 className="mt-5 font-heading text-3xl font-bold">
              Kết quả thi thử {demoExam.courseCode}
            </h1>
            <p className="mt-2 text-blue-100">
              {demoExam.code} · Điểm số tham khảo
            </p>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm text-blue-100">
              <span className="flex items-center gap-2">
                <CheckCircle2 size={17} aria-hidden="true" />
                {result.correctCount}/{result.questionCount} câu đúng
              </span>
              <span className="flex items-center gap-2">
                <Clock3 size={17} aria-hidden="true" />
                Nộp lúc{" "}
                {new Intl.DateTimeFormat("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(result.submittedAt))}
              </span>
            </div>
          </div>
          <div className="relative mx-auto grid size-40 place-items-center">
            <svg
              className="-rotate-90"
              width="144"
              height="144"
              aria-hidden="true"
            >
              <circle
                cx="72"
                cy="72"
                r="54"
                fill="none"
                stroke="rgba(255,255,255,.2)"
                strokeWidth="12"
              />
              <circle
                cx="72"
                cy="72"
                r="54"
                fill="none"
                stroke="white"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
              />
            </svg>
            <div className="absolute text-center">
              <span className="font-heading text-4xl font-bold">
                {result.score}
              </span>
              <span className="block text-xs text-blue-100">trên 10</span>
            </div>
          </div>
        </div>
        <div className="grid gap-px bg-border sm:grid-cols-3">
          {[
            [
              "Chính xác",
              `${Math.round((result.correctCount / result.questionCount) * 100)}%`,
            ],
            ["Câu đúng", String(result.correctCount)],
            ["Cần xem lại", String(result.questionCount - result.correctCount)],
          ].map(([label, value]) => (
            <div key={label} className="bg-white p-5 text-center">
              <p className="font-heading text-2xl font-bold text-foreground">
                {value}
              </p>
              <p className="mt-1 text-sm text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button onClick={retry} icon={<RotateCcw size={17} />}>
          Làm lại đề này
        </Button>
        <Button variant="secondary" icon={<Target size={17} />}>
          Xem thống kê môn
        </Button>
      </div>

      <section>
        <div className="mb-4">
          <p className="section-kicker">Đối chiếu đáp án</p>
          <h2 className="section-title">Xem lại bài làm</h2>
          <p className="mt-2 text-sm text-slate-500">
            Việc xử lý report không thay đổi điểm của lần thi đã hoàn thành.
          </p>
        </div>
        <div className="space-y-3">
          {demoExam.questions.map((question, index) => {
            const selected = attempt.answers[question.id] ?? [];
            const correct = demoAnswerKey[question.id] ?? [];
            const isCorrect =
              selected.length === correct.length &&
              [...selected]
                .sort((a, b) => a - b)
                .every(
                  (value, optionIndex) =>
                    value === [...correct].sort()[optionIndex],
                );

            return (
              <Card key={question.id} className="p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <span
                    className={`grid size-10 shrink-0 place-items-center rounded-xl ${
                      isCorrect
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-red-50 text-red-700"
                    }`}
                  >
                    {isCorrect ? (
                      <Check size={20} aria-hidden="true" />
                    ) : (
                      <X size={20} aria-hidden="true" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-heading font-bold text-foreground">
                      Câu {index + 1} ·{" "}
                      {question.type === "multiple"
                        ? "Nhiều đáp án"
                        : "Một đáp án"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                      <span className="text-slate-600">
                        Bạn chọn:{" "}
                        <strong
                          className={
                            isCorrect ? "text-emerald-700" : "text-red-700"
                          }
                        >
                          {selected.length
                            ? selected
                                .map((value) => question.options[value])
                                .join(", ")
                            : "Chưa trả lời"}
                        </strong>
                      </span>
                      <span className="text-slate-600">
                        Đáp án:{" "}
                        <strong className="text-emerald-700">
                          {correct
                            .map((value) => question.options[value])
                            .join(", ")}
                        </strong>
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReportedQuestion(question.id)}
                    className="inline-flex min-h-10 cursor-pointer items-center gap-2 self-start rounded-xl px-3 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20 sm:self-auto"
                  >
                    <Flag size={16} aria-hidden="true" />
                    Báo lỗi
                  </button>
                </div>
                {reportedQuestion === question.id && (
                  <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                    Cảm ơn bạn. Form report chi tiết sẽ được nối với API ở
                    sprint tiếp theo; điểm hiện tại của bạn vẫn được giữ nguyên.
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}

import {
  AlertCircle,
  ArrowLeft,
  BookOpenCheck,
  CheckCircle2,
  Clock3,
  Info,
  MapPin,
  Play,
  Repeat2,
  Shuffle,
} from "lucide-react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { catalogExams, demoExam } from "../data/demo";
import { createOrResumeAttempt } from "../lib/attempt-storage";

export function ExamDetailPage() {
  const { examId } = useParams({ from: "/exams/$examId" });
  const navigate = useNavigate();
  const exam =
    catalogExams.find((candidate) => candidate.id === examId) ?? demoExam;
  const isDemoReady = exam.id === demoExam.id;

  function startExam() {
    const attempt = createOrResumeAttempt();
    void navigate({
      to: "/attempts/$attemptId",
      params: { attemptId: attempt.id },
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        to="/exams"
        className="inline-flex cursor-pointer items-center gap-2 rounded-lg text-sm font-semibold text-slate-600 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20"
      >
        <ArrowLeft size={17} aria-hidden="true" />
        Quay lại kho đề
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="border-b border-border bg-linear-to-r from-primary-soft to-white p-6 sm:p-8">
              <div className="flex flex-wrap gap-2">
                <Badge tone="blue">{exam.examType}</Badge>
                <Badge tone="slate">{exam.semester}</Badge>
                {exam.isRetake && <Badge tone="pink">Retake</Badge>}
              </div>
              <p className="mt-5 text-sm font-bold uppercase tracking-wider text-primary">
                {exam.code}
              </p>
              <h1 className="mt-2 font-heading text-3xl font-bold leading-tight text-foreground">
                {exam.courseName}
              </h1>
              <p className="mt-2 text-slate-600">
                Mã môn {exam.courseCode} · Đề thi cuối kỳ
              </p>
            </div>
            <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
              {[
                [BookOpenCheck, `${exam.questionCount} câu`, "Số câu hỏi"],
                [Clock3, `${exam.durationMinutes} phút`, "Thời gian"],
                [MapPin, exam.campus, "Campus"],
                [Shuffle, "Có", "Trộn câu hỏi"],
              ].map(([Icon, value, label]) => {
                const MetricIcon = Icon as typeof BookOpenCheck;
                return (
                  <div key={String(label)} className="bg-white p-5">
                    <MetricIcon
                      size={19}
                      className="text-primary"
                      aria-hidden="true"
                    />
                    <p className="mt-3 font-heading font-bold text-foreground">
                      {String(value)}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {String(label)}
                    </p>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="p-6 sm:p-8">
            <h2 className="font-heading text-xl font-bold text-foreground">
              Quy định làm bài
            </h2>
            <ul className="mt-5 space-y-4">
              {exam.instructions.map((instruction) => (
                <li key={instruction} className="flex gap-3 text-slate-600">
                  <CheckCircle2
                    size={19}
                    className="mt-0.5 shrink-0 text-emerald-600"
                    aria-hidden="true"
                  />
                  <span>{instruction}</span>
                </li>
              ))}
              <li className="flex gap-3 text-slate-600">
                <Repeat2
                  size={19}
                  className="mt-0.5 shrink-0 text-emerald-600"
                  aria-hidden="true"
                />
                <span>Bạn có thể làm lại cùng đề sau khi hoàn thành.</span>
              </li>
            </ul>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card className="sticky top-24 p-6">
            <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-4 text-amber-900">
              <Info size={19} className="mt-0.5 shrink-0" aria-hidden="true" />
              <p className="text-sm leading-6">
                Đáp án do AI đề xuất và đã được quản trị viên rà soát. Điểm số
                chỉ mang tính tham khảo.
              </p>
            </div>
            <div className="mt-5 flex items-center justify-between text-sm">
              <span className="text-slate-500">Lượt miễn phí hôm nay</span>
              <strong className="text-foreground">2 lượt còn lại</strong>
            </div>
            <Button
              onClick={startExam}
              disabled={!isDemoReady}
              className="mt-5 w-full"
              icon={<Play size={18} fill="currentColor" />}
            >
              {isDemoReady ? "Bắt đầu làm bài" : "Đề demo chưa khả dụng"}
            </Button>
            <p className="mt-3 text-center text-xs leading-5 text-slate-500">
              Timer bắt đầu ngay sau khi bạn nhấn nút.
            </p>
            {!isDemoReady && (
              <div className="mt-4 flex gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                <AlertCircle size={17} className="mt-0.5 shrink-0" />
                Chỉ đề SWD392 được nối với luồng thi ở bản demo.
              </div>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}

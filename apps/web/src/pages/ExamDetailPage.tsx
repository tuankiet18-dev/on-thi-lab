import {
  ArrowLeft,
  Bookmark,
  BookOpenCheck,
  CheckCircle2,
  Clock3,
  Eye,
  Info,
  MapPin,
  Play,
  Repeat2,
  Shuffle,
} from "lucide-react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { Exam } from "@onthilab/contracts";
import { useAuth } from "../auth/AuthContext";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { demoExam } from "../data/demo";
import {
  ApiError,
  createAttempt,
  getBookmarks,
  getPublishedExam,
  setExamBookmark,
} from "../lib/api";
import { createOrResumeAttempt } from "../lib/attempt-storage";
import { getOrCreateDeviceId } from "../lib/device";

export function ExamDetailPage() {
  const { examId } = useParams({ from: "/exams/$examId" });
  const navigate = useNavigate();
  const { configured, session } = useAuth();
  const [exam, setExam] = useState<Exam | null>(configured ? null : demoExam);
  const [loading, setLoading] = useState(Boolean(session));
  const [loadError, setLoadError] = useState("");
  const [startError, setStartError] = useState("");
  const [starting, setStarting] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const [bookmarkError, setBookmarkError] = useState("");

  useEffect(() => {
    if (!session) return;
    let active = true;
    setLoading(true);
    void Promise.all([
      getPublishedExam(session.idToken, examId),
      getBookmarks(session.idToken),
    ])
      .then(([result, bookmarks]) => {
        if (active) setExam(result);
        if (active) {
          setBookmarked(
            bookmarks.exams.some((saved) => saved.id === result.id),
          );
        }
      })
      .catch(() => {
        if (active) setLoadError("Không tìm thấy đề đã xuất bản.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [examId, session]);

  async function toggleBookmark() {
    if (!session || !exam || bookmarkLoading) return;
    const next = !bookmarked;
    setBookmarkLoading(true);
    setBookmarkError("");
    try {
      setBookmarked(await setExamBookmark(session.idToken, exam.id, next));
    } catch {
      setBookmarkError("Chưa thể cập nhật đề đã lưu. Vui lòng thử lại.");
    } finally {
      setBookmarkLoading(false);
    }
  }

  async function startExam() {
    if (!configured) {
      const localAttempt = createOrResumeAttempt();
      await navigate({
        to: "/attempts/$attemptId",
        params: { attemptId: localAttempt.id },
      });
      return;
    }
    if (!session || !exam) return;
    setStarting(true);
    setStartError("");
    try {
      const launch = await createAttempt(
        session.idToken,
        exam.id,
        getOrCreateDeviceId(),
      );
      await navigate({
        to: "/attempts/$attemptId",
        params: { attemptId: launch.attempt.id },
      });
    } catch (reason) {
      setStartError(
        reason instanceof ApiError && reason.code === "DAILY_LIMIT_REACHED"
          ? "Bạn đã dùng hết 2 lượt thi miễn phí hôm nay."
          : "Chưa thể bắt đầu bài thi. Vui lòng thử lại.",
      );
    } finally {
      setStarting(false);
    }
  }

  if (loading) {
    return (
      <Card className="mx-auto min-h-72 max-w-5xl animate-pulse bg-slate-100" />
    );
  }

  if (!exam || loadError) {
    return (
      <Card className="mx-auto max-w-lg p-8 text-center">
        <h1 className="font-heading text-2xl font-bold">Chưa thể mở đề</h1>
        <p className="mt-2 text-slate-600">
          {loadError || "Đề thi không tồn tại."}
        </p>
        <Link
          to="/exams"
          className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-primary px-4 font-bold text-white"
        >
          Quay lại kho đề
        </Link>
      </Card>
    );
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
              <strong className="text-foreground">Tối đa 2 lượt/ngày</strong>
            </div>
            <div className="mt-5 grid gap-3">
              <Button
                onClick={() => void startExam()}
                disabled={starting}
                className="w-full"
                icon={<Play size={18} fill="currentColor" />}
              >
                {starting ? "Đang tạo lượt thi..." : "Bắt đầu làm bài"}
              </Button>
              <Link
                to="/exams/$examId/preview"
                params={{ examId: exam.id }}
                className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border-strong bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-primary/40 hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25"
              >
                <Eye size={17} aria-hidden="true" />
                Xem đề không tính lượt
              </Link>
              {configured && (
                <Button
                  variant="secondary"
                  onClick={() => void toggleBookmark()}
                  disabled={bookmarkLoading}
                  className="w-full"
                  icon={
                    <Bookmark
                      size={17}
                      fill={bookmarked ? "currentColor" : "none"}
                    />
                  }
                >
                  {bookmarkLoading
                    ? "Đang cập nhật..."
                    : bookmarked
                      ? "Đã lưu đề"
                      : "Lưu đề để ôn lại"}
                </Button>
              )}
            </div>
            <p className="mt-3 text-center text-xs leading-5 text-slate-500">
              Timer bắt đầu ngay sau khi bạn nhấn nút.
            </p>
            {startError && (
              <p
                className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700"
                role="alert"
              >
                {startError}
              </p>
            )}
            {bookmarkError && (
              <p
                className="mt-3 text-center text-xs font-semibold text-red-700"
                role="alert"
              >
                {bookmarkError}
              </p>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}

import {
  Bookmark,
  BookOpenCheck,
  Clock3,
  LoaderCircle,
  MapPin,
  Trash2,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { BookmarkCollection } from "@onthilab/contracts";
import { useAuth } from "../auth/AuthContext";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { getBookmarks, setExamBookmark, setQuestionBookmark } from "../lib/api";
import { questionImageUrl } from "../lib/question-image-url";

const emptyBookmarks: BookmarkCollection = { exams: [], questions: [] };

export function BookmarksPage() {
  const { configured, session } = useAuth();
  const [bookmarks, setBookmarks] =
    useState<BookmarkCollection>(emptyBookmarks);
  const [loading, setLoading] = useState(Boolean(session));
  const [error, setError] = useState("");
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!configured || !session) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    void getBookmarks(session.idToken)
      .then((result) => {
        if (active) setBookmarks(result);
      })
      .catch(() => {
        if (active)
          setError("Chưa thể tải danh sách đã lưu. Vui lòng thử lại.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [configured, session]);

  async function removeExam(examId: string) {
    if (!session) return;
    setPendingKey(`exam:${examId}`);
    try {
      await setExamBookmark(session.idToken, examId, false);
      setBookmarks((current) => ({
        ...current,
        exams: current.exams.filter((exam) => exam.id !== examId),
      }));
    } catch {
      setError("Chưa thể bỏ lưu đề. Vui lòng thử lại.");
    } finally {
      setPendingKey(null);
    }
  }

  async function removeQuestion(questionId: string) {
    if (!session) return;
    setPendingKey(`question:${questionId}`);
    try {
      await setQuestionBookmark(session.idToken, questionId, false);
      setBookmarks((current) => ({
        ...current,
        questions: current.questions.filter(
          (question) => question.questionId !== questionId,
        ),
      }));
    } catch {
      setError("Chưa thể bỏ lưu câu hỏi. Vui lòng thử lại.");
    } finally {
      setPendingKey(null);
    }
  }

  if (loading) {
    return (
      <Card className="mx-auto min-h-72 max-w-5xl animate-pulse bg-slate-100" />
    );
  }

  if (error && !bookmarks.exams.length && !bookmarks.questions.length) {
    return (
      <Card className="mx-auto max-w-lg p-8 text-center">
        <h1 className="font-heading text-2xl font-bold text-foreground">
          Chưa thể tải mục đã lưu
        </h1>
        <p className="mt-2 text-slate-600">{error}</p>
        <Button className="mt-6" onClick={() => window.location.reload()}>
          Thử lại
        </Button>
      </Card>
    );
  }

  const isEmpty = !bookmarks.exams.length && !bookmarks.questions.length;
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <section className="rounded-3xl bg-linear-to-br from-[#173b8f] to-primary p-7 text-white sm:p-9">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="section-kicker !text-blue-100">Ôn tập của tôi</p>
            <h1 className="mt-2 font-heading text-3xl font-bold">
              Đề và câu hỏi đã lưu
            </h1>
            <p className="mt-3 max-w-2xl leading-7 text-blue-100">
              Gom những nội dung cần ôn lại ở một nơi. Đáp án chỉ hiển thị sau
              khi bạn đã hoàn thành bài thi.
            </p>
          </div>
          <Badge tone="amber">
            {bookmarks.exams.length + bookmarks.questions.length} mục đã lưu
          </Badge>
        </div>
      </section>

      {error && (
        <p
          className="rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700"
          role="alert"
        >
          {error}
        </p>
      )}

      {isEmpty ? (
        <Card className="p-8 text-center sm:p-12">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary">
            <Bookmark size={26} aria-hidden="true" />
          </div>
          <h2 className="mt-5 font-heading text-2xl font-bold text-foreground">
            Chưa có nội dung nào được lưu
          </h2>
          <p className="mx-auto mt-2 max-w-md leading-7 text-slate-600">
            Lưu một đề trước khi ôn, hoặc lưu câu cần xem lại ở trang kết quả
            bài thi.
          </p>
          <Link
            to="/exams"
            className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 text-sm font-bold text-white transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25"
          >
            Mở kho đề thi
          </Link>
        </Card>
      ) : (
        <>
          {bookmarks.exams.length > 0 && (
            <section>
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <p className="section-kicker">Đề thi</p>
                  <h2 className="section-title">Đề đã lưu</h2>
                </div>
                <span className="text-sm font-semibold text-slate-500">
                  {bookmarks.exams.length} đề
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {bookmarks.exams.map((exam) => (
                  <Card key={exam.id} className="flex flex-col p-5">
                    <div className="flex items-start justify-between gap-3">
                      <Badge tone="blue">{exam.examType}</Badge>
                      <button
                        type="button"
                        onClick={() => void removeExam(exam.id)}
                        disabled={pendingKey === `exam:${exam.id}`}
                        className="grid size-11 cursor-pointer place-items-center rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25 disabled:opacity-50"
                        aria-label={`Bỏ lưu ${exam.code}`}
                      >
                        <Trash2 size={17} aria-hidden="true" />
                      </button>
                    </div>
                    <p className="mt-4 text-sm font-bold text-primary">
                      {exam.code}
                    </p>
                    <h3 className="mt-1 font-heading text-lg font-bold text-foreground">
                      {exam.courseName}
                    </h3>
                    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-600">
                      <span className="inline-flex items-center gap-1.5">
                        <BookOpenCheck size={15} aria-hidden="true" />
                        {exam.questionCount} câu
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock3 size={15} aria-hidden="true" />
                        {exam.durationMinutes} phút
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin size={15} aria-hidden="true" />
                        {exam.campus}
                      </span>
                    </div>
                    <Link
                      to="/exams/$examId"
                      params={{ examId: exam.id }}
                      className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl border border-border-strong bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:border-primary/40 hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25"
                    >
                      Mở đề
                    </Link>
                  </Card>
                ))}
              </div>
            </section>
          )}
          {bookmarks.questions.length > 0 && (
            <section>
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <p className="section-kicker">Cần xem lại</p>
                  <h2 className="section-title">Câu hỏi đã lưu</h2>
                </div>
                <span className="text-sm font-semibold text-slate-500">
                  {bookmarks.questions.length} câu
                </span>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {bookmarks.questions.map((question) => (
                  <Card
                    key={question.questionId}
                    className="overflow-hidden p-0"
                  >
                    <div className="grid sm:grid-cols-[180px_1fr]">
                      <img
                        src={questionImageUrl(question.imageUrl)}
                        alt={question.imageAlt}
                        loading="lazy"
                        className="h-44 w-full border-b border-border object-contain bg-slate-50 p-2 sm:h-full sm:border-b-0 sm:border-r"
                      />
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-primary">
                              {question.courseCode} · Câu {question.order}
                            </p>
                            <h3 className="mt-1 font-heading font-bold text-foreground">
                              {question.examCode}
                            </h3>
                            <p className="mt-1 text-sm text-slate-500">
                              {question.semester} · {question.campus}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              void removeQuestion(question.questionId)
                            }
                            disabled={
                              pendingKey === `question:${question.questionId}`
                            }
                            className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25 disabled:opacity-50"
                            aria-label={`Bỏ lưu câu ${question.order}`}
                          >
                            <Trash2 size={17} aria-hidden="true" />
                          </button>
                        </div>
                        <Link
                          to="/exams/$examId/preview"
                          params={{ examId: question.examId }}
                          className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-border-strong bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:border-primary/40 hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25"
                        >
                          Xem đề để ôn lại
                        </Link>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </>
      )}
      {pendingKey && (
        <p className="sr-only" aria-live="polite">
          Đang cập nhật mục đã lưu
        </p>
      )}
    </div>
  );
}

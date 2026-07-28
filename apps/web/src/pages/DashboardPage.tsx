import type { ExamSummary, StudentStatistics } from "@onthilab/contracts";
import {
  ArrowRight,
  Award,
  Bookmark,
  BookOpenCheck,
  CheckCircle2,
  CirclePlay,
  Clock3,
  FileText,
  GraduationCap,
  LoaderCircle,
  MapPin,
  Search,
  TrendingUp,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { catalogExams } from "../data/demo";
import { getBookmarks, getCatalog, getStudentStatistics } from "../lib/api";
import { popularCourseCodes, searchCourses } from "../lib/catalog-search";

const emptyStatistics: StudentStatistics = {
  totalAttempts: 0,
  averageScore: null,
  highestScore: null,
  recentAttempts: [],
};

export function DashboardPage() {
  const { configured, session, studentProfile } = useAuth();
  const [statistics, setStatistics] = useState(emptyStatistics);
  const [exams, setExams] = useState<ExamSummary[]>(
    configured ? [] : catalogExams,
  );
  const [loading, setLoading] = useState(Boolean(session));
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [savedCount, setSavedCount] = useState(0);

  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setLoadError("");
    void Promise.all([
      getStudentStatistics(session.idToken),
      getCatalog(session.idToken),
    ])
      .then(([nextStatistics, nextExams]) => {
        if (!active) return;
        setStatistics(nextStatistics);
        setExams(nextExams);
      })
      .catch(() => {
        if (active) {
          setLoadError(
            "Không thể tải một phần dữ liệu cá nhân. Vui lòng thử lại.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    void getBookmarks(session.idToken)
      .then((bookmarks) => {
        if (active)
          setSavedCount(bookmarks.exams.length + bookmarks.questions.length);
      })
      .catch(() => {
        // Saved items are a shortcut, so a transient failure must not block
        // the student's dashboard or exam search.
      });

    return () => {
      active = false;
    };
  }, [session]);

  const firstName =
    studentProfile?.fullName.trim().split(/\s+/).at(-1) ??
    session?.user.name.trim().split(/\s+/).at(-1) ??
    "bạn";
  const featuredExams = useMemo(
    () =>
      [...exams]
        .sort((left, right) => {
          const leftCampus =
            left.campus === studentProfile?.campus.name ? 0 : 1;
          const rightCampus =
            right.campus === studentProfile?.campus.name ? 0 : 1;
          if (leftCampus !== rightCampus) return leftCampus - rightCampus;
          return (
            new Date(right.publishedAt).getTime() -
            new Date(left.publishedAt).getTime()
          );
        })
        .slice(0, 3),
    [exams, studentProfile?.campus.name],
  );
  const recommendedExam = featuredExams[0];
  const matchingCourses = useMemo(
    () => searchCourses(exams, query, studentProfile?.campus.name).slice(0, 4),
    [exams, query, studentProfile?.campus.name],
  );
  const quickCourseCodes = useMemo(() => popularCourseCodes(exams), [exams]);
  const trimmedQuery = query.trim();
  const statCards = [
    {
      label: "Bài đã hoàn thành",
      value: String(statistics.totalAttempts),
      note: "Tất cả bài đã nộp",
      icon: CheckCircle2,
      tone: "text-emerald-600 bg-emerald-50",
    },
    {
      label: "Điểm trung bình",
      value:
        statistics.averageScore === null
          ? "--"
          : statistics.averageScore.toFixed(2),
      note: "Trên thang điểm 10",
      icon: TrendingUp,
      tone: "text-blue-600 bg-blue-50",
    },
    {
      label: "Điểm cao nhất",
      value:
        statistics.highestScore === null
          ? "--"
          : statistics.highestScore.toFixed(2),
      note: "Kết quả tốt nhất của bạn",
      icon: Award,
      tone: "text-amber-600 bg-amber-50",
    },
    {
      label: "Đã lưu để ôn lại",
      value: String(savedCount),
      note: "Đề và câu hỏi cần xem lại",
      icon: Bookmark,
      tone: "text-violet-600 bg-violet-50",
      to: "/bookmarks",
    },
  ];

  return (
    <div className="space-y-8">
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]">
        <div className="relative isolate overflow-hidden rounded-3xl bg-slate-950 p-6 text-white shadow-panel sm:p-8 lg:p-10">
          <span
            className="absolute -right-20 -top-24 size-80 rounded-full bg-primary/70 blur-3xl"
            aria-hidden="true"
          />
          <span
            className="absolute -bottom-28 left-1/3 size-72 rounded-full bg-cyan-400/20 blur-3xl"
            aria-hidden="true"
          />
          <div className="relative z-10 max-w-2xl">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone="amber">Bắt đầu ở đây</Badge>
              <span className="text-sm font-semibold text-blue-100">
                Chào {firstName}, chọn môn bạn đang ôn
              </span>
            </div>
            <h1 className="mt-5 max-w-xl font-heading text-4xl font-bold leading-[1.12] tracking-tight sm:text-5xl">
              Ôn đúng môn.
              <span className="block text-blue-200">Vào đề ngay.</span>
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-200 sm:text-lg">
              Gõ mã môn như SWD, PRF192 hoặc tên môn. OnThiLab sẽ đưa đề mới
              nhất, ưu tiên campus của bạn, lên trước.
            </p>

            <div className="mt-7 rounded-2xl border border-white/15 bg-white/10 p-3 shadow-xl backdrop-blur-sm sm:p-4">
              <label className="relative block">
                <span className="sr-only">Tìm mã hoặc tên môn học</span>
                <Search
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-primary"
                  size={21}
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Ví dụ: SWD, PRF192, Java Web..."
                  className="min-h-14 w-full rounded-xl border border-white bg-white py-3 pl-12 pr-4 text-base font-semibold text-foreground shadow-sm outline-none transition placeholder:font-normal placeholder:text-slate-500 focus:border-blue-200 focus:ring-3 focus:ring-white/35"
                  aria-describedby="course-search-hint"
                />
              </label>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <p
                  id="course-search-hint"
                  className="mr-1 text-sm text-blue-100"
                >
                  Môn phổ biến:
                </p>
                {quickCourseCodes.length > 0 ? (
                  quickCourseCodes.map((courseCode) => (
                    <button
                      key={courseCode}
                      type="button"
                      onClick={() => setQuery(courseCode)}
                      className="min-h-10 cursor-pointer rounded-lg border border-white/20 bg-slate-950/20 px-3 text-sm font-bold text-white transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-white/40"
                    >
                      {courseCode}
                    </button>
                  ))
                ) : (
                  <span className="text-sm text-blue-100">
                    Đề mới sẽ xuất hiện sau khi được xuất bản.
                  </span>
                )}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2 text-sm text-blue-100">
              <span className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3">
                <MapPin size={16} aria-hidden="true" />
                {studentProfile?.campus.name ?? "Campus đang cập nhật"}
              </span>
              <span className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3">
                <GraduationCap size={16} aria-hidden="true" />
                {studentProfile?.major.name ?? "Ngành đang cập nhật"}
              </span>
            </div>
          </div>
        </div>

        <Card className="relative overflow-hidden border-blue-100 p-5 sm:p-6">
          <span
            className="absolute right-0 top-0 size-36 -translate-y-1/2 translate-x-1/2 rounded-full bg-primary-soft"
            aria-hidden="true"
          />
          <div className="relative flex h-full flex-col">
            <div className="flex items-center justify-between gap-3">
              <Badge tone="blue">Đề nên làm ngay</Badge>
              <CirclePlay
                className="text-primary"
                size={24}
                aria-hidden="true"
              />
            </div>
            {recommendedExam ? (
              <>
                <p className="mt-6 text-xs font-bold uppercase tracking-wider text-primary">
                  {recommendedExam.courseCode} · {recommendedExam.semester}
                </p>
                <h2 className="mt-2 font-heading text-2xl font-bold leading-tight text-foreground">
                  {recommendedExam.courseName}
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {recommendedExam.campus} · đề {recommendedExam.examType}
                  {recommendedExam.isRetake ? " · thi lại" : ""}
                </p>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <span className="rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-700">
                    <FileText
                      className="mb-2 text-primary"
                      size={18}
                      aria-hidden="true"
                    />
                    {recommendedExam.questionCount} câu
                  </span>
                  <span className="rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-700">
                    <Clock3
                      className="mb-2 text-primary"
                      size={18}
                      aria-hidden="true"
                    />
                    {recommendedExam.durationMinutes} phút
                  </span>
                </div>
                <Link
                  to="/exams/$examId"
                  params={{ examId: recommendedExam.id }}
                  className="mt-6 inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25"
                >
                  Mở đề và bắt đầu
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
                <Link
                  to="/exams"
                  className="mt-3 inline-flex min-h-10 items-center justify-center text-sm font-bold text-primary transition-colors hover:text-primary-strong focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20"
                >
                  Hoặc tìm môn khác
                </Link>
              </>
            ) : (
              <div className="my-auto py-8 text-center">
                <BookOpenCheck
                  className="mx-auto text-primary"
                  size={38}
                  aria-hidden="true"
                />
                <h2 className="mt-4 font-heading text-xl font-bold text-foreground">
                  Đề đang được bổ sung
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Bạn có thể mở kho đề để xem các môn đã được phát hành.
                </p>
                <Link
                  to="/exams"
                  className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white"
                >
                  Mở kho đề
                  <ArrowRight size={17} aria-hidden="true" />
                </Link>
              </div>
            )}
          </div>
        </Card>
      </section>

      {trimmedQuery && (
        <section aria-live="polite">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="section-kicker">Kết quả tìm môn</p>
              <h2 className="section-title">
                {matchingCourses.length > 0
                  ? `Đề thi cho “${trimmedQuery}”`
                  : `Chưa có đề cho “${trimmedQuery}”`}
              </h2>
            </div>
            {matchingCourses.length > 0 && (
              <Link
                to="/exams"
                search={{ q: trimmedQuery }}
                className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg text-sm font-semibold text-primary transition-colors hover:text-primary-strong focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20"
              >
                Xem tất cả kết quả
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            )}
          </div>

          {matchingCourses.length === 0 ? (
            <Card className="p-5 sm:p-6">
              <p className="font-heading text-lg font-bold text-foreground">
                Chưa tìm thấy môn phù hợp
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Hãy thử mã môn ngắn như SWD hoặc PRF, hoặc tìm bằng một phần tên
                môn. Bạn cũng có thể mở toàn bộ kho đề để lọc thêm.
              </p>
              <Link
                to="/exams"
                className="mt-4 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25"
              >
                Mở kho đề thi
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </Card>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {matchingCourses.map((course) => {
                const newestExam = course.exams[0]!;
                return (
                  <Card key={course.courseCode} className="p-5 sm:p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-wider text-primary">
                          {course.courseCode}
                        </p>
                        <h3 className="mt-1 font-heading text-xl font-bold text-foreground">
                          {course.courseName}
                        </h3>
                        <p className="mt-2 text-sm text-slate-600">
                          {course.exams.length} đề đã phát hành · Ưu tiên campus{" "}
                          {studentProfile?.campus.name ?? "của bạn"}
                        </p>
                      </div>
                      <Badge tone="blue">Đề mới nhất</Badge>
                    </div>
                    <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-primary-soft p-4 text-sm text-slate-700">
                      <span className="font-bold text-primary">
                        {newestExam.semester}
                      </span>
                      <span>{newestExam.campus}</span>
                      <span>{newestExam.questionCount} câu</span>
                      <span>{newestExam.durationMinutes} phút</span>
                      {newestExam.isRetake && <Badge tone="pink">Retake</Badge>}
                    </div>
                    <div className="mt-5 flex flex-wrap gap-3">
                      <Link
                        to="/exams/$examId"
                        params={{ examId: newestExam.id }}
                        className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25"
                      >
                        Xem đề mới nhất
                        <ArrowRight size={17} aria-hidden="true" />
                      </Link>
                      <Link
                        to="/exams"
                        search={{ q: course.courseCode }}
                        className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border-strong bg-white px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20"
                      >
                        Xem {course.exams.length} đề
                      </Link>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      )}

      {loadError && (
        <p
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900"
          role="status"
        >
          {loadError}
        </p>
      )}

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="section-kicker">Tiến độ của bạn</p>
            <h2 className="section-title">Mỗi lần luyện là một bước tiến</h2>
          </div>
          {loading && (
            <LoaderCircle
              className="animate-spin text-primary"
              aria-label="Đang tải tiến độ"
            />
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.map((stat) => (
            <Card key={stat.label} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-500">
                    {stat.label}
                  </p>
                  <p className="mt-2 font-heading text-3xl font-bold text-foreground">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">{stat.note}</p>
                  {"to" in stat && (
                    <Link
                      to={stat.to}
                      className="mt-3 inline-flex min-h-10 items-center text-sm font-bold text-primary hover:text-primary-strong focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20"
                    >
                      Mở mục đã lưu
                    </Link>
                  )}
                </div>
                <span
                  className={`grid size-11 place-items-center rounded-xl ${stat.tone}`}
                >
                  <stat.icon size={21} aria-hidden="true" />
                </span>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="section-kicker">Kho đề</p>
            <h2 className="section-title">Chọn đề để bắt đầu</h2>
          </div>
          <Link
            to="/exams"
            className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg text-sm font-semibold text-primary transition-colors hover:text-primary-strong focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20"
          >
            Xem tất cả
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
        {featuredExams.length === 0 ? (
          <Card className="p-8 text-center">
            <BookOpenCheck
              className="mx-auto text-slate-300"
              size={40}
              aria-hidden="true"
            />
            <h3 className="mt-4 font-heading text-lg font-bold text-foreground">
              Chưa có đề phù hợp
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Đề mới sẽ xuất hiện tại đây sau khi được duyệt và xuất bản.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {featuredExams.map((exam) => (
              <Card
                key={exam.id}
                className="group flex flex-col p-5 transition-shadow duration-200 hover:shadow-panel"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="grid size-11 place-items-center rounded-xl bg-primary-soft font-heading text-sm font-bold text-primary">
                    {exam.courseCode.slice(0, 3)}
                  </span>
                  <div className="flex gap-2">
                    {exam.isRetake && <Badge tone="pink">Retake</Badge>}
                    <Badge tone="blue">{exam.examType}</Badge>
                  </div>
                </div>
                <p className="mt-5 text-xs font-bold uppercase tracking-wider text-primary">
                  {exam.code}
                </p>
                <h3 className="mt-1 line-clamp-2 font-heading text-lg font-bold text-foreground">
                  {exam.courseName}
                </h3>
                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <BookOpenCheck size={15} aria-hidden="true" />
                    {exam.questionCount} câu
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock3 size={15} aria-hidden="true" />
                    {exam.durationMinutes} phút
                  </span>
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                  <span className="text-sm text-slate-500">{exam.campus}</span>
                  <Link
                    to="/exams/$examId"
                    params={{ examId: exam.id }}
                    className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-primary transition-colors hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20"
                  >
                    Xem đề
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

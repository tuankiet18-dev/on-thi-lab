import type {
  DailyUsage,
  ExamSummary,
  StudentStatistics,
} from "@onthilab/contracts";
import {
  ArrowRight,
  Award,
  BookOpenCheck,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  MapPin,
  Play,
  Search,
  Target,
  TrendingUp,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { catalogExams } from "../data/demo";
import { getCatalog, getDailyUsage, getStudentStatistics } from "../lib/api";
import { popularCourseCodes, searchCourses } from "../lib/catalog-search";

const emptyStatistics: StudentStatistics = {
  totalAttempts: 0,
  averageScore: null,
  highestScore: null,
  recentAttempts: [],
};

const emptyUsage: DailyUsage = {
  attemptsStarted: 0,
  limit: 2,
  remainingAttempts: 2,
};

export function DashboardPage() {
  const { configured, session, studentProfile } = useAuth();
  const [statistics, setStatistics] = useState(emptyStatistics);
  const [usage, setUsage] = useState(emptyUsage);
  const [exams, setExams] = useState<ExamSummary[]>(
    configured ? [] : catalogExams,
  );
  const [loading, setLoading] = useState(Boolean(session));
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");

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
      getDailyUsage(session.idToken),
      getCatalog(session.idToken),
    ])
      .then(([nextStatistics, nextUsage, nextExams]) => {
        if (!active) return;
        setStatistics(nextStatistics);
        setUsage(nextUsage);
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

    return () => {
      active = false;
    };
  }, [session]);

  const firstName =
    studentProfile?.fullName.trim().split(/\s+/).at(-1) ??
    session?.user.name.trim().split(/\s+/).at(-1) ??
    "bạn";
  const usagePercent = usage.limit
    ? Math.min(100, (usage.attemptsStarted / usage.limit) * 100)
    : 0;
  const featuredExams = exams.slice(0, 3);
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
  ];

  return (
    <div className="space-y-8">
      <section className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-[#173b8f] via-primary to-[#477bea] p-6 text-white shadow-panel sm:p-8 lg:p-10">
          <div className="relative z-10 max-w-2xl">
            <Badge tone="amber">Miễn phí giai đoạn ra mắt</Badge>
            <p className="mt-5 text-sm font-semibold text-blue-100">
              Chào mừng trở lại, {firstName}
            </p>
            <h1 className="mt-2 font-heading text-3xl font-bold leading-tight sm:text-4xl">
              Tìm đúng đề, vào thi ngay.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-blue-100 sm:text-lg">
              Nhập mã hoặc tên môn như SWD, PRF192, Java Web. Đề mới nhất sẽ
              luôn được ưu tiên để bạn bắt đầu ôn không cần tìm lâu.
            </p>
            <div className="mt-7 rounded-2xl border border-white/20 bg-slate-950/10 p-3 shadow-lg backdrop-blur-sm sm:p-4">
              <label className="relative block">
                <span className="sr-only">Tìm mã hoặc tên môn học</span>
                <Search
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-primary"
                  size={20}
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Tìm mã hoặc tên môn: SWD, PRF192, Java Web..."
                  className="min-h-13 w-full rounded-xl border border-white/60 bg-white py-3 pl-12 pr-4 text-base font-semibold text-foreground shadow-sm outline-none transition focus:border-white focus:ring-3 focus:ring-white/40"
                  aria-describedby="course-search-hint"
                />
              </label>
              <p id="course-search-hint" className="mt-3 text-sm text-blue-100">
                Gõ mã môn để xem các đề theo campus của bạn và từ kỳ gần nhất.
              </p>
              {quickCourseCodes.length > 0 && !trimmedQuery && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-blue-100">
                    Tìm nhanh:
                  </span>
                  {quickCourseCodes.map((courseCode) => (
                    <button
                      key={courseCode}
                      type="button"
                      onClick={() => setQuery(courseCode)}
                      className="min-h-9 cursor-pointer rounded-lg border border-white/25 bg-white/10 px-3 text-xs font-bold text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-white/40"
                    >
                      {courseCode}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <Target
            className="absolute bottom-8 right-8 hidden text-white/15 lg:block"
            size={150}
            strokeWidth={1.2}
            aria-hidden="true"
          />
        </div>

        <Card className="flex flex-col p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-500">
                Hạn mức hôm nay
              </p>
              <h2 className="mt-1 font-heading text-xl font-bold text-foreground">
                {usage.limit === null ? "Không giới hạn" : "Miễn phí"}
              </h2>
            </div>
            <Badge tone="blue">
              {usage.limit === null
                ? "Không giới hạn"
                : `${usage.attemptsStarted} / ${usage.limit} lượt`}
            </Badge>
          </div>
          <div className="mt-6 h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-200"
              style={{ width: `${usagePercent}%` }}
            />
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {usage.remainingAttempts === null ? (
              "Bạn có thể bắt đầu luyện thi bất cứ lúc nào."
            ) : (
              <>
                Bạn còn{" "}
                <strong className="text-foreground">
                  {usage.remainingAttempts} lượt thi
                </strong>{" "}
                hôm nay. Hạn mức được làm mới lúc 00:00.
              </>
            )}
          </p>
          <div className="my-5 border-t border-border" />
          <div className="space-y-3 text-sm text-slate-600">
            <div className="flex items-center gap-3">
              <span className="grid size-8 place-items-center rounded-lg bg-blue-50 text-primary">
                <MapPin size={16} aria-hidden="true" />
              </span>
              Campus: {studentProfile?.campus.name ?? "Đang cập nhật"}
            </div>
            <div className="flex items-center gap-3">
              <span className="grid size-8 place-items-center rounded-lg bg-amber-50 text-amber-600">
                <BookOpenCheck size={16} aria-hidden="true" />
              </span>
              Ngành: {studentProfile?.major.name ?? "Đang cập nhật"}
            </div>
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
        <div className="grid gap-4 sm:grid-cols-3">
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

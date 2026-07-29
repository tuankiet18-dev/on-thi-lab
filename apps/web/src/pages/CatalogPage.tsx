import type { ExamSummary } from "@onthilab/contracts";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpenCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  Search,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { catalogExams } from "../data/demo";
import { getCatalog } from "../lib/api";
import { searchCourses } from "../lib/catalog-search";

const COURSES_PER_PAGE = 8;
const EXAMS_PER_PAGE = 8;

function clampPage(page: number, totalPages: number) {
  return Math.min(Math.max(page, 1), Math.max(totalPages, 1));
}

export function CatalogPage() {
  const { configured, session } = useAuth();
  const catalogSearch = useRouterState({
    select: (state) => state.location.search as { q?: unknown },
  });
  const initialQuery =
    typeof catalogSearch.q === "string" ? catalogSearch.q : undefined;
  const [exams, setExams] = useState<ExamSummary[]>(
    configured ? [] : catalogExams,
  );
  const [loading, setLoading] = useState(Boolean(session));
  const [loadError, setLoadError] = useState("");
  const [loadVersion, setLoadVersion] = useState(0);
  const [query, setQuery] = useState(initialQuery ?? "");
  const deferredQuery = useDeferredValue(query);
  const [campus, setCampus] = useState("Tất cả campus");
  const [semester, setSemester] = useState("Tất cả kỳ học");
  const [selectedCourseCode, setSelectedCourseCode] = useState("");
  const [coursePage, setCoursePage] = useState(1);
  const [examPage, setExamPage] = useState(1);

  useEffect(() => {
    if (!session) return;
    let active = true;
    setLoading(true);
    setLoadError("");
    void getCatalog(session.idToken)
      .then((result) => {
        if (active) setExams(result);
      })
      .catch(() => {
        if (active) setLoadError("Không thể tải kho đề thi.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadVersion, session]);

  useEffect(() => {
    setQuery(initialQuery ?? "");
  }, [initialQuery]);

  useEffect(() => {
    setCoursePage(1);
    setExamPage(1);
  }, [campus, deferredQuery, semester]);

  const campuses = useMemo(
    () => [...new Set(exams.map((exam) => exam.campus))].sort(),
    [exams],
  );
  const semesters = useMemo(
    () => [...new Set(exams.map((exam) => exam.semester))].sort().reverse(),
    [exams],
  );
  const filteredExams = useMemo(
    () =>
      exams.filter(
        (exam) =>
          (campus === "Tất cả campus" || exam.campus === campus) &&
          (semester === "Tất cả kỳ học" || exam.semester === semester),
      ),
    [campus, exams, semester],
  );
  const courses = useMemo(
    () =>
      searchCourses(
        filteredExams,
        deferredQuery,
        campus === "Tất cả campus" ? undefined : campus,
      ),
    [campus, deferredQuery, filteredExams],
  );
  const resultCount = useMemo(
    () => courses.reduce((count, course) => count + course.exams.length, 0),
    [courses],
  );

  const coursePageCount = Math.ceil(courses.length / COURSES_PER_PAGE);
  const safeCoursePage = clampPage(coursePage, coursePageCount);
  const visibleCourses = courses.slice(
    (safeCoursePage - 1) * COURSES_PER_PAGE,
    safeCoursePage * COURSES_PER_PAGE,
  );
  const selectedCourse =
    visibleCourses.find((course) => course.courseCode === selectedCourseCode) ??
    visibleCourses[0];

  const selectedExams = selectedCourse?.exams ?? [];
  const examPageCount = Math.ceil(selectedExams.length / EXAMS_PER_PAGE);
  const safeExamPage = clampPage(examPage, examPageCount);
  const visibleExams = selectedExams.slice(
    (safeExamPage - 1) * EXAMS_PER_PAGE,
    safeExamPage * EXAMS_PER_PAGE,
  );

  function selectCourse(courseCode: string) {
    setSelectedCourseCode(courseCode);
    setExamPage(1);
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
            Kho đề thi
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Chọn môn, sau đó chọn đề muốn luyện.
          </p>
        </div>
        {!loading && (
          <p className="text-sm text-slate-600" aria-live="polite">
            <strong className="text-foreground">{courses.length}</strong> môn ·{" "}
            <strong className="text-foreground">{resultCount}</strong> đề
          </p>
        )}
      </header>

      <Card className="p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px]">
          <label className="relative block">
            <span className="sr-only">Tìm theo mã hoặc tên môn</span>
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm mã hoặc tên môn"
              className="input-base w-full pl-11"
            />
          </label>
          <label className="relative block">
            <span className="sr-only">Chọn campus</span>
            <select
              value={campus}
              onChange={(event) => setCampus(event.target.value)}
              className="input-base w-full appearance-none pr-10"
            >
              <option>Tất cả campus</option>
              {campuses.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              size={17}
              aria-hidden="true"
            />
          </label>
          <label className="relative block">
            <span className="sr-only">Chọn kỳ học</span>
            <select
              value={semester}
              onChange={(event) => setSemester(event.target.value)}
              className="input-base w-full appearance-none pr-10"
            >
              <option>Tất cả kỳ học</option>
              {semesters.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              size={17}
              aria-hidden="true"
            />
          </label>
        </div>
      </Card>

      {loadError && (
        <Card className="flex flex-col gap-4 border-red-200 bg-red-50 p-5 text-red-800 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-semibold">{loadError}</p>
          <Button
            variant="secondary"
            onClick={() => setLoadVersion((value) => value + 1)}
          >
            Thử tải lại
          </Button>
        </Card>
      )}

      {loading && (
        <div
          className="grid gap-5 lg:grid-cols-[minmax(260px,340px)_1fr]"
          aria-label="Đang tải kho đề"
        >
          <Card className="h-96 animate-pulse bg-slate-100" />
          <Card className="h-96 animate-pulse bg-slate-100" />
        </div>
      )}

      {!loading && courses.length > 0 && selectedCourse && (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
          <Card className="overflow-hidden lg:sticky lg:top-24">
            <div className="border-b border-border px-4 py-3">
              <h2 className="font-heading text-base font-bold text-foreground">
                Chọn môn
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Trang {safeCoursePage}/{Math.max(coursePageCount, 1)}
              </p>
            </div>
            <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-1">
              {visibleCourses.map((course) => {
                const isSelected =
                  course.courseCode === selectedCourse.courseCode;
                return (
                  <button
                    key={course.courseCode}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => selectCourse(course.courseCode)}
                    className={`flex min-h-16 w-full cursor-pointer items-center gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25 ${
                      isSelected
                        ? "border-primary bg-primary-soft"
                        : "border-transparent hover:border-blue-100 hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className={`grid size-10 shrink-0 place-items-center rounded-xl font-heading text-xs font-bold ${
                        isSelected
                          ? "bg-primary text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                      aria-hidden="true"
                    >
                      {course.courseCode.slice(0, 3)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold text-foreground">
                        {course.courseCode}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {course.courseName}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-slate-500">
                      {course.exams.length}
                    </span>
                  </button>
                );
              })}
            </div>
            {coursePageCount > 1 && (
              <div className="flex items-center justify-between border-t border-border px-3 py-2">
                <button
                  type="button"
                  onClick={() => setCoursePage((page) => Math.max(1, page - 1))}
                  disabled={safeCoursePage === 1}
                  className="inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={16} aria-hidden="true" />
                  Trước
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCoursePage((page) => Math.min(coursePageCount, page + 1))
                  }
                  disabled={safeCoursePage === coursePageCount}
                  className="inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Sau
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              </div>
            )}
          </Card>

          <Card className="overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-border bg-slate-50/70 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-blue-50 to-indigo-100 font-heading text-lg font-bold text-primary">
                  {selectedCourse.courseCode.slice(0, 3)}
                </div>
                <div className="min-w-0">
                  <p className="font-heading text-xl font-bold text-foreground">
                    {selectedCourse.courseCode}
                  </p>
                  <h2 className="truncate text-sm text-slate-600 sm:text-base">
                    {selectedCourse.courseName}
                  </h2>
                </div>
              </div>
              <span className="self-start sm:self-auto">
                <Badge tone="blue">{selectedExams.length} đề</Badge>
              </span>
            </div>

            <ul className="divide-y divide-border">
              {visibleExams.map((exam, index) => {
                const absoluteIndex =
                  (safeExamPage - 1) * EXAMS_PER_PAGE + index;
                return (
                  <li
                    key={exam.id}
                    className="flex flex-col gap-4 p-5 transition-colors hover:bg-primary-soft/40 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {absoluteIndex === 0 && (
                          <Badge tone="green">Mới nhất</Badge>
                        )}
                        <Badge tone="blue">{exam.examType}</Badge>
                        <Badge tone="slate">{exam.semester}</Badge>
                        {exam.isRetake && <Badge tone="pink">Retake</Badge>}
                      </div>
                      <p className="mt-2 font-bold text-foreground">
                        {exam.code}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-500">
                        <span className="flex items-center gap-1.5">
                          <BookOpenCheck size={15} aria-hidden="true" />
                          {exam.questionCount} câu
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock3 size={15} aria-hidden="true" />
                          {exam.durationMinutes} phút
                        </span>
                        <span className="flex items-center gap-1.5">
                          <MapPin size={15} aria-hidden="true" />
                          {exam.campus}
                        </span>
                      </div>
                    </div>
                    <Link
                      to="/exams/$examId"
                      params={{ examId: exam.id }}
                      className="inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25"
                    >
                      Xem đề
                      <ArrowRight size={17} aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
            </ul>

            {examPageCount > 1 && (
              <nav
                className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3"
                aria-label="Phân trang đề thi"
              >
                <p className="text-sm text-slate-500">
                  {Math.min(
                    (safeExamPage - 1) * EXAMS_PER_PAGE + 1,
                    selectedExams.length,
                  )}
                  –
                  {Math.min(
                    safeExamPage * EXAMS_PER_PAGE,
                    selectedExams.length,
                  )}{" "}
                  / {selectedExams.length}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setExamPage((page) => Math.max(1, page - 1))}
                    disabled={safeExamPage === 1}
                    className="grid size-11 cursor-pointer place-items-center rounded-xl border border-border text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Trang đề trước"
                  >
                    <ChevronLeft size={18} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setExamPage((page) => Math.min(examPageCount, page + 1))
                    }
                    disabled={safeExamPage === examPageCount}
                    className="grid size-11 cursor-pointer place-items-center rounded-xl border border-border text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Trang đề sau"
                  >
                    <ChevronRight size={18} aria-hidden="true" />
                  </button>
                </div>
              </nav>
            )}
          </Card>
        </div>
      )}

      {!loading && !loadError && courses.length === 0 && (
        <Card className="grid min-h-64 place-items-center p-8 text-center">
          <div>
            <Search
              className="mx-auto text-slate-300"
              size={42}
              aria-hidden="true"
            />
            <h2 className="mt-4 font-heading text-xl font-bold text-foreground">
              Không có đề phù hợp
            </h2>
            <p className="mt-2 text-slate-500">
              Thử mã môn khác hoặc bỏ bớt bộ lọc.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}

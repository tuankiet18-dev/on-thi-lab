import {
  ArrowRight,
  BookOpenCheck,
  Check,
  ChevronDown,
  Clock3,
  Filter,
  MapPin,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { catalogExams } from "../data/demo";

export function CatalogPage() {
  const [query, setQuery] = useState("");
  const [campus, setCampus] = useState("Tất cả campus");
  const [semester, setSemester] = useState("Tất cả kỳ học");

  const results = useMemo(
    () =>
      catalogExams.filter((exam) => {
        const searchText =
          `${exam.courseCode} ${exam.courseName} ${exam.code}`.toLowerCase();
        return (
          searchText.includes(query.toLowerCase()) &&
          (campus === "Tất cả campus" || exam.campus === campus) &&
          (semester === "Tất cả kỳ học" || exam.semester === semester)
        );
      }),
    [campus, query, semester],
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="section-kicker">
            Danh mục đầy đủ, dữ liệu phát hành dần
          </p>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
            Kho đề thi FE
          </h1>
          <p className="mt-2 max-w-2xl text-slate-600">
            Tìm đúng môn, campus và kỳ thi bạn muốn luyện. Mỗi đề giữ nguyên cấu
            trúc của lần thi đã công bố.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Check size={17} className="text-emerald-600" aria-hidden="true" />
          Đáp án được duyệt trước khi phát hành
        </div>
      </header>

      <Card className="p-4 sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[1fr_200px_200px_auto]">
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
              placeholder="Tìm mã môn hoặc tên môn..."
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
              <option>Hòa Lạc</option>
              <option>Hồ Chí Minh</option>
              <option>Đà Nẵng</option>
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
              <option>Spring 2026</option>
              <option>Fall 2025</option>
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              size={17}
              aria-hidden="true"
            />
          </label>
          <Button variant="secondary" icon={<SlidersHorizontal size={17} />}>
            Bộ lọc khác
          </Button>
        </div>
      </Card>

      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-slate-600">
          Tìm thấy <strong className="text-foreground">{results.length}</strong>{" "}
          đề phù hợp
        </p>
        <button
          type="button"
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg text-sm font-semibold text-slate-600 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20"
        >
          <Filter size={16} aria-hidden="true" />
          Mới nhất
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {results.map((exam) => (
          <Card
            key={exam.id}
            className="flex flex-col gap-5 p-5 transition-shadow duration-200 hover:shadow-panel sm:flex-row sm:items-center"
          >
            <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-blue-50 to-indigo-100 font-heading text-lg font-bold text-primary">
              {exam.courseCode.slice(0, 3)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="blue">{exam.examType}</Badge>
                <Badge tone="slate">{exam.semester}</Badge>
                {exam.isRetake && <Badge tone="pink">Retake</Badge>}
              </div>
              <p className="mt-3 text-xs font-bold uppercase tracking-wider text-primary">
                {exam.code}
              </p>
              <h2 className="mt-1 font-heading text-lg font-bold text-foreground">
                {exam.courseName}
              </h2>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-500">
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
              Chi tiết
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </Card>
        ))}
      </div>

      {results.length === 0 && (
        <Card className="grid min-h-64 place-items-center p-8 text-center">
          <div>
            <Search
              className="mx-auto text-slate-300"
              size={42}
              aria-hidden="true"
            />
            <h2 className="mt-4 font-heading text-xl font-bold text-foreground">
              Chưa tìm thấy đề phù hợp
            </h2>
            <p className="mt-2 text-slate-500">
              Hãy thử bỏ bớt bộ lọc hoặc tìm bằng mã môn.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}

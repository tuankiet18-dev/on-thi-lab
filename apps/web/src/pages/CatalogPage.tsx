import type { AttemptSummary, ExamSummary } from "@onthilab/contracts";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  CheckCircle2,
  ChevronDown,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import {
  CatalogExamCard,
  CatalogExamCardSkeleton,
} from "../components/CatalogExamCard";
import { SearchDropdown } from "../components/SearchDropdown";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { catalogExams } from "../data/demo";
import { getCatalog, listAttempts } from "../lib/api";
import { filterCatalogExams, type CatalogSort } from "../lib/catalog-search";

interface CatalogRouteSearch {
  q?: string;
  campus?: string;
  semester?: string;
  examType?: ExamSummary["examType"];
  sort?: CatalogSort;
}

function getRelevantAttempts(attempts: AttemptSummary[]) {
  const attemptsByExam = new Map<string, AttemptSummary>();

  for (const attempt of attempts) {
    if (attempt.status === "cancelled") continue;
    const current = attemptsByExam.get(attempt.examId);
    if (!current) {
      attemptsByExam.set(attempt.examId, attempt);
      continue;
    }

    const currentPriority =
      current.status === "in_progress" ? 2 : current.result ? 1 : 0;
    const nextPriority =
      attempt.status === "in_progress" ? 2 : attempt.result ? 1 : 0;
    if (
      nextPriority > currentPriority ||
      (nextPriority === currentPriority &&
        attempt.startedAt > current.startedAt)
    ) {
      attemptsByExam.set(attempt.examId, attempt);
    }
  }

  return attemptsByExam;
}

export function CatalogPage() {
  const { configured, session } = useAuth();
  const navigate = useNavigate();
  const catalogSearch = useRouterState({
    select: (state) => state.location.search as CatalogRouteSearch,
  });
  const [exams, setExams] = useState<ExamSummary[]>(
    configured ? [] : catalogExams,
  );
  const [attempts, setAttempts] = useState<AttemptSummary[]>([]);
  const [loading, setLoading] = useState(Boolean(session));
  const [loadError, setLoadError] = useState("");
  const [loadVersion, setLoadVersion] = useState(0);
  const [query, setQuery] = useState(catalogSearch.q ?? "");

  const campus = catalogSearch.campus;
  const semester = catalogSearch.semester;
  const examType = catalogSearch.examType;
  const sort = catalogSearch.sort ?? "newest";

  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setLoadError("");
    void Promise.all([
      getCatalog(session.idToken),
      listAttempts(session.idToken).catch(() => []),
    ])
      .then(([catalog, studentAttempts]) => {
        if (!active) return;
        setExams(catalog);
        setAttempts(studentAttempts);
      })
      .catch(() => {
        if (active) setLoadError("Không thể tải danh sách đề.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [loadVersion, session]);

  useEffect(() => {
    const routeQuery = catalogSearch.q ?? "";
    setQuery((currentQuery) =>
      currentQuery === routeQuery ? currentQuery : routeQuery,
    );
  }, [catalogSearch.q]);

  function updateRouteSearch(
    updates: Partial<CatalogRouteSearch>,
    replace = false,
  ) {
    void navigate({
      to: "/exams",
      replace,
      search: (previous: CatalogRouteSearch) => ({ ...previous, ...updates }),
    });
  }

  useEffect(() => {
    const routeQuery = catalogSearch.q ?? "";
    const nextQuery = query.trim();
    if (nextQuery === routeQuery) return;

    const timer = window.setTimeout(() => {
      updateRouteSearch({ q: nextQuery || undefined }, true);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [catalogSearch.q, query]);

  const campuses = useMemo(
    () => [...new Set(exams.map((exam) => exam.campus))].sort(),
    [exams],
  );
  const semesters = useMemo(
    () => [...new Set(exams.map((exam) => exam.semester))].sort().reverse(),
    [exams],
  );
  const availableExamTypes = useMemo(
    () => [...new Set(exams.map((exam) => exam.examType))].sort(),
    [exams],
  );
  const results = useMemo(
    () =>
      filterCatalogExams(exams, { query, campus, semester, examType, sort }),
    [campus, examType, exams, query, semester, sort],
  );
  const attemptsByExam = useMemo(
    () => getRelevantAttempts(attempts),
    [attempts],
  );

  const showExamType = availableExamTypes.length > 1;
  const hasActiveFilters = Boolean(
    query.trim() || campus || semester || examType,
  );
  const resultMessage = hasActiveFilters
    ? results.length === 0
      ? "Không tìm thấy đề phù hợp"
      : `Tìm thấy ${results.length} đề phù hợp`
    : `${results.length} đề hiện có`;

  function clearAllFilters() {
    setQuery("");
    void navigate({
      to: "/exams",
      search: { sort: sort === "oldest" ? "oldest" : undefined },
    });
  }

  return (
    <div className="space-y-6">
      <header className="max-w-3xl">
        <p className="section-kicker">Luyện đề theo môn và kỳ học</p>
        <h1 className="section-title">
          {showExamType ? "Kho đề thi" : "Kho đề thi FE"}
        </h1>
        <p className="mt-2 text-base leading-7 text-slate-600">
          Tìm đề theo môn học, campus và kỳ thi. Mỗi đề được trình bày theo cấu
          trúc của kỳ thi tương ứng.
        </p>
        <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-800">
          <CheckCircle2 size={16} aria-hidden="true" />
          Đề và đáp án được kiểm tra trước khi hiển thị.
        </p>
      </header>

      <Card className="p-4 sm:p-5">
        <div>
          <SearchDropdown
            exams={exams}
            campusName={campus}
            query={query}
            onQueryChange={setQuery}
            onViewAllResults={setQuery}
            placeholder="Tìm theo mã môn hoặc tên môn..."
            describedBy="catalog-search-hint"
          />
          <p id="catalog-search-hint" className="mt-2 text-sm text-slate-500">
            Ví dụ: SWD392, PRF192 hoặc tên môn học.
          </p>

          <div
            className={`mt-4 grid gap-4 ${
              showExamType ? "sm:grid-cols-3" : "sm:grid-cols-2"
            }`}
          >
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                Campus
              </span>
              <span className="relative block">
                <select
                  value={campus ?? ""}
                  onChange={(event) =>
                    updateRouteSearch({
                      campus: event.target.value || undefined,
                    })
                  }
                  className="input-base min-h-11 w-full appearance-none pr-10"
                >
                  <option value="">Tất cả campus</option>
                  {campuses.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  size={17}
                  aria-hidden="true"
                />
              </span>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                Kỳ học
              </span>
              <span className="relative block">
                <select
                  value={semester ?? ""}
                  onChange={(event) =>
                    updateRouteSearch({
                      semester: event.target.value || undefined,
                    })
                  }
                  className="input-base min-h-11 w-full appearance-none pr-10"
                >
                  <option value="">Tất cả kỳ học</option>
                  {semesters.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  size={17}
                  aria-hidden="true"
                />
              </span>
            </label>

            {showExamType && (
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Loại đề
                </span>
                <span className="relative block">
                  <select
                    value={examType ?? ""}
                    onChange={(event) =>
                      updateRouteSearch({
                        examType:
                          event.target.value === "FE" ||
                          event.target.value === "PE"
                            ? event.target.value
                            : undefined,
                      })
                    }
                    className="input-base min-h-11 w-full appearance-none pr-10"
                  >
                    <option value="">Tất cả loại đề</option>
                    {availableExamTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    size={17}
                    aria-hidden="true"
                  />
                </span>
              </label>
            )}
          </div>
        </div>
      </Card>

      {hasActiveFilters && (
        <section
          className="flex flex-wrap items-center gap-2"
          aria-label="Bộ lọc đang áp dụng"
        >
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600">
            <SlidersHorizontal size={16} aria-hidden="true" />
            Đang lọc:
          </span>
          {query.trim() && (
            <FilterChip
              label={`Từ khóa: ${query.trim()}`}
              onRemove={() => setQuery("")}
            />
          )}
          {campus && (
            <FilterChip
              label={campus}
              onRemove={() => updateRouteSearch({ campus: undefined })}
            />
          )}
          {semester && (
            <FilterChip
              label={semester}
              onRemove={() => updateRouteSearch({ semester: undefined })}
            />
          )}
          {examType && (
            <FilterChip
              label={examType}
              onRemove={() => updateRouteSearch({ examType: undefined })}
            />
          )}
          <button
            type="button"
            onClick={clearAllFilters}
            className="min-h-11 cursor-pointer px-2 text-sm font-semibold text-primary underline-offset-4 transition-colors hover:text-primary-strong hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25"
          >
            Xóa tất cả
          </button>
        </section>
      )}

      {loadError ? (
        <Card className="flex flex-col gap-4 border-red-200 bg-red-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-heading text-lg font-bold text-red-900">
              Không thể tải danh sách đề
            </h2>
            <p className="mt-1 text-sm text-red-800">
              Đã xảy ra lỗi khi tải dữ liệu. Vui lòng thử lại.
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => setLoadVersion((value) => value + 1)}
          >
            Thử lại
          </Button>
        </Card>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <p
              className="text-sm text-slate-600"
              aria-live="polite"
              aria-atomic="true"
            >
              {loading ? "Đang tải kho đề…" : resultMessage}
            </p>
            <label className="relative block w-full sm:w-48">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                Sắp xếp
              </span>
              <select
                value={sort}
                onChange={(event) =>
                  updateRouteSearch({
                    sort: event.target.value === "oldest" ? "oldest" : "newest",
                  })
                }
                className="input-base min-h-11 w-full appearance-none pr-10"
              >
                <option value="newest">Mới nhất</option>
                <option value="oldest">Cũ nhất</option>
              </select>
              <ChevronDown
                className="pointer-events-none absolute bottom-3.5 right-3.5 text-slate-400"
                size={17}
                aria-hidden="true"
              />
            </label>
          </div>

          {loading ? (
            <div
              className="grid gap-4 xl:grid-cols-2"
              aria-busy="true"
              aria-label="Đang tải kho đề"
            >
              {[0, 1, 2, 3].map((item) => (
                <CatalogExamCardSkeleton key={item} />
              ))}
            </div>
          ) : results.length > 0 ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {results.map((exam) => (
                <CatalogExamCard
                  key={exam.id}
                  exam={exam}
                  attempt={attemptsByExam.get(exam.id)}
                  showExamType={showExamType}
                />
              ))}
            </div>
          ) : (
            <Card className="grid min-h-64 place-items-center p-8 text-center">
              <div>
                <Search
                  className="mx-auto text-slate-300"
                  size={42}
                  aria-hidden="true"
                />
                <h2 className="mt-4 font-heading text-xl font-bold text-foreground">
                  {exams.length === 0
                    ? "Kho đề đang được cập nhật"
                    : "Không tìm thấy đề phù hợp"}
                </h2>
                <p className="mt-2 max-w-md text-slate-600">
                  {exams.length === 0
                    ? "Các đề mới sẽ được bổ sung sau khi hoàn tất kiểm duyệt."
                    : "Hãy thử mã môn khác hoặc điều chỉnh bộ lọc hiện tại."}
                </p>
                {hasActiveFilters && (
                  <Button
                    className="mt-5"
                    variant="secondary"
                    onClick={clearAllFilters}
                  >
                    Xóa bộ lọc
                  </Button>
                )}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 text-sm font-semibold text-blue-800 transition-colors hover:border-blue-300 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25"
      aria-label={`Xóa bộ lọc ${label}`}
    >
      {label}
      <X size={15} aria-hidden="true" />
    </button>
  );
}

import type {
  AdminCatalog,
  AdminCourse,
  AdminExamSummary,
  ExamFormatStatus,
} from "@onthilab/contracts";
import { examFormatStatuses } from "@onthilab/contracts";
import { Link, Navigate } from "@tanstack/react-router";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Edit2,
  FilePlus2,
  LoaderCircle,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import {
  type FormEvent,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "../auth/AuthContext";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import {
  ApiError,
  createAdminCourse,
  deleteAdminCourse,
  getAdminCatalog,
  getAllAdminExams,
  updateAdminCourse,
} from "../lib/api";

const emptyCatalog: AdminCatalog = { majors: [], curricula: [], courses: [] };

const statusLabels: Record<AdminExamSummary["status"], string> = {
  draft: "Nháp",
  review: "Chờ duyệt",
  published: "Đã xuất bản",
  cancelled: "Đã hủy",
};

const statusTones: Record<
  AdminExamSummary["status"],
  "amber" | "green" | "blue" | "slate"
> = {
  draft: "amber",
  review: "green",
  published: "blue",
  cancelled: "slate",
};

function isExamFormatStatus(value: string): value is ExamFormatStatus {
  return examFormatStatuses.includes(value as ExamFormatStatus);
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const messages: Record<string, string> = {
      COURSE_ALREADY_EXISTS: "Mã môn học này đã tồn tại.",
      COURSE_NOT_FOUND: "Môn học không còn tồn tại.",
      COURSE_IN_USE: "Môn học đã có đề thi nên không thể xóa.",
    };
    return messages[error.code] ?? "Không thể lưu thay đổi.";
  }
  return "Không thể kết nối tới hệ thống.";
}

export function AdminCatalogManagementPage() {
  const { configured, session, studentProfile } = useAuth();
  const [catalog, setCatalog] = useState<AdminCatalog>(emptyCatalog);
  const [exams, setExams] = useState<AdminExamSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [expandedCourseId, setExpandedCourseId] = useState<string>();

  const [courseCode, setCourseCode] = useState("");
  const [courseName, setCourseName] = useState("");
  const [examFormatStatus, setExamFormatStatus] =
    useState<ExamFormatStatus>("fe_candidate");
  const [editingCourseId, setEditingCourseId] = useState<string>();
  const [editingCourseCode, setEditingCourseCode] = useState("");
  const [editingCourseName, setEditingCourseName] = useState("");
  const [editingCourseFormatStatus, setEditingCourseFormatStatus] =
    useState<ExamFormatStatus>("fe_candidate");

  const isAdmin =
    !configured ||
    studentProfile?.role === "admin" ||
    session?.user.groups.includes("admin") === true;

  const refresh = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError("");
    try {
      const [nextCatalog, nextExams] = await Promise.all([
        getAdminCatalog(session.idToken),
        getAllAdminExams(session.idToken),
      ]);
      setCatalog(nextCatalog);
      setExams(nextExams);
    } catch {
      setError("Không thể tải danh sách môn học.");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const examsByCourse = useMemo(() => {
    const grouped = new Map<string, AdminExamSummary[]>();
    for (const exam of exams) {
      const courseExams = grouped.get(exam.courseCode) ?? [];
      courseExams.push(exam);
      grouped.set(exam.courseCode, courseExams);
    }
    for (const courseExams of grouped.values()) {
      courseExams.sort((left, right) =>
        right.createdAt.localeCompare(left.createdAt),
      );
    }
    return grouped;
  }, [exams]);

  const filteredCourses = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();
    return catalog.courses.filter((course) =>
      `${course.code} ${course.name}`.toLowerCase().includes(normalizedQuery),
    );
  }, [catalog.courses, deferredQuery]);

  if (!isAdmin) return <Navigate to="/" replace />;

  async function runSave(
    key: string,
    success: string,
    action: () => Promise<void>,
  ) {
    setError("");
    setNotice("");
    setSaving(key);
    try {
      await action();
      await refresh();
      setNotice(success);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(undefined);
    }
  }

  const submitCourse = (event: FormEvent) => {
    event.preventDefault();
    if (!session) return;
    void runSave("create", "Đã tạo môn học.", async () => {
      await createAdminCourse(session.idToken, {
        code: courseCode,
        name: courseName,
        priorityWave: 4,
        examFormatStatus,
      });
      setCourseCode("");
      setCourseName("");
      setExamFormatStatus("fe_candidate");
    });
  };

  const startEditingCourse = (course: AdminCourse) => {
    setEditingCourseId(course.id);
    setEditingCourseCode(course.code);
    setEditingCourseName(course.name);
    setEditingCourseFormatStatus(course.examFormatStatus);
  };

  const submitUpdateCourse = (event: FormEvent) => {
    event.preventDefault();
    if (!session || !editingCourseId) return;
    void runSave(
      `update-${editingCourseId}`,
      "Đã cập nhật môn học.",
      async () => {
        await updateAdminCourse(session.idToken, editingCourseId, {
          code: editingCourseCode,
          name: editingCourseName,
          examFormatStatus: editingCourseFormatStatus,
        });
        setEditingCourseId(undefined);
      },
    );
  };

  const removeCourse = (course: AdminCourse) => {
    if (!session) return;
    const courseExams = examsByCourse.get(course.code) ?? [];
    if (courseExams.length > 0) {
      setError(
        `Môn ${course.code} đã có ${courseExams.length} đề thi nên không thể xóa.`,
      );
      return;
    }
    if (!window.confirm(`Xóa môn ${course.code}?`)) return;
    void runSave(`delete-${course.id}`, "Đã xóa môn học.", () =>
      deleteAdminCourse(session.idToken, course.id),
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-kicker">Quản trị</p>
          <h1 className="section-title">Môn học và đề thi</h1>
          <p className="mt-2 text-slate-600">
            Tạo môn, sau đó quản lý toàn bộ đề thi ngay trong từng môn.
          </p>
        </div>
        <Link
          to="/admin/import"
          className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25"
        >
          <FilePlus2 size={18} aria-hidden="true" />
          Nhập đề
        </Link>
      </header>

      {error && (
        <p
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700"
          role="alert"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800"
          role="status"
        >
          {notice}
        </p>
      )}

      <Card className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-primary-soft text-primary">
            <Plus size={20} aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-heading text-lg font-bold text-foreground">
              Thêm môn học
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Chỉ cần mã môn và tên môn.
            </p>
          </div>
        </div>
        <form
          className="mt-5 grid gap-4 lg:grid-cols-[180px_1fr_220px_auto]"
          onSubmit={submitCourse}
        >
          <label className="form-field">
            <span>Mã môn *</span>
            <input
              className="input-base uppercase"
              value={courseCode}
              onChange={(event) =>
                setCourseCode(event.target.value.toUpperCase())
              }
              placeholder="SWD392"
              required
            />
          </label>
          <label className="form-field">
            <span>Tên môn *</span>
            <input
              className="input-base"
              value={courseName}
              onChange={(event) => setCourseName(event.target.value)}
              placeholder="Software Architecture and Design"
              required
            />
          </label>
          <label className="form-field">
            <span>Loại đề</span>
            <select
              className="input-base"
              value={examFormatStatus}
              onChange={(event) => {
                if (isExamFormatStatus(event.target.value)) {
                  setExamFormatStatus(event.target.value);
                }
              }}
            >
              <option value="fe_candidate">Có thể nhập FE</option>
              <option value="requires_review">Cần kiểm tra</option>
              <option value="not_fe">Chưa hỗ trợ FE</option>
            </select>
          </label>
          <Button
            className="self-end"
            type="submit"
            disabled={saving === "create"}
            icon={
              saving === "create" ? (
                <LoaderCircle className="animate-spin" size={17} />
              ) : (
                <Plus size={17} />
              )
            }
          >
            {saving === "create" ? "Đang tạo" : "Tạo môn"}
          </Button>
        </form>
      </Card>

      <section aria-labelledby="course-list-heading">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2
              id="course-list-heading"
              className="font-heading text-xl font-bold text-foreground"
            >
              Danh sách môn học
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {catalog.courses.length} môn · {exams.length} đề
            </p>
          </div>
          <label className="relative block w-full sm:max-w-sm">
            <span className="sr-only">Tìm môn học</span>
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
              aria-hidden="true"
            />
            <input
              type="search"
              className="input-base w-full pl-11"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm mã hoặc tên môn"
            />
          </label>
        </div>

        {loading ? (
          <Card className="mt-4 grid min-h-40 place-items-center">
            <LoaderCircle
              className="animate-spin text-primary"
              size={30}
              aria-label="Đang tải danh sách môn"
            />
          </Card>
        ) : (
          <div className="mt-4 space-y-3">
            {filteredCourses.map((course) => {
              const courseExams = examsByCourse.get(course.code) ?? [];
              const isExpanded = expandedCourseId === course.id;
              const publishedCount = courseExams.filter(
                (exam) => exam.status === "published",
              ).length;
              const pendingCount = courseExams.filter(
                (exam) => exam.status === "draft" || exam.status === "review",
              ).length;

              return (
                <Card key={course.id} className="overflow-hidden">
                  {editingCourseId === course.id ? (
                    <form
                      onSubmit={submitUpdateCourse}
                      className="grid gap-4 p-5 lg:grid-cols-[180px_1fr_220px_auto]"
                    >
                      <label className="form-field">
                        <span>Mã môn *</span>
                        <input
                          className="input-base uppercase"
                          value={editingCourseCode}
                          onChange={(event) =>
                            setEditingCourseCode(
                              event.target.value.toUpperCase(),
                            )
                          }
                          required
                        />
                      </label>
                      <label className="form-field">
                        <span>Tên môn *</span>
                        <input
                          className="input-base"
                          value={editingCourseName}
                          onChange={(event) =>
                            setEditingCourseName(event.target.value)
                          }
                          required
                        />
                      </label>
                      <label className="form-field">
                        <span>Loại đề</span>
                        <select
                          className="input-base"
                          value={editingCourseFormatStatus}
                          onChange={(event) => {
                            if (isExamFormatStatus(event.target.value)) {
                              setEditingCourseFormatStatus(event.target.value);
                            }
                          }}
                        >
                          <option value="fe_candidate">Có thể nhập FE</option>
                          <option value="requires_review">Cần kiểm tra</option>
                          <option value="not_fe">Chưa hỗ trợ FE</option>
                        </select>
                      </label>
                      <div className="flex items-end gap-2">
                        <Button
                          type="submit"
                          disabled={saving === `update-${course.id}`}
                        >
                          Lưu
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setEditingCourseId(undefined)}
                        >
                          Hủy
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center">
                      <button
                        type="button"
                        className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-4 text-left"
                        onClick={() =>
                          setExpandedCourseId(
                            isExpanded ? undefined : course.id,
                          )
                        }
                        aria-expanded={isExpanded}
                        aria-controls={`course-exams-${course.id}`}
                      >
                        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary-soft font-heading font-bold text-primary">
                          {course.code.slice(0, 3)}
                        </span>
                        <span className="min-w-0">
                          <span className="block font-heading text-lg font-bold text-foreground">
                            {course.code}
                          </span>
                          <span className="block text-sm text-slate-600">
                            {course.name}
                          </span>
                        </span>
                      </button>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="blue">{courseExams.length} đề</Badge>
                        <Badge tone="green">{publishedCount} đã xuất bản</Badge>
                        {pendingCount > 0 && (
                          <Badge tone="amber">{pendingCount} cần xử lý</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to="/admin/import"
                          search={{ course: course.code }}
                          className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border-strong bg-white px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25"
                        >
                          <FilePlus2 size={17} aria-hidden="true" />
                          Thêm đề
                        </Link>
                        <Button
                          type="button"
                          variant="ghost"
                          aria-label={`Sửa môn ${course.code}`}
                          onClick={() => startEditingCourse(course)}
                          icon={<Edit2 size={17} aria-hidden="true" />}
                        >
                          Sửa
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          aria-label={`Xóa môn ${course.code}`}
                          onClick={() => removeCourse(course)}
                          disabled={courseExams.length > 0}
                          icon={<Trash2 size={17} aria-hidden="true" />}
                        >
                          Xóa
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          aria-label={
                            isExpanded
                              ? `Thu gọn đề của ${course.code}`
                              : `Xem đề của ${course.code}`
                          }
                          onClick={() =>
                            setExpandedCourseId(
                              isExpanded ? undefined : course.id,
                            )
                          }
                          icon={
                            isExpanded ? (
                              <ChevronUp size={18} aria-hidden="true" />
                            ) : (
                              <ChevronDown size={18} aria-hidden="true" />
                            )
                          }
                        >
                          {isExpanded ? "Thu gọn" : "Xem đề"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {isExpanded && editingCourseId !== course.id && (
                    <div
                      id={`course-exams-${course.id}`}
                      className="border-t border-border bg-slate-50/70 p-4 sm:p-5"
                    >
                      {courseExams.length === 0 ? (
                        <div className="flex flex-col items-start gap-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-sm text-slate-600">
                            Môn này chưa có đề thi.
                          </p>
                          <Link
                            to="/admin/import"
                            search={{ course: course.code }}
                            className="text-sm font-bold text-primary hover:underline"
                          >
                            Nhập đề đầu tiên
                          </Link>
                        </div>
                      ) : (
                        <ul className="space-y-2">
                          {courseExams.map((exam) => (
                            <li
                              key={exam.id}
                              className="flex flex-col gap-3 rounded-xl border border-border bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div className="min-w-0">
                                <p className="font-bold text-foreground">
                                  {exam.code}
                                </p>
                                <p className="mt-1 text-sm text-slate-500">
                                  {exam.semester} ·{" "}
                                  {new Date(exam.createdAt).toLocaleDateString(
                                    "vi-VN",
                                  )}
                                </p>
                              </div>
                              <div className="flex items-center gap-3">
                                <Badge tone={statusTones[exam.status]}>
                                  {statusLabels[exam.status]}
                                </Badge>
                                {exam.status === "draft" ||
                                exam.status === "review" ? (
                                  <Link
                                    to="/admin/exams/$examId/review"
                                    params={{ examId: exam.id }}
                                    className="inline-flex min-h-11 items-center text-sm font-bold text-primary hover:underline"
                                  >
                                    Duyệt đề
                                  </Link>
                                ) : exam.status === "published" ? (
                                  <Link
                                    to="/exams/$examId"
                                    params={{ examId: exam.id }}
                                    className="inline-flex min-h-11 items-center text-sm font-bold text-primary hover:underline"
                                  >
                                    Xem đề
                                  </Link>
                                ) : null}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}

            {filteredCourses.length === 0 && (
              <Card className="grid min-h-52 place-items-center p-8 text-center">
                <div>
                  <BookOpen
                    className="mx-auto text-slate-300"
                    size={40}
                    aria-hidden="true"
                  />
                  <h3 className="mt-3 font-heading text-lg font-bold text-foreground">
                    Không tìm thấy môn học
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Thử tìm bằng mã môn hoặc tạo môn mới.
                  </p>
                </div>
              </Card>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

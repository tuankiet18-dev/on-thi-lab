import { Navigate } from "@tanstack/react-router";
import {
  BookMarked,
  BookOpen,
  GraduationCap,
  Layers3,
  Link2,
  LoaderCircle,
  Plus,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import type { AdminCatalog } from "@onthilab/contracts";
import { useAuth } from "../auth/AuthContext";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import {
  ApiError,
  createAdminCourse,
  createAdminCurriculum,
  createAdminMajor,
  getAdminCatalog,
  saveAdminCurriculumCourse,
} from "../lib/api";

const emptyCatalog: AdminCatalog = { majors: [], curricula: [], courses: [] };

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const messages: Record<string, string> = {
      MAJOR_ALREADY_EXISTS: "Mã ngành này đã tồn tại.",
      CURRICULUM_ALREADY_EXISTS:
        "Mã chương trình này đã tồn tại trong ngành đã chọn.",
      COURSE_ALREADY_EXISTS: "Mã môn học này đã tồn tại.",
      MAJOR_NOT_FOUND: "Ngành đã chọn không còn tồn tại.",
      CURRICULUM_NOT_FOUND: "Chương trình đã chọn không còn tồn tại.",
      COURSE_NOT_FOUND: "Môn học đã chọn không còn tồn tại.",
    };
    return messages[error.code] ?? "Không thể lưu thay đổi. Vui lòng thử lại.";
  }
  return "Không thể kết nối tới hệ thống. Vui lòng thử lại.";
}

export function AdminCatalogManagementPage() {
  const { configured, session, studentProfile } = useAuth();
  const [catalog, setCatalog] = useState<AdminCatalog>(emptyCatalog);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [majorCode, setMajorCode] = useState("");
  const [majorName, setMajorName] = useState("");
  const [curriculumMajorId, setCurriculumMajorId] = useState("");
  const [curriculumCode, setCurriculumCode] = useState("");
  const [curriculumName, setCurriculumName] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [courseName, setCourseName] = useState("");
  const [examFormatStatus, setExamFormatStatus] = useState<
    "fe_candidate" | "requires_review" | "not_fe"
  >("fe_candidate");
  const [placementCurriculumId, setPlacementCurriculumId] = useState("");
  const [placementCourseId, setPlacementCourseId] = useState("");
  const [termNumber, setTermNumber] = useState(1);
  const [isElective, setIsElective] = useState(false);

  const isAdmin =
    !configured ||
    studentProfile?.role === "admin" ||
    session?.user.groups.includes("admin") === true;

  const refresh = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      setCatalog(await getAdminCatalog(session.idToken));
    } catch {
      setError("Không thể tải danh mục đào tạo.");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!curriculumMajorId && catalog.majors[0]) {
      setCurriculumMajorId(catalog.majors[0].id);
    }
    if (!placementCurriculumId && catalog.curricula[0]) {
      setPlacementCurriculumId(catalog.curricula[0].id);
    }
    if (!placementCourseId && catalog.courses[0]) {
      setPlacementCourseId(catalog.courses[0].id);
    }
  }, [catalog, curriculumMajorId, placementCurriculumId, placementCourseId]);

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

  const submitMajor = (event: FormEvent) => {
    event.preventDefault();
    if (!session) return;
    void runSave("major", "Đã tạo ngành mới.", async () => {
      await createAdminMajor(session.idToken, {
        code: majorCode,
        name: majorName,
      });
      setMajorCode("");
      setMajorName("");
    });
  };

  const submitCurriculum = (event: FormEvent) => {
    event.preventDefault();
    if (!session || !curriculumMajorId) return;
    void runSave("curriculum", "Đã tạo chương trình đào tạo.", async () => {
      await createAdminCurriculum(session.idToken, {
        majorId: curriculumMajorId,
        code: curriculumCode,
        name: curriculumName,
        effectiveFrom: effectiveFrom || undefined,
      });
      setCurriculumCode("");
      setCurriculumName("");
      setEffectiveFrom("");
    });
  };

  const submitCourse = (event: FormEvent) => {
    event.preventDefault();
    if (!session) return;
    void runSave(
      "course",
      "Đã tạo môn học. Hãy gán môn vào chương trình bên dưới.",
      async () => {
        await createAdminCourse(session.idToken, {
          code: courseCode,
          name: courseName,
          priorityWave: 4,
          examFormatStatus,
        });
        setCourseCode("");
        setCourseName("");
      },
    );
  };

  const submitPlacement = (event: FormEvent) => {
    event.preventDefault();
    if (!session || !placementCurriculumId || !placementCourseId) return;
    void runSave(
      "placement",
      "Đã cập nhật môn vào chương trình. Có thể lưu lại để đổi kỳ học.",
      () =>
        saveAdminCurriculumCourse(session.idToken, {
          curriculumId: placementCurriculumId,
          courseId: placementCourseId,
          termNumber,
          isElective,
        }),
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-kicker">Danh mục đào tạo</p>
          <h1 className="section-title">Ngành, chương trình và môn học</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Cập nhật danh mục trước khi nhập đề. Một môn có thể được gán cho
            nhiều chương trình, vì vậy dữ liệu đề thi luôn bám đúng ngành và kỳ
            học.
          </p>
        </div>
        <Badge tone="blue">Chỉ quản trị viên</Badge>
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

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-primary-soft text-primary">
              <GraduationCap aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-heading text-lg font-bold text-foreground">
                1. Tạo ngành
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Ví dụ: SE, AI, IB, Digital Marketing.
              </p>
            </div>
          </div>
          <form
            className="mt-5 grid gap-4 sm:grid-cols-2"
            onSubmit={submitMajor}
          >
            <label className="form-field">
              <span>Mã ngành</span>
              <input
                className="input-base"
                value={majorCode}
                onChange={(e) => setMajorCode(e.target.value.toUpperCase())}
                placeholder="SE"
                required
              />
            </label>
            <label className="form-field">
              <span>Tên ngành</span>
              <input
                className="input-base"
                value={majorName}
                onChange={(e) => setMajorName(e.target.value)}
                placeholder="Software Engineering"
                required
              />
            </label>
            <Button
              className="sm:col-span-2 sm:justify-self-start"
              type="submit"
              disabled={saving === "major"}
              icon={<Plus size={17} />}
            >
              {saving === "major" ? "Đang tạo..." : "Tạo ngành"}
            </Button>
          </form>
          <div className="mt-6 border-t border-border pt-4">
            <p className="text-sm font-bold text-foreground">
              Ngành đã có ({catalog.majors.length})
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {catalog.majors.map((major) => (
                <Badge key={major.id} tone="blue">
                  {major.code} · {major.name}
                </Badge>
              ))}
              {catalog.majors.length === 0 && (
                <p className="text-sm text-slate-500">Chưa có ngành nào.</p>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-violet-50 text-violet-700">
              <Layers3 aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-heading text-lg font-bold text-foreground">
                2. Tạo chương trình
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Dùng phiên bản để phân biệt các khung đào tạo.
              </p>
            </div>
          </div>
          <form
            className="mt-5 grid gap-4 sm:grid-cols-2"
            onSubmit={submitCurriculum}
          >
            <label className="form-field sm:col-span-2">
              <span>Ngành</span>
              <select
                className="input-base"
                value={curriculumMajorId}
                onChange={(e) => setCurriculumMajorId(e.target.value)}
                required
              >
                <option value="">Chọn ngành</option>
                {catalog.majors.map((major) => (
                  <option value={major.id} key={major.id}>
                    {major.code} · {major.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>Mã chương trình</span>
              <input
                className="input-base"
                value={curriculumCode}
                onChange={(e) =>
                  setCurriculumCode(e.target.value.toUpperCase())
                }
                placeholder="SE-2026"
                required
              />
            </label>
            <label className="form-field">
              <span>Hiệu lực từ</span>
              <input
                className="input-base"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                placeholder="2026"
              />
            </label>
            <label className="form-field sm:col-span-2">
              <span>Tên chương trình</span>
              <input
                className="input-base"
                value={curriculumName}
                onChange={(e) => setCurriculumName(e.target.value)}
                placeholder="Kỹ thuật phần mềm 2026"
                required
              />
            </label>
            <Button
              className="sm:justify-self-start"
              type="submit"
              disabled={!curriculumMajorId || saving === "curriculum"}
              icon={<Plus size={17} />}
            >
              {saving === "curriculum" ? "Đang tạo..." : "Tạo chương trình"}
            </Button>
          </form>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
              <BookOpen aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-heading text-lg font-bold text-foreground">
                3. Tạo môn học
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Mã môn là duy nhất trong toàn bộ hệ thống.
              </p>
            </div>
          </div>
          <form
            className="mt-5 grid gap-4 sm:grid-cols-2"
            onSubmit={submitCourse}
          >
            <label className="form-field">
              <span>Mã môn</span>
              <input
                className="input-base"
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value.toUpperCase())}
                placeholder="SWE201C"
                required
              />
            </label>
            <label className="form-field">
              <span>Trạng thái FE</span>
              <select
                className="input-base"
                value={examFormatStatus}
                onChange={(e) =>
                  setExamFormatStatus(e.target.value as typeof examFormatStatus)
                }
              >
                <option value="fe_candidate">Có thể có FE</option>
                <option value="requires_review">Cần kiểm tra dạng đề</option>
                <option value="not_fe">Không dùng FE</option>
              </select>
            </label>
            <label className="form-field sm:col-span-2">
              <span>Tên môn</span>
              <input
                className="input-base"
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                placeholder="Introduction to Software Engineering"
                required
              />
            </label>
            <Button
              className="sm:justify-self-start"
              type="submit"
              disabled={saving === "course"}
              icon={<Plus size={17} />}
            >
              {saving === "course" ? "Đang tạo..." : "Tạo môn học"}
            </Button>
          </form>
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-amber-50 text-amber-700">
              <Link2 aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-heading text-lg font-bold text-foreground">
                4. Gán môn vào chương trình
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Chọn lại một cặp đã có để cập nhật kỳ học.
              </p>
            </div>
          </div>
          <form
            className="mt-5 grid gap-4 sm:grid-cols-2"
            onSubmit={submitPlacement}
          >
            <label className="form-field sm:col-span-2">
              <span>Chương trình</span>
              <select
                className="input-base"
                value={placementCurriculumId}
                onChange={(e) => setPlacementCurriculumId(e.target.value)}
                required
              >
                <option value="">Chọn chương trình</option>
                {catalog.curricula.map((curriculum) => (
                  <option key={curriculum.id} value={curriculum.id}>
                    {curriculum.majorCode} · {curriculum.code} —{" "}
                    {curriculum.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field sm:col-span-2">
              <span>Môn học</span>
              <select
                className="input-base"
                value={placementCourseId}
                onChange={(e) => setPlacementCourseId(e.target.value)}
                required
              >
                <option value="">Chọn môn học</option>
                {catalog.courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.code} · {course.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>Kỳ học</span>
              <input
                className="input-base"
                type="number"
                min="1"
                max="20"
                value={termNumber}
                onChange={(e) => setTermNumber(Number(e.target.value))}
                required
              />
            </label>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 self-end rounded-xl border border-border px-3 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={isElective}
                onChange={(e) => setIsElective(e.target.checked)}
              />
              Môn tự chọn
            </label>
            <Button
              className="sm:justify-self-start"
              type="submit"
              disabled={
                !placementCurriculumId ||
                !placementCourseId ||
                saving === "placement"
              }
              icon={<Link2 size={17} />}
            >
              {saving === "placement" ? "Đang lưu..." : "Lưu phân bổ"}
            </Button>
          </form>
        </Card>
      </section>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
          <div>
            <h2 className="font-heading text-lg font-bold text-foreground">
              Danh mục hiện có
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Dữ liệu này sẽ xuất hiện trong bước nhập đề.
            </p>
          </div>
          <BookMarked className="text-primary" aria-hidden="true" />
        </div>
        {loading ? (
          <div className="flex min-h-44 items-center justify-center gap-2 text-slate-500">
            <LoaderCircle className="animate-spin" size={20} />
            Đang tải danh mục...
          </div>
        ) : (
          <div className="divide-y divide-border">
            {catalog.courses.map((course) => (
              <article key={course.id} className="p-5 sm:px-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-foreground">
                      {course.code}{" "}
                      <span className="font-normal text-slate-500">
                        · {course.name}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {course.placements.length
                        ? course.placements
                            .map(
                              (placement) =>
                                `${placement.majorCode} / ${placement.curriculumCode} · Kỳ ${placement.termNumber}${placement.isElective ? " · tự chọn" : ""}`,
                            )
                            .join(" • ")
                        : "Chưa được gán vào chương trình nào"}
                    </p>
                  </div>
                  <Badge
                    tone={
                      course.examFormatStatus === "fe_candidate"
                        ? "green"
                        : course.examFormatStatus === "not_fe"
                          ? "slate"
                          : "amber"
                    }
                  >
                    {course.examFormatStatus === "fe_candidate"
                      ? "FE"
                      : course.examFormatStatus === "not_fe"
                        ? "Không FE"
                        : "Cần kiểm tra"}
                  </Badge>
                </div>
              </article>
            ))}
            {catalog.courses.length === 0 && (
              <p className="p-8 text-center text-sm text-slate-500">
                Chưa có môn học nào. Hãy tạo môn đầu tiên ở trên.
              </p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

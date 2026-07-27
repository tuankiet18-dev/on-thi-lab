import {
  Archive,
  ArrowRight,
  CheckCircle2,
  FileImage,
  FileUp,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Link, Navigate } from "@tanstack/react-router";
import { type FormEvent, useEffect, useState } from "react";
import type { AdminCatalog, ProfileOptions } from "@onthilab/contracts";
import { useAuth } from "../auth/AuthContext";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import {
  ApiError,
  getDraftExamReview,
  getAdminCatalog,
  getProfileOptions,
  saveQuestionReviewAnswer,
  uploadDraftImport,
} from "../lib/api";

export function AdminImportPage() {
  const { configured, session, studentProfile } = useAuth();
  const [archive, setArchive] = useState<File | null>(null);
  const [courseCode, setCourseCode] = useState("SWD392");
  const [semester, setSemester] = useState("SP26");
  const [campusCode, setCampusCode] = useState(
    studentProfile?.campus.code ?? "HL",
  );
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [isRetake, setIsRetake] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [importProgress, setImportProgress] = useState<string>("");
  const [createdDraft, setCreatedDraft] = useState<{
    examId: string;
    examCode: string;
    questionCount: number;
  } | null>(null);
  const [catalog, setCatalog] = useState<AdminCatalog | null>(null);
  const [profileOptions, setProfileOptions] = useState<ProfileOptions | null>(
    null,
  );
  const canContribute =
    !configured ||
    studentProfile?.role === "admin" ||
    studentProfile?.role === "contributor" ||
    session?.user.groups.some((group) =>
      ["admin", "contributor"].includes(group),
    );

  useEffect(() => {
    if (!session) return;
    Promise.all([
      getAdminCatalog(session.idToken),
      getProfileOptions(session.idToken),
    ])
      .then(([nextCatalog, nextOptions]) => {
        setCatalog(nextCatalog);
        setProfileOptions(nextOptions);
        setCourseCode((currentCourseCode) =>
          nextCatalog.courses.some(
            (course) => course.code === currentCourseCode,
          )
            ? currentCourseCode
            : (nextCatalog.courses[0]?.code ?? currentCourseCode),
        );
        setCampusCode((currentCampusCode) =>
          nextOptions.campuses.some(
            (campus) => campus.code === currentCampusCode,
          )
            ? currentCampusCode
            : (nextOptions.campuses[0]?.code ?? currentCampusCode),
        );
      })
      .catch(() => {
        // The form still provides the existing value so local development and
        // a temporary catalog outage do not block an in-progress import.
      });
  }, [session]);

  if (!canContribute) {
    return <Navigate to="/" replace />;
  }

  const submitImport = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setCreatedDraft(null);
    if (!archive || !session) {
      setError("Bạn cần đăng nhập và chọn file ZIP trước khi nhập đề.");
      return;
    }

    setSubmitting(true);
    setImportProgress("Đang tải file ZIP lên hệ thống...");
    try {
      const result = await uploadDraftImport(
        session.idToken,
        {
          courseCode,
          semester,
          campusCode,
          examType: "FE",
          isRetake,
          durationMinutes,
        },
        archive,
      );

      setImportProgress("Hoàn thành! Đang chuyển hướng...");

      setCreatedDraft({
        ...result,
      });
    } catch (reason) {
      if (reason instanceof SyntaxError) {
        setError("File answers.json không hợp lệ.");
      } else if (reason instanceof ApiError) {
        const messages: Record<string, string> = {
          CAMPUS_NOT_FOUND: "Campus không tồn tại trong hệ thống.",
          COURSE_NOT_FOUND: "Mã môn chưa có trong danh mục.",
          EXAM_ALREADY_EXISTS: "Đề thi này đã tồn tại.",
          INVALID_ARCHIVE:
            "ZIP không hợp lệ. Chỉ chứa ảnh câu hỏi hợp lệ, không trùng tên file và không có file lạ.",
        };
        setError(
          messages[reason.code] ?? "Không thể nhập đề. Vui lòng thử lại.",
        );
      } else {
        setError("Không thể nhập đề. Vui lòng thử lại.");
      }
    } finally {
      setSubmitting(false);
      setImportProgress("");
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <div className="flex items-center gap-2">
          <Badge tone="pink">
            {studentProfile?.role === "contributor" ? "Contributor" : "Admin"}
          </Badge>
          <span className="text-sm text-slate-500">Quy trình nhập đề</span>
        </div>
        <h1 className="mt-3 font-heading text-3xl font-bold text-foreground">
          Tạo đề thi mới
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Tải lên ZIP chứa ảnh đã làm sạch. Hệ thống kiểm tra thứ tự, đề xuất
          đáp án bằng AI và bắt buộc duyệt thủ công trước khi xuất bản.
        </p>
      </header>

      <ol className="grid gap-3 sm:grid-cols-4" aria-label="Tiến trình nhập đề">
        {[
          ["01", "Thông tin đề"],
          ["02", "Tải ảnh lên"],
          ["03", "Duyệt đáp án"],
          ["04", "Xuất bản"],
        ].map(([number, label], index) => (
          <li
            key={number}
            className={`flex items-center gap-3 rounded-xl border p-3 ${
              index === 0
                ? "border-primary bg-primary-soft text-primary"
                : "border-border bg-white text-slate-500"
            }`}
          >
            <span className="grid size-8 place-items-center rounded-lg bg-white text-xs font-bold shadow-sm">
              {number}
            </span>
            <span className="text-sm font-semibold">{label}</span>
          </li>
        ))}
      </ol>

      <div className="grid gap-6 lg:grid-cols-[1fr_310px]">
        <Card className="p-6 sm:p-8">
          <form onSubmit={submitImport}>
            <h2 className="font-heading text-xl font-bold text-foreground">
              1. Thông tin và nguồn ảnh
            </h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <label className="form-field">
                <span>Mã môn</span>
                <select
                  className="input-base"
                  value={courseCode}
                  onChange={(event) => setCourseCode(event.target.value)}
                  required
                >
                  {catalog?.courses.length ? (
                    catalog.courses.map((course) => (
                      <option key={course.id} value={course.code}>
                        {course.code} · {course.name}
                      </option>
                    ))
                  ) : (
                    <option value={courseCode}>{courseCode}</option>
                  )}
                </select>
                {catalog && catalog.courses.length === 0 && (
                  <span className="mt-1 text-xs text-amber-700">
                    Chưa có môn trong danh mục. Admin cần tạo môn trước khi nhập
                    đề.
                  </span>
                )}
              </label>
              <label className="form-field">
                <span>Kỳ học</span>
                <input
                  className="input-base"
                  value={semester}
                  onChange={(event) => setSemester(event.target.value)}
                  placeholder="SP26"
                  required
                />
              </label>
              <label className="form-field">
                <span>Campus</span>
                <select
                  className="input-base"
                  value={campusCode}
                  onChange={(event) => setCampusCode(event.target.value)}
                >
                  {(
                    profileOptions?.campuses ?? [
                      { code: "HL", name: "Hòa Lạc" },
                      { code: "HCM", name: "Hồ Chí Minh" },
                      { code: "DN", name: "Đà Nẵng" },
                      { code: "CT", name: "Cần Thơ" },
                      { code: "QN", name: "Quy Nhơn" },
                    ]
                  ).map((campus) => (
                    <option value={campus.code} key={campus.code}>
                      {campus.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>Loại thi</span>
                <select className="input-base">
                  <option>FE</option>
                </select>
              </label>
              <label className="form-field">
                <span>Thời gian (phút)</span>
                <input
                  className="input-base"
                  type="number"
                  min="15"
                  max="240"
                  value={durationMinutes}
                  onChange={(event) =>
                    setDurationMinutes(Number(event.target.value))
                  }
                  required
                />
              </label>
              <label className="flex cursor-pointer items-center gap-3 self-end rounded-xl border border-border p-3.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={isRetake}
                  onChange={(event) => setIsRetake(event.target.checked)}
                />
                Đây là đề thi lại (retake)
              </label>
            </div>

            <div className="mt-7">
              <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/40 p-8 text-center transition-colors hover:border-primary hover:bg-primary-soft focus-within:ring-3 focus-within:ring-primary/20">
                <input
                  type="file"
                  accept=".zip"
                  className="sr-only"
                  aria-label="Chọn file ZIP chứa ảnh câu hỏi"
                  onChange={(event) =>
                    setArchive(event.target.files?.[0] ?? null)
                  }
                />
                <span className="mx-auto grid size-12 place-items-center rounded-xl bg-white text-primary shadow-sm">
                  {archive ? (
                    <CheckCircle2 size={23} aria-hidden="true" />
                  ) : (
                    <FileUp size={23} aria-hidden="true" />
                  )}
                </span>
                <span className="mt-4 block font-heading text-lg font-bold text-foreground">
                  {archive?.name || "Chọn file ZIP chứa ảnh và đáp án"}
                </span>
                <span className="mt-2 block text-sm text-slate-500">
                  Chứa ảnh câu hỏi với tên bất kỳ (ví dụ 50 hoặc 60 ảnh), có thể
                  kèm answers.json
                </span>
              </label>
            </div>

            {error && (
              <p
                className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700"
                role="alert"
              >
                {error}
              </p>
            )}
            {createdDraft && (
              <div
                className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
                role="status"
              >
                <p className="font-bold text-base">
                  Đã tạo đề nháp {createdDraft.examCode}
                </p>
                <p className="mt-1">
                  {createdDraft.questionCount} ảnh đã được lưu. Bước tiếp theo
                  là duyệt đáp án trước khi xuất bản.
                </p>

                <Link
                  to="/admin/exams/$examId/review"
                  params={{ examId: createdDraft.examId }}
                  className="mt-4 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 font-bold text-white transition-colors hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-emerald-600/25"
                >
                  Duyệt đáp án ngay
                  <ArrowRight size={17} aria-hidden="true" />
                </Link>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <Button
                type="submit"
                disabled={
                  !archive || submitting || catalog?.courses.length === 0
                }
                icon={<ArrowRight size={17} />}
              >
                {submitting
                  ? importProgress || "Đang xử lý..."
                  : "Kiểm tra và tạo đề nháp"}
              </Button>
            </div>
          </form>
        </Card>

        <aside className="space-y-4">
          <Card className="p-5">
            <h2 className="font-heading font-bold text-foreground">
              Quy ước file ZIP
            </h2>
            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              <li className="flex gap-2">
                <Archive size={17} className="mt-0.5 shrink-0 text-primary" />
                Một ZIP tương ứng một đề thi.
              </li>
              <li className="flex gap-2">
                <FileImage size={17} className="mt-0.5 shrink-0 text-primary" />
                Tên ảnh bất kỳ đều hợp lệ; hệ thống tự gán thứ tự theo file
                trong ZIP. Không trùng tên file.
              </li>
              <li className="flex gap-2">
                <Sparkles size={17} className="mt-0.5 shrink-0 text-primary" />
                AI chỉ đề xuất, không tự xuất bản.
              </li>
              <li className="flex gap-2">
                <ShieldCheck
                  size={17}
                  className="mt-0.5 shrink-0 text-primary"
                />
                Lưu lịch sử mọi lần chỉnh đáp án.
              </li>
            </ul>
          </Card>
          <Card className="border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-bold text-amber-900">
              Kiểm tra trước khi tải
            </p>
            <p className="mt-2 text-sm leading-6 text-amber-800">
              Ảnh phải được làm sạch watermark, không chứa dữ liệu cá nhân và
              đúng thứ tự gốc của đề.
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}

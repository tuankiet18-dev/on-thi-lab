import {
  Archive,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  FileImage,
  FileUp,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Link, Navigate } from "@tanstack/react-router";
import { type FormEvent, useEffect, useState } from "react";
import type {
  AdminCatalog,
  CreateDraftImportInput,
  DraftImportResult,
  ProfileOptions,
} from "@onthilab/contracts";
import { useAuth } from "../auth/AuthContext";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import {
  ApiError,
  getAdminCatalog,
  getProfileOptions,
  uploadDraftImport,
} from "../lib/api";

type ImportStatus = "pending" | "uploading" | "success" | "error";

interface ImportQueueItem {
  id: string;
  archive: File;
  metadata: CreateDraftImportInput;
  status: ImportStatus;
  result?: DraftImportResult;
  error?: string;
}

const fallbackCampuses = [
  { code: "HL", name: "Hòa Lạc" },
  { code: "HCM", name: "Hồ Chí Minh" },
  { code: "DN", name: "Đà Nẵng" },
  { code: "CT", name: "Cần Thơ" },
  { code: "QN", name: "Quy Nhơn" },
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getImportErrorMessage(reason: unknown): string {
  if (reason instanceof SyntaxError) return "File answers.json không hợp lệ.";
  if (reason instanceof ApiError) {
    const messages: Record<string, string> = {
      CAMPUS_NOT_FOUND: "Campus không tồn tại trong hệ thống.",
      COURSE_NOT_FOUND: "Mã môn chưa có trong danh mục.",
      EXAM_ALREADY_EXISTS: "Đề thi này đã tồn tại.",
      INVALID_ARCHIVE:
        "ZIP không hợp lệ. Chỉ chứa ảnh câu hỏi hợp lệ, không trùng tên file và không có file lạ.",
    };
    return messages[reason.code] ?? "Không thể nhập đề. Vui lòng thử lại.";
  }
  return "Không thể nhập đề. Vui lòng thử lại.";
}

function queueStatusLabel(status: ImportStatus): string {
  const labels: Record<ImportStatus, string> = {
    pending: "Chờ nhập",
    uploading: "Đang nhập",
    success: "Đã tạo nháp",
    error: "Cần thử lại",
  };
  return labels[status];
}

let nextQueueItemId = 0;

export function AdminImportPage() {
  const { configured, session, studentProfile } = useAuth();
  const [courseCode, setCourseCode] = useState("SWD392");
  const [semester, setSemester] = useState("SP26");
  const [campusCode, setCampusCode] = useState(
    studentProfile?.campus.code ?? "HL",
  );
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [isRetake, setIsRetake] = useState(false);
  const [importQueue, setImportQueue] = useState<ImportQueueItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [importProgress, setImportProgress] = useState("");
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
  const campuses = profileOptions?.campuses ?? fallbackCampuses;
  const defaultMetadata: CreateDraftImportInput = {
    courseCode,
    semester,
    campusCode,
    examType: "FE",
    isRetake,
    durationMinutes,
  };
  const pendingItems = importQueue.filter((item) => item.status === "pending");
  const failedItems = importQueue.filter((item) => item.status === "error");
  const successfulItems = importQueue.filter(
    (item) => item.status === "success",
  );
  const itemsToImport = importQueue.filter(
    (item) => item.status === "pending" || item.status === "error",
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
        // The queue can still be prepared while the catalog is temporarily unavailable.
      });
  }, [session]);

  if (!canContribute) {
    return <Navigate to="/" replace />;
  }

  const updateQueueItem = (
    id: string,
    update: Partial<CreateDraftImportInput>,
  ) => {
    if (submitting) return;
    setImportQueue((items) =>
      items.map((item) =>
        item.id === id && item.status !== "success"
          ? { ...item, metadata: { ...item.metadata, ...update } }
          : item,
      ),
    );
  };

  const addArchives = (files: FileList | null) => {
    const selectedFiles = Array.from(files ?? []);
    const archives = selectedFiles.filter((file) =>
      file.name.toLowerCase().endsWith(".zip"),
    );
    const ignoredCount = selectedFiles.length - archives.length;

    if (archives.length === 0) {
      setError("Chỉ có thể thêm file ZIP chứa ảnh đề thi.");
      return;
    }

    setError(
      ignoredCount
        ? `${ignoredCount} file không phải ZIP đã không được thêm vào hàng đợi.`
        : "",
    );
    setImportQueue((items) => [
      ...items,
      ...archives.map((archive) => ({
        id: `import-${Date.now()}-${nextQueueItemId++}`,
        archive,
        metadata: { ...defaultMetadata },
        status: "pending" as const,
      })),
    ]);
  };

  const applyDefaultsToWaitingItems = () => {
    if (submitting) return;
    setImportQueue((items) =>
      items.map((item) =>
        item.status === "pending" || item.status === "error"
          ? { ...item, metadata: { ...defaultMetadata }, error: undefined }
          : item,
      ),
    );
  };

  const removeQueueItem = (id: string) => {
    if (submitting) return;
    setImportQueue((items) => items.filter((item) => item.id !== id));
  };

  const submitImport = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!session) {
      setError("Bạn cần đăng nhập trước khi nhập đề.");
      return;
    }
    if (itemsToImport.length === 0) {
      setError(
        "Hãy thêm ít nhất một ZIP mới hoặc thử lại một file đang lỗi trước khi nhập.",
      );
      return;
    }

    setSubmitting(true);
    let failedCount = 0;
    for (const [index, item] of itemsToImport.entries()) {
      setImportProgress(
        `Đang nhập ${index + 1}/${itemsToImport.length}: ${item.archive.name}`,
      );
      setImportQueue((items) =>
        items.map((currentItem) =>
          currentItem.id === item.id
            ? {
                ...currentItem,
                status: "uploading",
                error: undefined,
              }
            : currentItem,
        ),
      );

      try {
        const result = await uploadDraftImport(
          session.idToken,
          item.metadata,
          item.archive,
        );
        setImportQueue((items) =>
          items.map((currentItem) =>
            currentItem.id === item.id
              ? { ...currentItem, status: "success", result }
              : currentItem,
          ),
        );
      } catch (reason) {
        failedCount += 1;
        setImportQueue((items) =>
          items.map((currentItem) =>
            currentItem.id === item.id
              ? {
                  ...currentItem,
                  status: "error",
                  error: getImportErrorMessage(reason),
                }
              : currentItem,
          ),
        );
      }
    }

    setSubmitting(false);
    setImportProgress("");
    if (failedCount) {
      setError(
        `${failedCount} ZIP chưa được nhập. Xem lỗi tại từng file rồi bấm nhập lại.`,
      );
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <div className="flex items-center gap-2">
          <Badge tone="pink">
            {studentProfile?.role === "contributor" ? "Contributor" : "Admin"}
          </Badge>
          <span className="text-sm text-slate-500">Quy trình nhập đề</span>
        </div>
        <h1 className="mt-3 font-heading text-3xl font-bold text-foreground">
          Tạo nhiều đề thi
        </h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Thêm nhiều ZIP vào một hàng đợi. Mỗi ZIP có thể mang thông tin đề
          riêng và sẽ được nhập lần lượt để một lỗi không làm gián đoạn các đề
          còn lại.
        </p>
      </header>

      <ol className="grid gap-3 sm:grid-cols-4" aria-label="Tiến trình nhập đề">
        {[
          ["01", "Thiết lập mặc định"],
          ["02", "Thêm ZIP"],
          ["03", "Duyệt đáp án"],
          ["04", "Xuất bản"],
        ].map(([number, label], index) => (
          <li
            key={number}
            className={`flex items-center gap-3 rounded-xl border p-3 ${
              index < 2
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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="p-6 sm:p-8">
          <form onSubmit={submitImport}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-heading text-xl font-bold text-foreground">
                  1. Thiết lập mặc định
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Áp dụng cho ZIP được thêm sau đó. Bạn vẫn có thể chỉnh riêng
                  từng đề trong hàng đợi.
                </p>
              </div>
              {importQueue.length > 0 && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={applyDefaultsToWaitingItems}
                  disabled={submitting || itemsToImport.length === 0}
                  className="shrink-0"
                >
                  Áp dụng cho file chờ
                </Button>
              )}
            </div>

            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <label className="form-field">
                <span>Mã môn</span>
                <select
                  className="input-base truncate"
                  value={courseCode}
                  onChange={(event) => setCourseCode(event.target.value)}
                  disabled={submitting}
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
                  className="input-base truncate"
                  value={semester}
                  onChange={(event) => setSemester(event.target.value)}
                  placeholder="SP26"
                  disabled={submitting}
                  required
                />
              </label>
              <label className="form-field">
                <span>Campus</span>
                <select
                  className="input-base truncate"
                  value={campusCode}
                  onChange={(event) => setCampusCode(event.target.value)}
                  disabled={submitting}
                >
                  {campuses.map((campus) => (
                    <option value={campus.code} key={campus.code}>
                      {campus.name}
                    </option>
                  ))}
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
                  disabled={submitting}
                  required
                />
              </label>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 self-end rounded-xl border border-border p-3.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={isRetake}
                  onChange={(event) => setIsRetake(event.target.checked)}
                  disabled={submitting}
                />
                Đây là đề thi lại (retake)
              </label>
            </div>

            <div className="mt-8">
              <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/40 p-8 text-center transition-colors hover:border-primary hover:bg-primary-soft focus-within:ring-3 focus-within:ring-primary/20 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
                <input
                  type="file"
                  accept=".zip,application/zip"
                  multiple
                  className="sr-only"
                  aria-label="Chọn một hoặc nhiều file ZIP chứa ảnh câu hỏi"
                  disabled={submitting}
                  onChange={(event) => {
                    addArchives(event.target.files);
                    event.target.value = "";
                  }}
                />
                <span className="mx-auto grid size-12 place-items-center rounded-xl bg-white text-primary shadow-sm">
                  <FileUp size={23} aria-hidden="true" />
                </span>
                <span className="mt-4 block font-heading text-lg font-bold text-foreground">
                  Chọn một hoặc nhiều ZIP chứa ảnh và đáp án
                </span>
                <span className="mt-2 block text-sm text-slate-500">
                  Có thể chọn lại để bổ sung thêm file. Mỗi ZIP sẽ thành một đề
                  nháp độc lập.
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

            <section className="mt-8" aria-labelledby="import-queue-heading">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2
                    id="import-queue-heading"
                    className="font-heading text-xl font-bold text-foreground"
                  >
                    2. Hàng đợi đề thi
                  </h2>
                  <p className="mt-1 text-sm text-slate-500" aria-live="polite">
                    {importQueue.length
                      ? `${importQueue.length} ZIP · ${successfulItems.length} đã tạo nháp · ${failedItems.length} cần thử lại`
                      : "Chưa có ZIP nào trong hàng đợi."}
                  </p>
                </div>
                {submitting && (
                  <div
                    className="inline-flex items-center gap-2 text-sm font-semibold text-primary"
                    role="status"
                  >
                    <LoaderCircle
                      className="animate-spin"
                      size={18}
                      aria-hidden="true"
                    />
                    {importProgress}
                  </div>
                )}
              </div>

              {importQueue.length > 0 && (
                <div className="mt-4 space-y-4">
                  {importQueue.map((item, index) => {
                    const isLocked = submitting || item.status === "success";
                    const statusTone =
                      item.status === "success"
                        ? "green"
                        : item.status === "error"
                          ? "pink"
                          : item.status === "uploading"
                            ? "amber"
                            : "slate";
                    return (
                      <article
                        key={item.id}
                        className="rounded-2xl border border-border bg-slate-50/70 p-4 sm:p-5"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex min-w-0 items-start gap-3">
                            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-primary shadow-sm">
                              {item.status === "uploading" ? (
                                <LoaderCircle
                                  className="animate-spin"
                                  size={20}
                                  aria-hidden="true"
                                />
                              ) : item.status === "success" ? (
                                <CheckCircle2 size={20} aria-hidden="true" />
                              ) : item.status === "error" ? (
                                <CircleAlert
                                  className="text-red-600"
                                  size={20}
                                  aria-hidden="true"
                                />
                              ) : (
                                <Archive size={20} aria-hidden="true" />
                              )}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-foreground">
                                {index + 1}. {item.archive.name}
                              </p>
                              <p className="mt-0.5 text-sm text-slate-500">
                                {formatFileSize(item.archive.size)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 sm:justify-end">
                            <Badge tone={statusTone}>
                              {queueStatusLabel(item.status)}
                            </Badge>
                            {item.status !== "success" && (
                              <button
                                type="button"
                                onClick={() => removeQueueItem(item.id)}
                                disabled={submitting}
                                className="grid size-11 cursor-pointer place-items-center rounded-xl text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-50"
                                aria-label={`Bỏ ${item.archive.name} khỏi hàng đợi`}
                              >
                                <Trash2 size={18} aria-hidden="true" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                          <label className="form-field">
                            <span>Mã môn</span>
                            <select
                              className="input-base"
                              value={item.metadata.courseCode}
                              onChange={(event) =>
                                updateQueueItem(item.id, {
                                  courseCode: event.target.value,
                                })
                              }
                              disabled={isLocked}
                              required
                            >
                              {catalog?.courses.length ? (
                                catalog.courses.map((course) => (
                                  <option key={course.id} value={course.code}>
                                    {course.code}
                                  </option>
                                ))
                              ) : (
                                <option value={item.metadata.courseCode}>
                                  {item.metadata.courseCode}
                                </option>
                              )}
                            </select>
                          </label>
                          <label className="form-field">
                            <span>Kỳ học</span>
                            <input
                              className="input-base"
                              value={item.metadata.semester}
                              onChange={(event) =>
                                updateQueueItem(item.id, {
                                  semester: event.target.value,
                                })
                              }
                              disabled={isLocked}
                              required
                            />
                          </label>
                          <label className="form-field">
                            <span>Campus</span>
                            <select
                              className="input-base"
                              value={item.metadata.campusCode}
                              onChange={(event) =>
                                updateQueueItem(item.id, {
                                  campusCode: event.target.value,
                                })
                              }
                              disabled={isLocked}
                            >
                              {campuses.map((campus) => (
                                <option key={campus.code} value={campus.code}>
                                  {campus.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="form-field">
                            <span>Thời gian</span>
                            <input
                              className="input-base"
                              type="number"
                              min="15"
                              max="240"
                              value={item.metadata.durationMinutes}
                              onChange={(event) =>
                                updateQueueItem(item.id, {
                                  durationMinutes: Number(event.target.value),
                                })
                              }
                              disabled={isLocked}
                              required
                            />
                          </label>
                          <label className="flex min-h-11 cursor-pointer items-center gap-3 self-end rounded-xl border border-border bg-white p-3.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
                            <input
                              type="checkbox"
                              className="size-4 accent-primary"
                              checked={item.metadata.isRetake}
                              onChange={(event) =>
                                updateQueueItem(item.id, {
                                  isRetake: event.target.checked,
                                })
                              }
                              disabled={isLocked}
                            />
                            Đề thi lại
                          </label>
                        </div>

                        {item.error && (
                          <p
                            className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700"
                            role="alert"
                          >
                            {item.error}
                          </p>
                        )}
                        {item.result && (
                          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 sm:flex-row sm:items-center sm:justify-between">
                            <p>
                              <span className="font-bold">
                                {item.result.examCode}
                              </span>
                              {` · ${item.result.questionCount} ảnh đã được lưu`}
                            </p>
                            <Link
                              to="/admin/exams/$examId/review"
                              params={{ examId: item.result.examId }}
                              className="inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 font-bold text-white transition-colors hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-emerald-600/25"
                            >
                              Duyệt đáp án
                              <ArrowRight size={17} aria-hidden="true" />
                            </Link>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">
                {pendingItems.length
                  ? `${pendingItems.length} đề mới sẵn sàng nhập.`
                  : failedItems.length
                    ? `${failedItems.length} đề lỗi có thể nhập lại.`
                    : importQueue.length
                      ? "Tất cả đề trong hàng đợi đã được tạo nháp."
                      : "Thêm ZIP để bắt đầu."}
              </p>
              <Button
                type="submit"
                disabled={
                  itemsToImport.length === 0 ||
                  submitting ||
                  catalog?.courses.length === 0
                }
                icon={
                  submitting ? (
                    <LoaderCircle className="animate-spin" size={17} />
                  ) : (
                    <ArrowRight size={17} />
                  )
                }
              >
                {submitting
                  ? importProgress || "Đang nhập..."
                  : pendingItems.length
                    ? `Nhập ${itemsToImport.length} đề`
                    : `Nhập lại ${failedItems.length} file lỗi`}
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
                Mỗi ZIP tương ứng một đề thi độc lập.
              </li>
              <li className="flex gap-2">
                <FileImage size={17} className="mt-0.5 shrink-0 text-primary" />
                Tên ảnh bất kỳ đều hợp lệ; hệ thống tự gán thứ tự theo file
                trong ZIP. Không trùng tên file.
              </li>
              <li className="flex gap-2">
                <Sparkles size={17} className="mt-0.5 shrink-0 text-primary" />
                answers.json được ưu tiên; AI chỉ đề xuất, không tự xuất bản.
              </li>
              <li className="flex gap-2">
                <ShieldCheck
                  size={17}
                  className="mt-0.5 shrink-0 text-primary"
                />
                Đề mới luôn cần duyệt đáp án trước khi xuất bản.
              </li>
            </ul>
          </Card>
          <Card className="border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-bold text-amber-900">
              Nhập theo hàng đợi
            </p>
            <p className="mt-2 text-sm leading-6 text-amber-800">
              Hệ thống tải từng ZIP một. Nếu một file lỗi, các file phía sau vẫn
              tiếp tục; bạn chỉ cần chỉnh file lỗi và nhập lại sau.
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}

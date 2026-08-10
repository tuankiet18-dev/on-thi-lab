import type {
  AdminCatalog,
  CreateDraftImportInput,
  DraftImportResult,
  ProfileOptions,
} from "@onthilab/contracts";
import { Link, Navigate } from "@tanstack/react-router";
import {
  Archive,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  FileUp,
  LoaderCircle,
  Trash2,
} from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
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
import { cn } from "../lib/cn";

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

const emptyMetadata = (): CreateDraftImportInput => ({
  courseCode: "",
  semester: "",
  campusCode: "",
  examType: "FE",
  isRetake: false,
  durationMinutes: 0,
  extractText: false,
});

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
        "ZIP không hợp lệ. Kiểm tra lại ảnh, tên file và answers.json.",
      DUPLICATE_IMAGES: "ZIP chứa các ảnh giống hệt nhau (nội dung trùng lặp).",
    };
    return messages[reason.code] ?? "Không thể nhập đề. Vui lòng thử lại.";
  }
  return "Không thể nhập đề. Vui lòng thử lại.";
}

function queueStatusLabel(status: ImportStatus): string {
  return {
    pending: "Chờ nhập",
    uploading: "Đang nhập",
    success: "Đã tạo nháp",
    error: "Cần thử lại",
  }[status];
}

function isMetadataComplete(metadata: CreateDraftImportInput): boolean {
  return (
    metadata.courseCode.length > 0 &&
    metadata.semester.trim().length > 0 &&
    metadata.campusCode.length > 0 &&
    metadata.durationMinutes >= 15 &&
    metadata.durationMinutes <= 240
  );
}

let nextQueueItemId = 0;

export function AdminImportPage() {
  const { configured, session, studentProfile } = useAuth();
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
  const waitingItems = importQueue.filter(
    (item) => item.status === "pending" || item.status === "error",
  );
  const readyItems = waitingItems.filter((item) =>
    isMetadataComplete(item.metadata),
  );
  const incompleteCount = waitingItems.length - readyItems.length;
  const failedItems = importQueue.filter((item) => item.status === "error");
  const successfulItems = importQueue.filter(
    (item) => item.status === "success",
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
      })
      .catch(() => {
        // Files can still be selected while the catalog is temporarily unavailable.
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
          ? {
              ...item,
              metadata: { ...item.metadata, ...update },
              status: "pending",
              error: undefined,
            }
          : item,
      ),
    );
    setError("");
  };

  const addArchives = (files: FileList | null) => {
    const selectedFiles = Array.from(files ?? []);
    const archives = selectedFiles.filter((file) =>
      file.name.toLowerCase().endsWith(".zip"),
    );
    const ignoredCount = selectedFiles.length - archives.length;

    if (archives.length === 0) {
      setError("Chỉ có thể thêm file ZIP.");
      return;
    }

    setError(
      ignoredCount ? `${ignoredCount} file không phải ZIP đã được bỏ qua.` : "",
    );
    setImportQueue((items) => [
      ...items,
      ...archives.map((archive) => ({
        id: `import-${Date.now()}-${nextQueueItemId++}`,
        archive,
        metadata: emptyMetadata(),
        status: "pending" as const,
      })),
    ]);
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
    if (readyItems.length === 0) {
      setError(
        waitingItems.length
          ? "Điền đủ thông tin cho ít nhất một ZIP."
          : "Thêm ít nhất một ZIP để bắt đầu.",
      );
      return;
    }

    setSubmitting(true);
    let failedCount = 0;
    for (const [index, item] of readyItems.entries()) {
      setImportProgress(
        `Đang nhập ${index + 1}/${readyItems.length}: ${item.archive.name}`,
      );
      setImportQueue((items) =>
        items.map((currentItem) =>
          currentItem.id === item.id
            ? { ...currentItem, status: "uploading", error: undefined }
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
      setError(`${failedCount} ZIP chưa nhập được. Kiểm tra lỗi bên dưới.`);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Badge tone="pink">
              {studentProfile?.role === "contributor" ? "Contributor" : "Admin"}
            </Badge>
            <span className="text-sm text-slate-500">Mỗi ZIP là một đề</span>
          </div>
          <h1 className="mt-2 font-heading text-3xl font-bold text-foreground">
            Nhập đề thi
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Chọn ZIP, điền thông tin từng đề rồi tạo bản nháp.
          </p>
        </div>
        <Link
          to="/admin/drafts"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-white px-4 text-sm font-bold text-slate-700 transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25"
        >
          Mở đề chờ duyệt
        </Link>
      </header>

      <form onSubmit={submitImport}>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
          <Card className="overflow-hidden">
            <div className="border-b border-border p-5 sm:p-6">
              <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/40 p-6 text-center transition-colors hover:border-primary hover:bg-primary-soft focus-within:ring-3 focus-within:ring-primary/20 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
                <input
                  type="file"
                  accept=".zip,application/zip"
                  multiple
                  className="sr-only"
                  aria-label="Chọn một hoặc nhiều file ZIP"
                  disabled={submitting}
                  onChange={(event) => {
                    addArchives(event.target.files);
                    event.target.value = "";
                  }}
                />
                <span className="mx-auto grid size-11 place-items-center rounded-xl bg-white text-primary shadow-sm">
                  <FileUp size={21} aria-hidden="true" />
                </span>
                <span className="mt-3 block font-heading text-lg font-bold">
                  Chọn một hoặc nhiều ZIP
                </span>
                <span className="mt-1 block text-sm text-slate-500">
                  Thông tin đề sẽ không được điền sẵn.
                </span>
              </label>

              {error && (
                <p
                  className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700"
                  role="alert"
                >
                  {error}
                </p>
              )}
            </div>

            <section aria-labelledby="import-queue-heading">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
                <div>
                  <h2
                    id="import-queue-heading"
                    className="font-heading text-lg font-bold"
                  >
                    Hàng đợi
                  </h2>
                  <p
                    className="mt-0.5 text-sm text-slate-500"
                    aria-live="polite"
                  >
                    {importQueue.length
                      ? `${importQueue.length} ZIP · ${successfulItems.length} đã tạo · ${incompleteCount} thiếu thông tin`
                      : "Chưa có file nào."}
                  </p>
                </div>
                {submitting && (
                  <p
                    className="flex items-center gap-2 text-sm font-semibold text-primary"
                    role="status"
                  >
                    <LoaderCircle
                      className="animate-spin"
                      size={18}
                      aria-hidden="true"
                    />
                    {importProgress}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-4 bg-slate-50 px-5 py-3 border-b border-border">
                <span className="text-sm font-semibold text-slate-700">
                  Bulk action:
                </span>
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer hover:text-slate-900">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    disabled={submitting || importQueue.length === 0}
                    checked={
                      importQueue.length > 0 &&
                      importQueue.every((item) => item.metadata.extractText)
                    }
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setImportQueue((items) =>
                        items.map((item) =>
                          item.status !== "success"
                            ? {
                                ...item,
                                metadata: {
                                  ...item.metadata,
                                  extractText: checked,
                                },
                              }
                            : item,
                        ),
                      );
                    }}
                  />
                  OCR + ảnh dự phòng cho tất cả đề
                </label>
              </div>

              {importQueue.length === 0 ? (
                <div className="grid min-h-44 place-items-center p-6 text-center text-sm text-slate-500">
                  ZIP được chọn sẽ xuất hiện tại đây để bạn điền thông tin.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {importQueue.map((item, index) => {
                    const isLocked = submitting || item.status === "success";
                    const complete = isMetadataComplete(item.metadata);
                    const statusTone =
                      item.status === "success"
                        ? "green"
                        : item.status === "error"
                          ? "pink"
                          : item.status === "uploading"
                            ? "amber"
                            : complete
                              ? "green"
                              : "slate";
                    return (
                      <article
                        key={item.id}
                        className="p-5 sm:p-6"
                        aria-label={`ZIP ${index + 1}: ${item.archive.name}`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                              {item.status === "uploading" ? (
                                <LoaderCircle
                                  className="animate-spin"
                                  size={19}
                                  aria-hidden="true"
                                />
                              ) : item.status === "success" ? (
                                <CheckCircle2 size={19} aria-hidden="true" />
                              ) : item.status === "error" ? (
                                <CircleAlert
                                  className="text-red-600"
                                  size={19}
                                  aria-hidden="true"
                                />
                              ) : (
                                <Archive size={19} aria-hidden="true" />
                              )}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-bold">
                                {item.archive.name}
                              </p>
                              <p className="text-xs text-slate-500">
                                {formatFileSize(item.archive.size)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Badge tone={statusTone}>
                              {item.status === "pending" && complete
                                ? "Sẵn sàng"
                                : item.status === "pending"
                                  ? "Thiếu thông tin"
                                  : queueStatusLabel(item.status)}
                            </Badge>
                            {item.status !== "success" && (
                              <button
                                type="button"
                                onClick={() => removeQueueItem(item.id)}
                                disabled={submitting}
                                className="grid size-11 cursor-pointer place-items-center rounded-xl text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-50"
                                aria-label={`Bỏ ${item.archive.name}`}
                              >
                                <Trash2 size={18} aria-hidden="true" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                          <label className="form-field">
                            <span>Môn học</span>
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
                              <option value="">Chọn môn</option>
                              {catalog?.courses.map((course) => (
                                <option key={course.id} value={course.code}>
                                  {course.code} · {course.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="form-field">
                            <span>Kỳ học</span>
                            <input
                              className="input-base"
                              value={item.metadata.semester}
                              onChange={(event) =>
                                updateQueueItem(item.id, {
                                  semester: event.target.value.toUpperCase(),
                                })
                              }
                              placeholder="VD: SP26"
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
                              required
                            >
                              <option value="">Chọn campus</option>
                              {campuses.map((campus) => (
                                <option key={campus.code} value={campus.code}>
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
                              value={item.metadata.durationMinutes || ""}
                              onChange={(event) =>
                                updateQueueItem(item.id, {
                                  durationMinutes: Number(event.target.value),
                                })
                              }
                              placeholder="VD: 60"
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
                            Thi lại
                          </label>
                          <label className="flex min-h-11 cursor-pointer items-center gap-3 self-end rounded-xl border border-border bg-white p-3.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
                            <input
                              type="checkbox"
                              className="size-4 accent-primary"
                              checked={item.metadata.extractText}
                              onChange={(event) =>
                                updateQueueItem(item.id, {
                                  extractText: event.target.checked,
                                })
                              }
                              disabled={isLocked}
                            />
                            OCR + ảnh dự phòng
                          </label>
                        </div>

                        {item.error && (
                          <p
                            className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700"
                            role="alert"
                          >
                            {item.error}
                          </p>
                        )}
                        {item.result && (
                          <div className="mt-3 space-y-2">
                            <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 sm:flex-row sm:items-center sm:justify-between">
                              <p>
                                <strong>{item.result.examCode}</strong>
                                {` · ${item.result.questionCount} câu`}
                              </p>
                              <Link
                                to="/admin/exams/$examId/review"
                                params={{ examId: item.result.examId }}
                                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 font-bold text-white transition-colors hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-emerald-600/25"
                              >
                                Duyệt ngay
                                <ArrowRight size={17} aria-hidden="true" />
                              </Link>
                            </div>
                            {item.result.ocrQueueWarning && (
                              <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900">
                                {item.result.ocrQueueWarning}
                              </p>
                            )}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <div className="sticky bottom-0 flex flex-col gap-3 border-t border-border bg-white/95 px-5 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p
                className={cn(
                  "text-sm",
                  incompleteCount ? "text-amber-700" : "text-slate-500",
                )}
              >
                {incompleteCount
                  ? `${incompleteCount} ZIP chưa đủ thông tin.`
                  : readyItems.length
                    ? `${readyItems.length} đề sẵn sàng nhập.`
                    : failedItems.length
                      ? `${failedItems.length} đề cần thử lại.`
                      : "Thêm ZIP để bắt đầu."}
              </p>
              <Button
                type="submit"
                disabled={
                  readyItems.length === 0 ||
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
                  ? "Đang nhập..."
                  : readyItems.length
                    ? `Nhập ${readyItems.length} đề`
                    : "Điền đủ thông tin"}
              </Button>
            </div>
          </Card>

          <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
            <Card className="p-5">
              <h2 className="font-heading font-bold">ZIP hợp lệ</h2>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                <li>• Chứa ảnh câu hỏi; tên ảnh không cần theo mẫu.</li>
                <li>• Có thể kèm answers.json.</li>
                <li>• Không trùng tên file trong cùng ZIP.</li>
              </ul>
              <details className="mt-4 border-t border-border pt-4 text-sm text-slate-600">
                <summary className="min-h-11 cursor-pointer font-bold text-slate-700">
                  Cách hệ thống xử lý
                </summary>
                <p className="mt-2 leading-6">
                  Mỗi ZIP tạo một đề nháp. Hệ thống nhập lần lượt và giữ các
                  file lỗi để bạn thử lại.
                </p>
              </details>
            </Card>
            {catalog?.courses.length === 0 && (
              <Card className="border-amber-200 bg-amber-50 p-5">
                <p className="text-sm font-bold text-amber-900">
                  Chưa có môn học
                </p>
                <p className="mt-1 text-sm text-amber-800">
                  Tạo môn trong Danh mục trước khi nhập đề.
                </p>
              </Card>
            )}
          </aside>
        </div>
      </form>
    </div>
  );
}

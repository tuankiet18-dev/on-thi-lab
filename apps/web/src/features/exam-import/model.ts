import type {
  CreateDraftImportInput,
  DraftImportResult,
} from "@onthilab/contracts";
import { ApiError } from "../../api/http";

export type ImportStatus = "pending" | "uploading" | "success" | "error";

export interface ImportQueueItem {
  id: string;
  archive: File;
  metadata: CreateDraftImportInput;
  status: ImportStatus;
  result?: DraftImportResult;
  error?: string;
}

export const fallbackCampuses = [
  { code: "HL", name: "Hòa Lạc" },
  { code: "HCM", name: "Hồ Chí Minh" },
  { code: "DN", name: "Đà Nẵng" },
  { code: "CT", name: "Cần Thơ" },
  { code: "QN", name: "Quy Nhơn" },
];

export function emptyImportMetadata(): CreateDraftImportInput {
  return {
    courseCode: "",
    semester: "",
    campusCode: "",
    examType: "FE",
    isRetake: false,
    durationMinutes: 0,
    extractText: false,
  };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function importErrorMessage(reason: unknown): string {
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

export function queueStatusLabel(status: ImportStatus): string {
  return {
    pending: "Chờ nhập",
    uploading: "Đang nhập",
    success: "Đã tạo nháp",
    error: "Cần thử lại",
  }[status];
}

export function isImportMetadataComplete(
  metadata: CreateDraftImportInput,
): boolean {
  return (
    metadata.courseCode.length > 0 &&
    metadata.semester.trim().length > 0 &&
    metadata.campusCode.length > 0 &&
    metadata.durationMinutes >= 15 &&
    metadata.durationMinutes <= 240
  );
}

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

export function emptyImportMetadata(
  defaultCampusCode = "HCM",
  defaultDuration = 60,
): CreateDraftImportInput {
  return {
    courseCode: "",
    semester: "",
    campusCode: defaultCampusCode,
    examType: "FE",
    isRetake: false,
    durationMinutes: defaultDuration,
    extractText: false,
  };
}

export function inferImportMetadataFromFileName(
  fileName: string,
  availableCourses?: readonly { code: string }[],
  availableCampuses?: readonly { code: string }[],
): CreateDraftImportInput {
  const baseName = fileName.replace(/\.zip$/i, "").replace(/_cropped$/i, "");
  const tokens = baseName.split(/[-_.\s]+/);

  let courseCode = "";
  let semester = "";
  let campusCode = "HCM";
  let examType: "FE" | "PE" = "FE";
  let isRetake = false;
  const durationMinutes = 60;
  const extractText = false;

  // 1. Campus detection & default
  if (availableCampuses && availableCampuses.length > 0) {
    const matchedCampus = availableCampuses.find(
      (c) =>
        tokens.some((t) => t.toUpperCase() === c.code.toUpperCase()) ||
        baseName.toUpperCase().includes(`_${c.code.toUpperCase()}_`) ||
        baseName.toUpperCase().includes(`-${c.code.toUpperCase()}-`),
    );
    if (matchedCampus) {
      campusCode = matchedCampus.code;
    } else {
      const hasHcm = availableCampuses.find(
        (c) => c.code.toUpperCase() === "HCM",
      );
      campusCode = hasHcm ? hasHcm.code : (availableCampuses[0]?.code ?? "HCM");
    }
  }

  // 2. Course detection
  if (availableCourses && availableCourses.length > 0) {
    // Exact token match first
    const matchedTokenCourse = availableCourses.find((c) =>
      tokens.some((t) => t.toUpperCase() === c.code.toUpperCase()),
    );
    if (matchedTokenCourse) {
      courseCode = matchedTokenCourse.code;
    } else {
      // Substring match
      const matchedSubstringCourse = availableCourses.find((c) =>
        baseName.toUpperCase().includes(c.code.toUpperCase()),
      );
      if (matchedSubstringCourse) {
        courseCode = matchedSubstringCourse.code;
      }
    }
  }

  // Fallback regex detection for course code (e.g. SWE201c, FER202, PRO192)
  if (!courseCode) {
    for (const token of tokens) {
      const match = token.match(/^[a-zA-Z]{2,5}\d{2,4}[a-zA-Z]?$/);
      if (match) {
        courseCode = match[0].toUpperCase();
        break;
      }
    }
  }

  // 3. Semester detection (e.g. SP26, FA25, SU24)
  for (const token of tokens) {
    const match = token.match(/^(SP|SU|FA|SPRING|SUMMER|FALL)(\d{2,4})$/i);
    if (match?.[1] && match?.[2]) {
      const semPrefix = match[1].slice(0, 2).toUpperCase();
      const semYear = match[2].slice(-2);
      semester = `${semPrefix}${semYear}`;
      break;
    }
  }
  if (!semester) {
    const semMatch = baseName.match(/(?:^|[-_])(SP|SU|FA)(\d{2})(?:[-_]|$)/i);
    if (semMatch?.[1] && semMatch?.[2]) {
      semester = `${semMatch[1].toUpperCase()}${semMatch[2]}`;
    }
  }

  // 4. Retake detection (e.g. -re, _re, retake, thilai)
  const lowerName = baseName.toLowerCase();
  if (
    tokens.some((t) => ["re", "retake", "thilai"].includes(t.toLowerCase())) ||
    lowerName.includes("-re") ||
    lowerName.includes("_re")
  ) {
    isRetake = true;
  }

  return {
    courseCode,
    semester,
    campusCode,
    examType: "FE",
    isRetake,
    durationMinutes,
    extractText,
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

import { stat } from "node:fs/promises";
import { extname, posix } from "node:path";
import yauzl, { type Entry, type ZipFile } from "yauzl";

export const defaultZipValidationLimits = {
  minQuestionCount: 1,
  maxQuestionCount: 120,
  maxArchiveBytes: 250 * 1024 * 1024,
  maxImageBytes: 20 * 1024 * 1024,
  maxAnswersBytes: 1024 * 1024,
  maxTotalUncompressedBytes: 500 * 1024 * 1024,
  maxCompressionRatio: 100,
  allowedExtensions: [".jpg", ".jpeg", ".png", ".webp"],
} as const;

export interface ZipValidationLimits {
  minQuestionCount: number;
  maxQuestionCount: number;
  maxArchiveBytes: number;
  maxImageBytes: number;
  maxAnswersBytes: number;
  maxTotalUncompressedBytes: number;
  maxCompressionRatio: number;
  allowedExtensions: readonly string[];
}

export interface ZipEntryMetadata {
  fileName: string;
  compressedSize: number;
  uncompressedSize: number;
}

export interface ValidatedQuestionImage extends ZipEntryMetadata {
  order: number;
  extension: string;
}

export interface ZipValidationResult {
  archiveBytes: number;
  totalUncompressedBytes: number;
  images: ValidatedQuestionImage[];
  answersJson?: ZipEntryMetadata;
}

export class ZipValidationError extends Error {
  constructor(
    readonly code:
      | "ARCHIVE_TOO_LARGE"
      | "CORRUPT_ARCHIVE"
      | "DUPLICATE_QUESTION"
      | "DUPLICATE_ANSWERS_FILE"
      | "ANSWERS_TOO_LARGE"
      | "IMAGE_TOO_LARGE"
      | "INVALID_ENTRY_PATH"
      | "INVALID_FILE_TYPE"
      | "INVALID_QUESTION_COUNT"
      | "INVALID_QUESTION_NAME"
      | "MISSING_QUESTION"
      | "SUSPICIOUS_COMPRESSION"
      | "UNCOMPRESSED_SIZE_TOO_LARGE",
    message: string,
  ) {
    super(message);
    this.name = "ZipValidationError";
  }
}

function isDirectory(entry: ZipEntryMetadata): boolean {
  return entry.fileName.endsWith("/");
}

function assertSafePath(fileName: string): void {
  const normalized = posix.normalize(fileName.replaceAll("\\", "/"));
  if (
    fileName.includes("\0") ||
    fileName.startsWith("/") ||
    /^[a-zA-Z]:[\\/]/.test(fileName) ||
    normalized === ".." ||
    normalized.startsWith("../")
  ) {
    throw new ZipValidationError(
      "INVALID_ENTRY_PATH",
      `Đường dẫn không an toàn trong ZIP: ${fileName}`,
    );
  }
}

function questionOrder(fileName: string): number | null {
  const baseName = posix.basename(fileName, extname(fileName));
  const match = baseName.match(/^(?:q(?:uestion)?[-_ ]*)?0*(\d+)$/i);
  if (!match?.[1]) return null;

  const parsed = Number.parseInt(match[1], 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function validateZipManifest(
  entries: readonly ZipEntryMetadata[],
  archiveBytes: number,
  overrides: Partial<ZipValidationLimits> = {},
): ZipValidationResult {
  const limits: ZipValidationLimits = {
    ...defaultZipValidationLimits,
    ...overrides,
  };

  if (archiveBytes > limits.maxArchiveBytes) {
    throw new ZipValidationError(
      "ARCHIVE_TOO_LARGE",
      `ZIP vượt quá ${limits.maxArchiveBytes} byte.`,
    );
  }

  const images: ValidatedQuestionImage[] = [];
  const seenOrders = new Set<number>();
  let totalUncompressedBytes = 0;
  let answersJson: ZipEntryMetadata | undefined;

  for (const entry of entries) {
    assertSafePath(entry.fileName);
    if (isDirectory(entry)) continue;
    const isAnswersJson =
      posix.basename(entry.fileName).toLowerCase() === "answers.json";

    const compressionRatio =
      entry.compressedSize === 0
        ? entry.uncompressedSize === 0
          ? 1
          : Number.POSITIVE_INFINITY
        : entry.uncompressedSize / entry.compressedSize;
    if (compressionRatio > limits.maxCompressionRatio) {
      throw new ZipValidationError(
        "SUSPICIOUS_COMPRESSION",
        `${entry.fileName} có tỷ lệ nén bất thường.`,
      );
    }

    totalUncompressedBytes += entry.uncompressedSize;
    if (totalUncompressedBytes > limits.maxTotalUncompressedBytes) {
      throw new ZipValidationError(
        "UNCOMPRESSED_SIZE_TOO_LARGE",
        `Tổng dữ liệu giải nén vượt quá ${limits.maxTotalUncompressedBytes} byte.`,
      );
    }

    if (isAnswersJson) {
      if (answersJson) {
        throw new ZipValidationError(
          "DUPLICATE_ANSWERS_FILE",
          "ZIP chỉ được chứa một file answers.json.",
        );
      }
      if (entry.uncompressedSize > limits.maxAnswersBytes) {
        throw new ZipValidationError(
          "ANSWERS_TOO_LARGE",
          `answers.json vượt quá ${limits.maxAnswersBytes} byte.`,
        );
      }
      answersJson = entry;
      continue;
    }

    const extension = extname(entry.fileName).toLowerCase();
    if (!limits.allowedExtensions.includes(extension)) {
      throw new ZipValidationError(
        "INVALID_FILE_TYPE",
        `ZIP chỉ được chứa ảnh câu hỏi: ${entry.fileName}`,
      );
    }

    const order = questionOrder(entry.fileName);
    if (order === null || order < 1 || order > limits.maxQuestionCount) {
      throw new ZipValidationError(
        "INVALID_QUESTION_NAME",
        `Không xác định được số câu từ tên file: ${entry.fileName}`,
      );
    }

    if (seenOrders.has(order)) {
      throw new ZipValidationError(
        "DUPLICATE_QUESTION",
        `Câu ${order} xuất hiện nhiều lần trong ZIP.`,
      );
    }
    seenOrders.add(order);

    if (entry.uncompressedSize > limits.maxImageBytes) {
      throw new ZipValidationError(
        "IMAGE_TOO_LARGE",
        `${entry.fileName} vượt quá ${limits.maxImageBytes} byte.`,
      );
    }

    images.push({
      ...entry,
      order,
      extension,
    });
  }

  if (
    images.length < limits.minQuestionCount ||
    images.length > limits.maxQuestionCount
  ) {
    throw new ZipValidationError(
      "INVALID_QUESTION_COUNT",
      `Số ảnh câu hỏi phải từ ${limits.minQuestionCount} đến ${limits.maxQuestionCount}, nhận được ${images.length}.`,
    );
  }

  const highestOrder = Math.max(...seenOrders);
  if (highestOrder !== images.length) {
    throw new ZipValidationError(
      "MISSING_QUESTION",
      "Tên ảnh phải đánh số liên tiếp từ Q1 đến câu cuối cùng.",
    );
  }

  for (let order = 1; order <= highestOrder; order += 1) {
    if (!seenOrders.has(order)) {
      throw new ZipValidationError(
        "MISSING_QUESTION",
        `Thiếu ảnh của câu ${order}.`,
      );
    }
  }

  return {
    archiveBytes,
    totalUncompressedBytes,
    images: images.sort((left, right) => left.order - right.order),
    ...(answersJson ? { answersJson } : {}),
  };
}

function openZip(archivePath: string): Promise<ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.open(
      archivePath,
      { lazyEntries: true, validateEntrySizes: true },
      (error, zipFile) => {
        if (error || !zipFile) {
          reject(
            new ZipValidationError(
              "CORRUPT_ARCHIVE",
              error?.message ?? "Không thể mở ZIP.",
            ),
          );
          return;
        }
        resolve(zipFile);
      },
    );
  });
}

export async function validateZipArchive(
  archivePath: string,
  overrides: Partial<ZipValidationLimits> = {},
): Promise<ZipValidationResult> {
  const archiveStat = await stat(archivePath);
  const limits = { ...defaultZipValidationLimits, ...overrides };
  if (archiveStat.size > limits.maxArchiveBytes) {
    throw new ZipValidationError(
      "ARCHIVE_TOO_LARGE",
      `ZIP vượt quá ${limits.maxArchiveBytes} byte.`,
    );
  }

  const zipFile = await openZip(archivePath);
  const entries = await new Promise<ZipEntryMetadata[]>((resolve, reject) => {
    const collected: ZipEntryMetadata[] = [];
    let settled = false;

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      zipFile.close();
      reject(
        error instanceof ZipValidationError
          ? error
          : new ZipValidationError("CORRUPT_ARCHIVE", error.message),
      );
    };

    zipFile.on("error", fail);
    zipFile.on("entry", (entry: Entry) => {
      try {
        collected.push({
          fileName: entry.fileName,
          compressedSize: entry.compressedSize,
          uncompressedSize: entry.uncompressedSize,
        });
        zipFile.readEntry();
      } catch (error) {
        fail(error instanceof Error ? error : new Error("ZIP không hợp lệ."));
      }
    });
    zipFile.on("end", () => {
      if (settled) return;
      settled = true;
      resolve(collected);
    });
    zipFile.readEntry();
  });

  try {
    return validateZipManifest(entries, archiveStat.size, limits);
  } finally {
    zipFile.close();
  }
}

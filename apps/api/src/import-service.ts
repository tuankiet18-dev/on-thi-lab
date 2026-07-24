import type {
  CreateDraftImportInput,
  DraftImportResult,
  StudentProfile,
} from "@onthilab/contracts";
import type { DraftImportRepository } from "@onthilab/database";
import {
  defaultZipValidationLimits,
  extractValidatedQuestionImages,
  ZipValidationError,
} from "@onthilab/importer";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, posix } from "node:path";

export interface UploadedArchive {
  name: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface CreateDraftFromArchiveInput {
  metadata: CreateDraftImportInput;
  archive: UploadedArchive;
  creator: StudentProfile;
}

export interface ExamImportService {
  createDraft(input: CreateDraftFromArchiveInput): Promise<DraftImportResult>;
}

export type ExamImportErrorCode =
  "ARCHIVE_TOO_LARGE" | "IMPORT_NOT_CONFIGURED" | "INVALID_ARCHIVE";

export class ExamImportError extends Error {
  constructor(
    readonly code: ExamImportErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ExamImportError";
  }
}

export class UnconfiguredExamImportService implements ExamImportService {
  async createDraft(): Promise<DraftImportResult> {
    throw new ExamImportError(
      "IMPORT_NOT_CONFIGURED",
      "Dịch vụ nhập đề chưa được cấu hình.",
    );
  }
}

export class LocalExamImportService implements ExamImportService {
  constructor(
    private readonly repository: DraftImportRepository,
    private readonly imageStorageRoot: string,
  ) {}

  async createDraft(
    input: CreateDraftFromArchiveInput,
  ): Promise<DraftImportResult> {
    if (
      !input.archive.name.toLowerCase().endsWith(".zip") ||
      input.archive.size <= 0
    ) {
      throw new ExamImportError(
        "INVALID_ARCHIVE",
        "Vui lòng chọn một file ZIP hợp lệ.",
      );
    }
    if (input.archive.size > defaultZipValidationLimits.maxArchiveBytes) {
      throw new ExamImportError(
        "ARCHIVE_TOO_LARGE",
        "File ZIP vượt quá giới hạn cho phép.",
      );
    }

    const temporaryDirectory = await mkdtemp(
      join(tmpdir(), "onthilab-import-"),
    );
    const archivePath = join(temporaryDirectory, "questions.zip");
    const assetId = randomUUID();
    const storagePrefix = posix.join("drafts", assetId);
    const storageParent = join(this.imageStorageRoot, "drafts");
    const storageDirectory = join(storageParent, assetId);
    let imagesExtracted = false;

    try {
      await writeFile(
        archivePath,
        Buffer.from(await input.archive.arrayBuffer()),
      );
      await mkdir(storageParent, { recursive: true });
      const images = await extractValidatedQuestionImages(
        archivePath,
        storageDirectory,
      );
      imagesExtracted = true;

      const result = await this.repository.createDraft({
        ...input.metadata,
        createdBy: input.creator.id,
        questions: images.map((image) => ({
          order: image.order,
          imageKey: posix.join(storagePrefix, image.fileName),
          imageHash: image.sha256,
          optionCount: 4,
        })),
      });
      return result;
    } catch (error) {
      if (imagesExtracted) {
        await rm(storageDirectory, { recursive: true, force: true });
      }
      if (error instanceof ZipValidationError) {
        throw new ExamImportError("INVALID_ARCHIVE", error.message);
      }
      throw error;
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  }
}

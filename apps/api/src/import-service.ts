import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "node:stream";
import { readFile } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import { computeAnswer } from "@onthilab/importer";

export class S3ExamImportService implements ExamImportService {
  constructor(
    private readonly repository: DraftImportRepository,
    private readonly s3Client: S3Client,
    private readonly bucket: string,
  ) {}

  async createPresignedUploadUrl(): Promise<{
    uploadUrl: string;
    key: string;
  }> {
    const assetId = randomUUID();
    const key = `drafts/${assetId}/questions.zip`;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: "application/zip",
    });
    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: 3600,
    });
    return { uploadUrl, key };
  }

  async createDraft(
    input: CreateDraftFromArchiveInput,
  ): Promise<DraftImportResult> {
    if (!input.archiveKey) {
      throw new ExamImportError(
        "INVALID_ARCHIVE",
        "Yêu cầu upload file qua presigned URL trước.",
      );
    }
    const assetId = randomUUID();
    const storagePrefix = posix.join("drafts", assetId);

    const temporaryDirectory = await mkdtemp(
      join(tmpdir(), "onthilab-import-"),
    );
    const archivePath = join(temporaryDirectory, "questions.zip");
    const extractedDirectory = join(temporaryDirectory, "extracted");

    let imagesExtracted = false;

    try {
      // 1. Download ZIP from S3
      const getObject = new GetObjectCommand({
        Bucket: this.bucket,
        Key: input.archiveKey,
      });
      const { Body } = await this.s3Client.send(getObject);
      if (Body instanceof Readable) {
        await pipeline(Body, createWriteStream(archivePath));
      } else {
        throw new Error("Unable to read S3 object body as stream");
      }

      await mkdir(extractedDirectory, { recursive: true });

      // 2. Extract images locally
      const images = await extractValidatedQuestionImages(
        archivePath,
        extractedDirectory,
      );
      imagesExtracted = true;

      // 3. Upload extracted images to S3
      await Promise.all(
        images.map(async (image) => {
          const imageFilePath = join(extractedDirectory, image.fileName);
          const fileData = await readFile(imageFilePath);
          await this.s3Client.send(
            new PutObjectCommand({
              Bucket: this.bucket,
              Key: posix.join(storagePrefix, image.fileName),
              Body: fileData,
              ContentType: image.fileName.endsWith(".png")
                ? "image/png"
                : "image/jpeg",
            }),
          );
        }),
      );

      // 4. Read answers.json if extracted
      let answersJson: any = undefined;
      try {
        const answersContent = await readFile(
          join(extractedDirectory, "answers.json"),
          "utf8",
        );
        answersJson = JSON.parse(answersContent);
      } catch (err) {
        // Ignore if file does not exist or invalid JSON
      }

      // 5. Save to DB
      const result = await this.repository.createDraft({
        ...input.metadata,
        createdBy: input.creator.id,
        questions: images.map((image) => {
          let aiMetadata: any = undefined;
          let correctOptions: number[] | undefined = undefined;

          if (answersJson) {
            const ext = extname(image.fileName);
            const votes =
              answersJson[`Q${image.order}${ext}`] ||
              answersJson[`${image.order}${ext}`] ||
              answersJson[`Q${image.order}.jpg`] ||
              answersJson[`${image.order}.jpg`];

            if (Array.isArray(votes) && votes.length > 0) {
              // Using computeAnswer
              const computed = computeAnswer(image.order, votes);

              if (!computed.disputed) {
                const letterToIndex: Record<string, number> = {
                  a: 0,
                  b: 1,
                  c: 2,
                  d: 3,
                  e: 4,
                  f: 5,
                };
                correctOptions = [letterToIndex[computed.answer] ?? 0];
              }

              aiMetadata = {
                status: "suggested",
                provider: "fuoverflow",
                confidence: computed.confidence,
                proposedType: "single",
                optionCount: 4,
                proposedAnswers: computed.disputed ? undefined : correctOptions,
                updatedAt: new Date().toISOString(),
                raw: {
                  disputed: computed.disputed,
                  disputeReason: computed.disputeReason,
                  votes: computed.totalVotes,
                  voteBreakdown: computed.voteBreakdown,
                },
              };
            }
          }

          return {
            order: image.order,
            imageKey: posix.join(storagePrefix, image.fileName),
            imageHash: image.sha256,
            optionCount: 4,
            correctOptions,
            aiMetadata,
          };
        }),
      });

      return {
        ...result,
        answersJson,
      };
    } catch (error) {
      if (error instanceof ZipValidationError) {
        throw new ExamImportError("INVALID_ARCHIVE", error.message);
      }
      throw error;
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  }
}
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
import { extname, join, posix } from "node:path";

export interface UploadedArchive {
  name: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface CreateDraftFromArchiveInput {
  archiveKey?: string;
  metadata: CreateDraftImportInput;
  archive?: UploadedArchive;
  creator: StudentProfile;
}

export interface ExamImportService {
  createPresignedUploadUrl?(): Promise<{ uploadUrl: string; key: string }>;
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
    if (!input.archive) {
      throw new ExamImportError("INVALID_ARCHIVE", "Yêu cầu upload file.");
    }
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

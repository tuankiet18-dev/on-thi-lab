import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type {
  CreateDraftImportInput,
  DraftImportResult,
  StudentProfile,
} from "@onthilab/contracts";
import type {
  DraftImportRepository,
  DraftQuestionInput,
} from "@onthilab/database";
import {
  computeAllAnswers,
  defaultZipValidationLimits,
  extractValidatedQuestionImages,
  ZipValidationError,
  type ExtractedQuestionImage,
  type RawVote,
} from "@onthilab/importer";
import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, posix } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

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

type CommunityAnswers = Record<string, RawVote[]>;

function parseCommunityAnswers(content: string): CommunityAnswers {
  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch {
    throw new ExamImportError(
      "INVALID_ARCHIVE",
      "answers.json không phải JSON hợp lệ.",
    );
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ExamImportError(
      "INVALID_ARCHIVE",
      "answers.json phải là một đối tượng.",
    );
  }

  const result: CommunityAnswers = {};
  for (const [fileName, votes] of Object.entries(value)) {
    if (fileName.length > 160 || !Array.isArray(votes) || votes.length > 100) {
      throw new ExamImportError(
        "INVALID_ARCHIVE",
        "answers.json có dữ liệu không hợp lệ.",
      );
    }
    result[fileName] = votes.flatMap((vote) => {
      if (!vote || typeof vote !== "object" || !("content" in vote)) return [];
      const content = (vote as { content?: unknown }).content;
      const author = (vote as { author?: unknown }).author;
      if (typeof content !== "string" || content.length > 4_000) return [];
      return [
        {
          content,
          ...(typeof author === "string"
            ? { author: author.slice(0, 200) }
            : {}),
        },
      ];
    });
  }
  return result;
}

async function readOptionalCommunityAnswers(
  extractedDirectory: string,
): Promise<CommunityAnswers | undefined> {
  try {
    return parseCommunityAnswers(
      await readFile(join(extractedDirectory, "answers.json"), "utf8"),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

function draftQuestionsFromImages(
  images: readonly ExtractedQuestionImage[],
  storagePrefix: string,
  answers?: CommunityAnswers,
): DraftQuestionInput[] {
  const suggestions = new Map(
    answers
      ? computeAllAnswers(answers).map((answer) => [
          answer.questionNumber,
          answer,
        ])
      : [],
  );
  const updatedAt = new Date().toISOString();

  return images.map((image) => {
    const suggestion = suggestions.get(image.order);
    const aiMetadata = suggestion
      ? suggestion.validVotes > 0
        ? {
            status: "suggested" as const,
            provider: "community-comments",
            model: "exact-consensus-v1",
            confidence: suggestion.confidence,
            proposedType: suggestion.proposedType,
            optionCount: suggestion.optionCount,
            proposedAnswers: suggestion.answers.map((answer) =>
              "abcdef".indexOf(answer),
            ),
            validVotes: suggestion.validVotes,
            totalComments: suggestion.totalComments,
            voteBreakdown: suggestion.voteBreakdown,
            requiresReview: suggestion.disputed,
            disputeReason: suggestion.disputeReason,
            updatedAt,
          }
        : {
            status: "failed" as const,
            provider: "community-comments",
            error: suggestion.disputeReason,
            totalComments: suggestion.totalComments,
            updatedAt,
          }
      : undefined;

    return {
      order: image.order,
      imageKey: posix.join(storagePrefix, image.fileName),
      imageHash: image.sha256,
      optionCount: suggestion?.optionCount ?? 4,
      aiMetadata,
    };
  });
}

function contentTypeFor(fileName: string): string {
  const extension = extname(fileName).toLowerCase();
  return extension === ".png"
    ? "image/png"
    : extension === ".webp"
      ? "image/webp"
      : "image/jpeg";
}

function isExpectedArchiveKey(key: string): boolean {
  return /^uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/questions\.zip$/i.test(
    key,
  );
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
    const storageDirectory = join(this.imageStorageRoot, "drafts", assetId);
    let imagesExtracted = false;

    try {
      await writeFile(
        archivePath,
        Buffer.from(await input.archive.arrayBuffer()),
      );
      await mkdir(join(this.imageStorageRoot, "drafts"), { recursive: true });
      const images = await extractValidatedQuestionImages(
        archivePath,
        storageDirectory,
      );
      imagesExtracted = true;
      const answers = await readOptionalCommunityAnswers(storageDirectory);
      return await this.repository.createDraft({
        ...input.metadata,
        createdBy: input.creator.id,
        questions: draftQuestionsFromImages(images, storagePrefix, answers),
      });
    } catch (error) {
      if (imagesExtracted)
        await rm(storageDirectory, { recursive: true, force: true });
      if (error instanceof ZipValidationError) {
        throw new ExamImportError("INVALID_ARCHIVE", error.message);
      }
      throw error;
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  }
}

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
    const key = `uploads/${randomUUID()}/questions.zip`;
    const uploadUrl = await getSignedUrl(
      this.s3Client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: "application/zip",
      }),
      { expiresIn: 600 },
    );
    return { uploadUrl, key };
  }

  async createDraft(
    input: CreateDraftFromArchiveInput,
  ): Promise<DraftImportResult> {
    if (!input.archiveKey || !isExpectedArchiveKey(input.archiveKey)) {
      throw new ExamImportError(
        "INVALID_ARCHIVE",
        "Khóa upload ZIP không hợp lệ.",
      );
    }

    const temporaryDirectory = await mkdtemp(
      join(tmpdir(), "onthilab-import-"),
    );
    const archivePath = join(temporaryDirectory, "questions.zip");
    const extractedDirectory = join(temporaryDirectory, "extracted");
    const assetId = randomUUID();
    const storagePrefix = posix.join("drafts", assetId);
    const uploadedImageKeys: string[] = [];

    try {
      const { Body } = await this.s3Client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: input.archiveKey }),
      );
      if (!(Body instanceof Readable)) {
        throw new ExamImportError(
          "INVALID_ARCHIVE",
          "Không thể đọc file ZIP từ kho lưu trữ.",
        );
      }
      await pipeline(Body, createWriteStream(archivePath));

      const images = await extractValidatedQuestionImages(
        archivePath,
        extractedDirectory,
      );
      const answers = await readOptionalCommunityAnswers(extractedDirectory);
      for (const image of images) {
        const key = posix.join(storagePrefix, image.fileName);
        await this.s3Client.send(
          new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: await readFile(join(extractedDirectory, image.fileName)),
            ContentType: contentTypeFor(image.fileName),
          }),
        );
        uploadedImageKeys.push(key);
      }

      return await this.repository.createDraft({
        ...input.metadata,
        createdBy: input.creator.id,
        questions: draftQuestionsFromImages(images, storagePrefix, answers),
      });
    } catch (error) {
      await Promise.all(
        uploadedImageKeys.map((Key) =>
          this.s3Client
            .send(new DeleteObjectCommand({ Bucket: this.bucket, Key }))
            .catch(() => undefined),
        ),
      );
      if (error instanceof ZipValidationError) {
        throw new ExamImportError("INVALID_ARCHIVE", error.message);
      }
      throw error;
    } finally {
      await this.s3Client
        .send(
          new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: input.archiveKey,
          }),
        )
        .catch(() => undefined);
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  }
}

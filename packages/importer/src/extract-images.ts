import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { extname, join, posix } from "node:path";
import { pipeline } from "node:stream/promises";
import yauzl, { type Entry, type ZipFile } from "yauzl";
import {
  validateZipArchive,
  ZipValidationError,
  type ZipValidationLimits,
} from "./zip-validator.js";

export interface ExtractedQuestionImage {
  order: number;
  originalFileName: string;
  fileName: string;
  bytes: number;
  sha256: string;
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

function openEntryStream(
  zipFile: ZipFile,
  entry: Entry,
): Promise<NodeJS.ReadableStream> {
  return new Promise((resolve, reject) => {
    zipFile.openReadStream(entry, (error, stream) => {
      if (error || !stream) {
        reject(error ?? new Error(`Không thể đọc ${entry.fileName}.`));
        return;
      }
      resolve(stream);
    });
  });
}

export async function extractValidatedQuestionImages(
  archivePath: string,
  outputDirectory: string,
  limits: Partial<ZipValidationLimits> = {},
): Promise<ExtractedQuestionImage[]> {
  const validation = await validateZipArchive(archivePath, limits);
  const expectedByName = new Map(
    validation.images.map((image) => [image.fileName, image]),
  );
  const answersJsonName = validation.answersJson?.fileName;

  await mkdir(outputDirectory, { recursive: false });
  let completed = false;

  try {
    const zipFile = await openZip(archivePath);
    const extracted = await new Promise<ExtractedQuestionImage[]>(
      (resolve, reject) => {
        const results: ExtractedQuestionImage[] = [];
        let settled = false;

        const fail = (error: Error) => {
          if (settled) return;
          settled = true;
          zipFile.close();
          reject(error);
        };

        zipFile.on("error", fail);
        zipFile.on("entry", (entry: Entry) => {
          if (answersJsonName && entry.fileName === answersJsonName) {
            void (async () => {
              const destination = join(outputDirectory, "answers.json");
              const source = await openEntryStream(zipFile, entry);
              await pipeline(
                source,
                createWriteStream(destination, { flags: "wx" }),
              );
              zipFile.readEntry();
            })().catch((error: unknown) =>
              fail(
                error instanceof Error
                  ? error
                  : new Error("Không thể giải nén answers.json."),
              ),
            );
            return;
          }

          const expected = expectedByName.get(entry.fileName);
          if (!expected) {
            zipFile.readEntry();
            return;
          }

          void (async () => {
            const extension = extname(entry.fileName).toLowerCase();
            const fileName = `Q${expected.order}${extension}`;
            const destination = join(outputDirectory, fileName);
            const source = await openEntryStream(zipFile, entry);
            const hash = createHash("sha256");
            source.on("data", (chunk: Buffer) => hash.update(chunk));
            await pipeline(
              source,
              createWriteStream(destination, { flags: "wx" }),
            );
            results.push({
              order: expected.order,
              originalFileName: entry.fileName,
              fileName,
              bytes: expected.uncompressedSize,
              sha256: hash.digest("hex"),
            });
            zipFile.readEntry();
          })().catch((error: unknown) =>
            fail(
              error instanceof Error
                ? error
                : new Error("Không thể giải nén ảnh câu hỏi."),
            ),
          );
        });
        zipFile.on("end", () => {
          if (settled) return;
          settled = true;
          resolve(results.sort((left, right) => left.order - right.order));
        });
        zipFile.readEntry();
      },
    );

    if (extracted.length !== validation.images.length) {
      throw new ZipValidationError(
        "CORRUPT_ARCHIVE",
        "Số ảnh giải nén không khớp manifest đã kiểm tra.",
      );
    }

    completed = true;
    return extracted;
  } finally {
    if (!completed) {
      await rm(outputDirectory, { recursive: true, force: true });
    }
  }
}

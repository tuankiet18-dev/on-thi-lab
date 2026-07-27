import { describe, expect, it } from "vitest";
import {
  validateZipManifest,
  ZipValidationError,
  type ZipEntryMetadata,
} from "./zip-validator";

const image = (
  fileName: string,
  uncompressedSize = 1_000,
): ZipEntryMetadata => ({
  fileName,
  compressedSize: 800,
  uncompressedSize,
});

describe("validateZipManifest", () => {
  it("accepts arbitrary filenames and assigns order from ZIP manifest order", () => {
    const result = validateZipManifest(
      [
        image("questions/"),
        image("questions/1775674360012.webp"),
        image("questions/image-from-crawler.jpg"),
        image("questions/third-question.PNG"),
      ],
      2_400,
      { minQuestionCount: 1, maxQuestionCount: 3 },
    );

    expect(result.images.map(({ order }) => order)).toEqual([1, 2, 3]);
    expect(result.images[1]?.extension).toBe(".jpg");

    for (const count of [50, 60]) {
      const variableResult = validateZipManifest(
        Array.from({ length: count }, (_, index) =>
          image(`crawler-${Date.now()}-${index}.jpg`),
        ),
        count * 800,
      );
      expect(variableResult.images).toHaveLength(count);
    }
  });

  it("rejects duplicate image paths", () => {
    expect(() =>
      validateZipManifest(
        [image("Q1.jpg"), image("Q1.jpg"), image("Q3.jpg")],
        2_400,
        { minQuestionCount: 1, maxQuestionCount: 3 },
      ),
    ).toThrowError(
      expect.objectContaining<Partial<ZipValidationError>>({
        code: "DUPLICATE_IMAGE_FILE",
      }),
    );
  });

  it("rejects traversal paths and non-image files", () => {
    expect(() =>
      validateZipManifest([image("../Q1.jpg")], 800, {
        minQuestionCount: 1,
        maxQuestionCount: 1,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<ZipValidationError>>({
        code: "INVALID_ENTRY_PATH",
      }),
    );

    expect(() =>
      validateZipManifest([image("Q1.exe")], 800, {
        minQuestionCount: 1,
        maxQuestionCount: 1,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<ZipValidationError>>({
        code: "INVALID_FILE_TYPE",
      }),
    );
  });

  it("rejects oversized images and suspicious compression ratios", () => {
    expect(() =>
      validateZipManifest([image("Q1.jpg", 2_001)], 800, {
        minQuestionCount: 1,
        maxQuestionCount: 1,
        maxImageBytes: 2_000,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<ZipValidationError>>({
        code: "IMAGE_TOO_LARGE",
      }),
    );

    expect(() =>
      validateZipManifest([{ ...image("Q1.jpg"), compressedSize: 1 }], 800, {
        minQuestionCount: 1,
        maxQuestionCount: 1,
        maxCompressionRatio: 10,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<ZipValidationError>>({
        code: "SUSPICIOUS_COMPRESSION",
      }),
    );
  });

  it("limits and validates the optional answers.json entry", () => {
    const result = validateZipManifest(
      [image("Q1.jpg"), image("metadata/answers.json", 100)],
      900,
      { minQuestionCount: 1, maxQuestionCount: 1 },
    );
    expect(result.answersJson?.fileName).toBe("metadata/answers.json");
    expect(result.totalUncompressedBytes).toBe(1_100);

    expect(() =>
      validateZipManifest(
        [image("Q1.jpg"), image("answers.json"), image("copy/answers.json")],
        900,
        { minQuestionCount: 1, maxQuestionCount: 1 },
      ),
    ).toThrowError(
      expect.objectContaining<Partial<ZipValidationError>>({
        code: "DUPLICATE_ANSWERS_FILE",
      }),
    );

    expect(() =>
      validateZipManifest([image("Q1.jpg"), image("answers.json", 101)], 900, {
        minQuestionCount: 1,
        maxQuestionCount: 1,
        maxAnswersBytes: 100,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<ZipValidationError>>({
        code: "ANSWERS_TOO_LARGE",
      }),
    );
  });
});

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
  it("accepts a containing directory and orders Q-prefixed images", () => {
    const result = validateZipManifest(
      [
        image("questions/"),
        image("questions/Q3.webp"),
        image("questions/Q1.jpg"),
        image("questions/Q2.PNG"),
      ],
      2_400,
      { expectedQuestionCount: 3 },
    );

    expect(result.images.map(({ order }) => order)).toEqual([1, 2, 3]);
    expect(result.images[1]?.extension).toBe(".png");
  });

  it("rejects missing or duplicate question numbers", () => {
    expect(() =>
      validateZipManifest(
        [image("Q1.jpg"), image("Q1.png"), image("Q3.jpg")],
        2_400,
        { expectedQuestionCount: 3 },
      ),
    ).toThrowError(
      expect.objectContaining<Partial<ZipValidationError>>({
        code: "DUPLICATE_QUESTION",
      }),
    );
  });

  it("rejects traversal paths and non-image files", () => {
    expect(() =>
      validateZipManifest([image("../Q1.jpg")], 800, {
        expectedQuestionCount: 1,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<ZipValidationError>>({
        code: "INVALID_ENTRY_PATH",
      }),
    );

    expect(() =>
      validateZipManifest([image("Q1.exe")], 800, {
        expectedQuestionCount: 1,
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
        expectedQuestionCount: 1,
        maxImageBytes: 2_000,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<ZipValidationError>>({
        code: "IMAGE_TOO_LARGE",
      }),
    );

    expect(() =>
      validateZipManifest([{ ...image("Q1.jpg"), compressedSize: 1 }], 800, {
        expectedQuestionCount: 1,
        maxCompressionRatio: 10,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<ZipValidationError>>({
        code: "SUSPICIOUS_COMPRESSION",
      }),
    );
  });
});

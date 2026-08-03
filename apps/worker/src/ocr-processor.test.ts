import type { PostgresOcrRepository } from "@onthilab/database";
import type { TextractClient } from "@aws-sdk/client-textract";
import { DetectDocumentTextCommand } from "@aws-sdk/client-textract";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import { processOcrJob } from "./ocr-processor.js";

const questionId = "10000000-0000-4000-8000-000000000001";
const revisionId = "20000000-0000-4000-8000-000000000002";

describe("processOcrJob", () => {
  it("stores parsed options from Textract and uses actual image metadata", async () => {
    const saveOcrResult = vi.fn(async () => undefined);
    const repository = {
      claimOcrJob: vi.fn(async () => true),
      isOcrJobActive: vi.fn(async () => true),
      findCachedOcrByHash: vi.fn(async () => null),
      saveOcrResult,
      markOcrFailed: vi.fn(async () => undefined),
    } as unknown as PostgresOcrRepository;
    const textract = {
      send: vi.fn(async () => ({
        Blocks: [
          {
            BlockType: "LINE",
            Text: "What is the capital of France?",
            Confidence: 99,
            Geometry: {
              BoundingBox: { Left: 0.05, Top: 0.1, Width: 0.6, Height: 0.03 },
            },
          },
          {
            BlockType: "LINE",
            Text: "A. Paris",
            Confidence: 99,
            Geometry: {
              BoundingBox: { Left: 0.1, Top: 0.2, Width: 0.3, Height: 0.03 },
            },
          },
          {
            BlockType: "LINE",
            Text: "B. London",
            Confidence: 99,
            Geometry: {
              BoundingBox: { Left: 0.1, Top: 0.25, Width: 0.3, Height: 0.03 },
            },
          },
        ],
      })),
    } as unknown as TextractClient;

    await processOcrJob(
      {
        questionId,
        revisionId,
        imageKey: "questions/example.png",
        imageHash: "image-hash",
        providerVersion: "textract@2024-02",
      },
      {
        repository,
        images: {
          read: async () => ({
            // Sharp reads this SVG and reports its true dimensions before
            // converting it to the JPEG accepted by Textract.
            bytes: new TextEncoder().encode(
              '<svg width="1200" height="700" xmlns="http://www.w3.org/2000/svg"><rect width="1200" height="700" fill="white"/></svg>',
            ),
            contentType: "image/svg+xml",
          }),
        },
        textract,
      },
    );

    expect(saveOcrResult).toHaveBeenCalledWith(
      questionId,
      expect.objectContaining({
        textContent: "What is the capital of France?",
        options: ["Paris", "London"],
        status: "approved",
      }),
    );
    const command = (textract.send as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as DetectDocumentTextCommand | undefined;
    const textractBytes = command?.input.Document?.Bytes;
    expect(textractBytes).toBeDefined();
    await expect(sharp(textractBytes).metadata()).resolves.toMatchObject({
      width: 2400,
      height: 1400,
    });
  });

  it("does not spend a Textract request for a stale job", async () => {
    const repository = {
      claimOcrJob: vi.fn(async () => false),
    } as unknown as PostgresOcrRepository;
    const textract = { send: vi.fn() } as unknown as TextractClient;

    await processOcrJob(
      {
        questionId,
        revisionId,
        imageKey: "questions/example.png",
        imageHash: "image-hash",
        providerVersion: "textract@2024-02",
      },
      {
        repository,
        images: { read: vi.fn() },
        textract,
      },
    );

    expect(textract.send).not.toHaveBeenCalled();
  });

  it("stops before Textract when an admin switches the revision back to images", async () => {
    const repository = {
      claimOcrJob: vi.fn(async () => true),
      findCachedOcrByHash: vi.fn(async () => null),
      isOcrJobActive: vi.fn(async () => false),
      markOcrFailed: vi.fn(async () => undefined),
    } as unknown as PostgresOcrRepository;
    const textract = { send: vi.fn() } as unknown as TextractClient;

    await processOcrJob(
      {
        questionId,
        revisionId,
        imageKey: "questions/example.png",
        imageHash: "image-hash",
        providerVersion: "textract@2024-02",
      },
      {
        repository,
        images: {
          read: async () => ({
            bytes: new TextEncoder().encode(
              '<svg width="1200" height="700" xmlns="http://www.w3.org/2000/svg"><rect width="1200" height="700" fill="white"/></svg>',
            ),
            contentType: "image/svg+xml",
          }),
        },
        textract,
      },
    );

    expect(textract.send).not.toHaveBeenCalled();
  });
});

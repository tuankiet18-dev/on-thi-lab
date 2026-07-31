import { z } from "zod";
import type { PostgresOcrRepository, OcrResult } from "@onthilab/database";
import { normalizeQuestionText } from "./ocr-text-normalizer.js";
import sharp from "sharp";
import { classifyQuestion } from "./ocr-classification.js";
import {
  TextractClient,
  DetectDocumentTextCommand,
} from "@aws-sdk/client-textract";

export const ocrJobSchema = z.object({
  questionId: z.string().uuid(),
  revisionId: z.string().uuid(),
  imageKey: z.string().min(1),
  imageHash: z.string().min(1),
  providerVersion: z.literal("textract@2024-01"),
});

export interface OcrImageReader {
  read(imageKey: string): Promise<{
    bytes: Uint8Array;
    contentType: string;
    width?: number;
    height?: number;
  } | null>;
}

export interface OcrProcessorDependencies {
  repository: PostgresOcrRepository;
  images: OcrImageReader;
  textract: TextractClient;
}

function computeAverageConfidence(blocks: any[]): number {
  if (blocks.length === 0) return 0;
  const lineBlocks = blocks.filter((b) => b.BlockType === "LINE");
  if (lineBlocks.length === 0) return 0;

  const sum = lineBlocks.reduce((acc, b) => acc + (b.Confidence || 0), 0);
  return sum / lineBlocks.length / 100; // Textract confidence is 0-100
}

function extractTextFromBlocks(blocks: any[]): string {
  const lineBlocks = blocks.filter((b) => b.BlockType === "LINE");
  return lineBlocks.map((b) => b.Text).join("\n");
}

export async function processOcrJob(
  payload: unknown,
  deps: OcrProcessorDependencies,
): Promise<void> {
  const job = ocrJobSchema.parse(payload);

  await deps.repository.markOcrProcessing(job.questionId);

  try {
    const cached = await deps.repository.findCachedOcrByHash(
      job.imageHash,
      job.providerVersion,
    );
    if (cached) {
      await deps.repository.saveOcrResult(job.questionId, cached);
      return;
    }

    const image = await deps.images.read(job.imageKey);
    if (!image) throw new Error("Không đọc được ảnh từ S3.");

    let imageBytes = image.bytes;
    if (image.contentType === "image/webp") {
      imageBytes = await sharp(image.bytes).jpeg().toBuffer();
    } else if (
      image.contentType === "image/png" ||
      image.contentType === "image/jpeg"
    ) {
      imageBytes = await sharp(image.bytes).jpeg().toBuffer();
    } else {
      // attempt conversion for any other type to jpeg just in case
      try {
        imageBytes = await sharp(image.bytes).jpeg().toBuffer();
      } catch (e) {
        console.warn(
          "Sharp could not convert image, falling back to original bytes",
          e,
        );
      }
    }

    const command = new DetectDocumentTextCommand({
      Document: { Bytes: imageBytes },
    });

    const textractResult = await deps.textract.send(command);

    const rawText = extractTextFromBlocks(textractResult.Blocks ?? []);
    const confidence = computeAverageConfidence(textractResult.Blocks ?? []);
    const normalized = normalizeQuestionText(rawText);

    const flagReasons = classifyQuestion({
      rawText,
      confidence,
      imageWidth: image.width ?? 800,
      imageHeight: image.height ?? 600,
      parsedOptionCount: normalized.optionCount,
    });

    const result: OcrResult = {
      rawText,
      textContent: normalized.stem,
      options: normalized.options,
      confidence,
      flagReasons,
      providerVersion: job.providerVersion,
      status: flagReasons.length > 0 ? "needs_review" : "approved",
    };

    await deps.repository.saveOcrResult(job.questionId, result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Lỗi không xác định khi OCR";
    await deps.repository.markOcrFailed(job.questionId, message);
    throw error;
  }
}

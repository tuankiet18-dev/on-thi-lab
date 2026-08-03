import { z } from "zod";
import type { PostgresOcrRepository, OcrResult } from "@onthilab/database";
import { normalizeQuestionText } from "./ocr-text-normalizer.js";
import sharp, { type Sharp } from "sharp";
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
  providerVersion: z.literal("textract@2024-02"),
  force: z.boolean().optional().default(false),
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

const maxTextractDocumentBytes = 8_500_000;

async function prepareImageForTextract(
  bytes: Uint8Array,
): Promise<{ bytes: Buffer; width: number; height: number }> {
  // Question screenshots commonly contain very small text. Upscaling modestly
  // before Textract is cheaper and more reliable than a second OCR provider.
  // Rotate also applies any EXIF orientation supplied by camera screenshots.
  const source = sharp(bytes, {
    failOn: "error",
    limitInputPixels: 40_000_000,
  }).rotate();
  const metadata = await source.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  const targetWidth =
    width > 0 && width < 2_200 ? Math.min(width * 2, 2_600) : undefined;

  const createJpeg = (input: Sharp) =>
    input
      .flatten({ background: "#ffffff" })
      .resize(targetWidth ? { width: targetWidth } : undefined)
      .sharpen({ sigma: 0.8 })
      .jpeg({ quality: 88, chromaSubsampling: "4:4:4" })
      .toBuffer();

  let output = await createJpeg(source.clone());
  if (output.byteLength > maxTextractDocumentBytes && width > 0) {
    const scale = Math.sqrt(maxTextractDocumentBytes / output.byteLength);
    output = await sharp(output)
      .resize({
        width: Math.max(800, Math.floor((targetWidth ?? width) * scale)),
      })
      .jpeg({ quality: 82, chromaSubsampling: "4:4:4" })
      .toBuffer();
  }

  return { bytes: output, width, height };
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

function getTextLayoutMetrics(blocks: any[]): {
  textCoverage: number;
  lineCount: number;
  hasComplexLayout: boolean;
} {
  const lines = blocks.filter((block) => block.BlockType === "LINE");
  const textCoverage = lines.reduce((total, block) => {
    const box = block.Geometry?.BoundingBox;
    return total + (box?.Width ?? 0) * (box?.Height ?? 0);
  }, 0);

  const boxes = lines
    .map((line) => line.Geometry?.BoundingBox)
    .filter(
      (box): box is { Left: number; Top: number; Width: number } =>
        typeof box?.Left === "number" &&
        typeof box.Top === "number" &&
        typeof box.Width === "number",
    );
  const hasComplexLayout = boxes.some((box, index) =>
    boxes
      .slice(index + 1)
      .some(
        (other) =>
          Math.abs(box.Top - other.Top) < 0.015 &&
          Math.abs(box.Left - other.Left) > 0.25,
      ),
  );

  return { textCoverage, lineCount: lines.length, hasComplexLayout };
}

export async function processOcrJob(
  payload: unknown,
  deps: OcrProcessorDependencies,
): Promise<void> {
  const job = ocrJobSchema.parse(payload);

  const claimed = await deps.repository.claimOcrJob(
    job.questionId,
    job.revisionId,
  );
  if (!claimed) return;

  try {
    const cached = job.force
      ? null
      : await deps.repository.findCachedOcrByHash(
          job.imageHash,
          job.providerVersion,
          job.questionId,
        );
    if (cached) {
      await deps.repository.saveOcrResult(job.questionId, cached);
      return;
    }

    const image = await deps.images.read(job.imageKey);
    if (!image) throw new Error("Không đọc được ảnh từ S3.");

    const preparedImage = await prepareImageForTextract(image.bytes);

    if (
      !(await deps.repository.isOcrJobActive(job.questionId, job.revisionId))
    ) {
      return;
    }

    const command = new DetectDocumentTextCommand({
      Document: { Bytes: preparedImage.bytes },
    });

    const textractResult = await deps.textract.send(command);

    const rawText = extractTextFromBlocks(textractResult.Blocks ?? []);
    const confidence = computeAverageConfidence(textractResult.Blocks ?? []);
    const normalized = normalizeQuestionText(rawText);
    const layoutMetrics = getTextLayoutMetrics(textractResult.Blocks ?? []);

    const flagReasons = classifyQuestion({
      rawText,
      confidence,
      imageWidth: preparedImage.width || image.width || 0,
      imageHeight: preparedImage.height || image.height || 0,
      parsedOptionCount: normalized.optionCount,
      ...layoutMetrics,
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

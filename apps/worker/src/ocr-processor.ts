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
  // Keep the previous versions readable so already queued messages can finish.
  // New imports use the standard-layout parser and a new cache namespace.
  providerVersion: z.enum([
    "textract@2024-02",
    "textract@2024-03-layout",
    "textract@2024-04-standard",
  ]),
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
  // Question screenshots commonly contain very small text. A modest upscale
  // improves the single Textract pass without persisting another image.
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

interface OcrLine {
  text: string;
  confidence: number;
}

function textractLines(blocks: unknown[]): OcrLine[] {
  return blocks
    .filter(
      (
        block,
      ): block is {
        BlockType: string;
        Text?: string;
        Confidence?: number;
      } => typeof block === "object" && block !== null,
    )
    .filter((block) => block.BlockType === "LINE" && Boolean(block.Text))
    .map((block) => ({
      text: block.Text!.trim(),
      confidence: (block.Confidence ?? 0) / 100,
    }));
}

function computeAverageConfidence(lines: OcrLine[]): number {
  if (lines.length === 0) return 0;
  return lines.reduce((sum, line) => sum + line.confidence, 0) / lines.length;
}

async function detectLines(
  textract: TextractClient,
  bytes: Buffer,
): Promise<OcrLine[]> {
  const response = await textract.send(
    new DetectDocumentTextCommand({ Document: { Bytes: bytes } }),
  );
  return textractLines(response.Blocks ?? []);
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

    const lines = await detectLines(deps.textract, preparedImage.bytes);
    const rawText = lines.map((line) => line.text).join("\n");
    const normalized = normalizeQuestionText(rawText);
    const confidence = computeAverageConfidence(lines);

    const flagReasons = classifyQuestion({
      rawText,
      confidence,
      imageWidth: preparedImage.width || image.width || 0,
      imageHeight: preparedImage.height || image.height || 0,
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

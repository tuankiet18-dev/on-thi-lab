import { z } from "zod";
import type { PostgresOcrRepository, OcrResult } from "@onthilab/database";
import { normalizeQuestionText } from "./ocr-text-normalizer.js";
import sharp, { type Sharp } from "sharp";
import { classifyQuestion } from "./ocr-classification.js";
import {
  parseQuestionLayout,
  type OcrBoundingBox,
  type OcrLayoutLine,
} from "./ocr-layout-parser.js";
import {
  TextractClient,
  DetectDocumentTextCommand,
} from "@aws-sdk/client-textract";

export const ocrJobSchema = z.object({
  questionId: z.string().uuid(),
  revisionId: z.string().uuid(),
  imageKey: z.string().min(1),
  imageHash: z.string().min(1),
  providerVersion: z.enum(["textract@2024-02", "textract@2024-03-layout"]),
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

function textractLines(blocks: unknown[]): OcrLayoutLine[] {
  return blocks
    .filter(
      (
        block,
      ): block is {
        BlockType: string;
        Text?: string;
        Confidence?: number;
        Geometry?: { BoundingBox?: Record<string, unknown> };
      } => typeof block === "object" && block !== null,
    )
    .filter((block) => block.BlockType === "LINE" && Boolean(block.Text))
    .flatMap((block) => {
      const box = block.Geometry?.BoundingBox;
      if (
        typeof box?.Left !== "number" ||
        typeof box.Top !== "number" ||
        typeof box.Width !== "number" ||
        typeof box.Height !== "number"
      ) {
        return [];
      }
      return [
        {
          text: block.Text!.trim(),
          confidence: (block.Confidence ?? 0) / 100,
          box: {
            left: box.Left,
            top: box.Top,
            width: box.Width,
            height: box.Height,
          },
        },
      ];
    });
}

function computeAverageConfidence(lines: OcrLayoutLine[]): number {
  if (lines.length === 0) return 0;
  return lines.reduce((sum, line) => sum + line.confidence, 0) / lines.length;
}

function getTextLayoutMetrics(lines: OcrLayoutLine[]): {
  textCoverage: number;
  lineCount: number;
  hasComplexLayout: boolean;
} {
  const textCoverage = lines.reduce((total, line) => {
    return total + line.box.width * line.box.height;
  }, 0);

  const hasComplexLayout = lines.some((line, index) =>
    lines
      .slice(index + 1)
      .some(
        (other) =>
          Math.abs(line.box.top - other.box.top) < 0.015 &&
          Math.abs(line.box.left - other.box.left) > 0.25,
      ),
  );

  return { textCoverage, lineCount: lines.length, hasComplexLayout };
}

function canRetryWithCrop(crop: OcrBoundingBox | null): crop is OcrBoundingBox {
  return (
    crop !== null &&
    crop.width >= 0.16 &&
    crop.height >= 0.06 &&
    (crop.width < 0.92 || crop.height < 0.92)
  );
}

async function cropForRetry(
  bytes: Buffer,
  crop: OcrBoundingBox,
): Promise<Buffer> {
  const metadata = await sharp(bytes).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (!width || !height) throw new Error("Không thể đọc kích thước ảnh OCR.");

  const left = Math.max(0, Math.floor(crop.left * width));
  const top = Math.max(0, Math.floor(crop.top * height));
  const cropWidth = Math.min(
    width - left,
    Math.max(1, Math.ceil(crop.width * width)),
  );
  const cropHeight = Math.min(
    height - top,
    Math.max(1, Math.ceil(crop.height * height)),
  );
  return sharp(bytes)
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .resize({ width: Math.min(Math.max(cropWidth * 2, 1_400), 2_800) })
    .sharpen({ sigma: 1 })
    .jpeg({ quality: 90, chromaSubsampling: "4:4:4" })
    .toBuffer();
}

async function detectLines(
  textract: TextractClient,
  bytes: Buffer,
): Promise<OcrLayoutLine[]> {
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

    const firstPassLines = await detectLines(
      deps.textract,
      preparedImage.bytes,
    );
    let layout = parseQuestionLayout(firstPassLines);
    let retryUsed = false;

    // Full-screen captures can include the answer sidebar and navigation.
    // Only retry when geometry found a smaller, likely question panel and the
    // first pass could not identify a complete A–F option sequence.
    if (layout.optionCount < 2 && canRetryWithCrop(layout.crop)) {
      const croppedBytes = await cropForRetry(preparedImage.bytes, layout.crop);
      const retryLines = await detectLines(deps.textract, croppedBytes);
      const retryLayout = parseQuestionLayout(retryLines);
      if (retryLayout.optionCount >= layout.optionCount) {
        layout = retryLayout;
        retryUsed = true;
      }
    }

    const normalized =
      layout.optionCount >= 2
        ? layout
        : normalizeQuestionText(
            layout.rawText ||
              firstPassLines.map((line) => line.text).join("\n"),
          );
    const contentLines = firstPassLines.filter((line) =>
      layout.rawText.includes(line.text),
    );
    const confidence = computeAverageConfidence(
      contentLines.length > 0 ? contentLines : firstPassLines,
    );
    const layoutMetrics = getTextLayoutMetrics(
      contentLines.length > 0 ? contentLines : firstPassLines,
    );
    const rawText =
      layout.rawText || firstPassLines.map((line) => line.text).join("\n");

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
      layout: {
        parserVersion: "geometry-v1",
        sourceLineCount: layout.sourceLineCount,
        selectedLineCount: layout.selectedLineCount,
        retryUsed,
      },
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

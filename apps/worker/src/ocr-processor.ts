import { z } from "zod";
import type { PostgresOcrRepository, OcrResult } from "@onthilab/database";

export const ocrJobSchema = z.object({
  questionId: z.string().uuid(),
  revisionId: z.string().uuid(),
  imageKey: z.string().min(1),
  imageHash: z.string().min(1),
  // Textract versions stay readable so messages queued before the switch can finish.
  providerVersion: z.enum([
    "textract@2024-02",
    "textract@2024-03-layout",
    "textract@2024-04-standard",
    "tesseract-paddle@2026-10",
  ]),
  force: z.boolean().optional().default(false),
});

/** Decision returned by the text OCR Lambda. `needs_review` keeps the original image on screen. */
export interface TextOcrResult {
  status: "approved" | "needs_review";
  textContent: string;
  options: string[];
  flagReasons: string[];
  confidence: number;
}

export interface TextOcrClient {
  read(imageKey: string): Promise<TextOcrResult>;
}

export interface OcrProcessorDependencies {
  repository: PostgresOcrRepository;
  ocr: TextOcrClient;
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

    // Re-check right before the expensive call so a mode change or cancel avoids the work.
    if (
      !(await deps.repository.isOcrJobActive(job.questionId, job.revisionId))
    ) {
      return;
    }

    const read = await deps.ocr.read(job.imageKey);
    const result: OcrResult = {
      rawText: read.textContent,
      textContent: read.textContent,
      options: read.options,
      confidence: read.confidence,
      flagReasons: read.flagReasons,
      providerVersion: job.providerVersion,
      status: read.status,
    };

    await deps.repository.saveOcrResult(job.questionId, result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Lỗi không xác định khi OCR";
    await deps.repository.markOcrFailed(job.questionId, message);
    throw error;
  }
}

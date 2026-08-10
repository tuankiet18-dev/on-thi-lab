import type { questions } from "./schema.js";

export type ExamPresentationMode = "image" | "text" | "hybrid";
export type QuestionContentMode = "image" | "text";

type OcrMetadata = typeof questions.$inferSelect.ocrMetadata;

function hasUsableText(metadata: OcrMetadata): boolean {
  return (
    metadata?.status === "approved" &&
    Boolean(metadata.textContent?.trim()) &&
    (metadata.options?.length ?? 0) >= 2 &&
    (metadata.options?.length ?? 0) <= 6
  );
}

/**
 * Resolves the visual source independently from answer scoring. In hybrid
 * mode, an OCR warning safely falls back to the original question image.
 */
export function resolveQuestionContentMode(
  examMode: ExamPresentationMode,
  metadata: OcrMetadata,
): QuestionContentMode {
  if (examMode === "image") return "image";
  if (examMode === "text") return "text";

  if (metadata?.contentMode) return metadata.contentMode;
  return hasUsableText(metadata) ? "text" : "image";
}

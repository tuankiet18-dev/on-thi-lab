import type {
  AiSuggestionJob,
  AiSuggestionRepository,
} from "@onthilab/database";
import { z } from "zod";
import type { AiVisionProvider } from "./index.js";

export const answerSuggestionJobSchema = z.object({
  examId: z.string().uuid(),
  questionId: z.string().uuid(),
  imageKey: z.string().min(1),
  courseCode: z.string().min(2),
  optionCount: z.number().int().min(2).max(6),
});

export interface AnswerSuggestionImageReader {
  read(
    imageKey: string,
  ): Promise<{ bytes: Uint8Array; contentType: string } | null>;
}

export interface AnswerSuggestionProcessorDependencies {
  repository: AiSuggestionRepository;
  images: AnswerSuggestionImageReader;
  provider: AiVisionProvider;
}

export async function processAnswerSuggestionJob(
  payload: AiSuggestionJob | unknown,
  dependencies: AnswerSuggestionProcessorDependencies,
): Promise<void> {
  const job = answerSuggestionJobSchema.parse(payload);

  try {
    await dependencies.repository.markProcessing(job.questionId);
    const image = await dependencies.images.read(job.imageKey);
    if (!image) throw new Error("Không thể đọc ảnh câu hỏi.");

    const imageDataUrl = `data:${image.contentType};base64,${Buffer.from(
      image.bytes,
    ).toString("base64")}`;
    const proposal = await dependencies.provider.proposeAnswer({
      imageDataUrl,
      courseCode: job.courseCode,
      optionCount: job.optionCount,
    });
    if (proposal.optionCount !== job.optionCount) {
      throw new Error(
        `AI nhận diện ${proposal.optionCount} lựa chọn, khác ${job.optionCount} lựa chọn đã cấu hình.`,
      );
    }

    await dependencies.repository.saveSuggestion(job.questionId, {
      proposedType: proposal.questionType,
      optionCount: proposal.optionCount,
      proposedAnswers: [...proposal.proposedAnswers].sort(
        (left, right) => left - right,
      ),
      confidence: proposal.confidence,
      provider: dependencies.provider.providerName,
      model: dependencies.provider.model,
      rationale: proposal.rationale,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "AI không thể xử lý câu hỏi.";
    await dependencies.repository.markFailed(job.questionId, message);
    throw error;
  }
}

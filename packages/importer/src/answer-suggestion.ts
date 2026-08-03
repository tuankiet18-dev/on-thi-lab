import type {
  AiSuggestionJob,
  AiSuggestionRepository,
} from "@onthilab/database";
import { z } from "zod";

export const aiAnswerProposalSchema = z
  .object({
    questionType: z.enum(["single", "multiple"]),
    optionCount: z.number().int().min(2).max(6),
    proposedAnswers: z.array(z.number().int().nonnegative()).min(1).max(6),
    confidence: z.number().min(0).max(1),
    rationale: z.string().max(1000).optional(),
  })
  .superRefine((value, context) => {
    if (
      value.proposedAnswers.some((answer) => answer >= value.optionCount) ||
      new Set(value.proposedAnswers).size !== value.proposedAnswers.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["proposedAnswers"],
        message: "Đáp án AI không hợp lệ với số lựa chọn.",
      });
    }
    if (value.questionType === "single" && value.proposedAnswers.length !== 1) {
      context.addIssue({
        code: "custom",
        path: ["proposedAnswers"],
        message: "Câu chọn một phải có đúng một đáp án.",
      });
    }
  });

export type AiAnswerProposal = z.infer<typeof aiAnswerProposalSchema>;

export interface AiVisionProvider {
  readonly providerName: string;
  readonly model: string;
  proposeAnswer(input: {
    imageDataUrl: string;
    courseCode: string;
    optionCount: number;
  }): Promise<AiAnswerProposal>;
}

export function validateAiProposal(payload: unknown): AiAnswerProposal {
  return aiAnswerProposalSchema.parse(payload);
}

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

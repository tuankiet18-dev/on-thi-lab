import { z } from "zod";

export * from "@onthilab/importer";
export * from "./answer-suggestion.js";
export * from "./openai-compatible-provider.js";

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

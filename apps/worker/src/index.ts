import { z } from "zod";

const aiAnswerSchema = z.object({
  questionType: z.enum(["single", "multiple"]),
  optionCount: z.number().int().min(2).max(6),
  proposedAnswers: z.array(z.number().int().nonnegative()).min(1),
  confidence: z.number().min(0).max(1),
  rationale: z.string().optional(),
});

export type AiAnswerProposal = z.infer<typeof aiAnswerSchema>;

export interface AiVisionProvider {
  proposeAnswer(input: {
    imageUrl: string;
    courseCode: string;
  }): Promise<AiAnswerProposal>;
}

export function validateAiProposal(payload: unknown): AiAnswerProposal {
  return aiAnswerSchema.parse(payload);
}

export async function processImageJob(
  payload: unknown,
  provider: AiVisionProvider,
): Promise<AiAnswerProposal> {
  const job = z
    .object({
      imageUrl: z.string().url(),
      courseCode: z.string().min(2),
    })
    .parse(payload);

  const proposal = await provider.proposeAnswer(job);
  return validateAiProposal(proposal);
}

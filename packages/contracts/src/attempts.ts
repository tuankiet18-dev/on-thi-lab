import { z } from "zod";
import { attemptStatuses } from "./common";
import { examSchema } from "./exams";

export const createAttemptSchema = z.object({
  examId: z.string(),
  deviceId: z.string().min(8),
});

export const saveAnswerSchema = z.object({
  questionId: z.string(),
  selectedOptions: z.array(z.number().int().nonnegative()).max(6),
  sequence: z.number().int().nonnegative(),
});

export const saveAnswerResultSchema = z.object({
  savedAt: z.string().datetime(),
  sequence: z.number().int().nonnegative(),
});

export const submitAttemptSchema = z.object({
  reason: z.enum(["user", "timeout"]),
});

export const attemptResultSchema = z.object({
  attemptId: z.string().uuid(),
  status: z.enum(["submitted", "auto_submitted"]),
  correctCount: z.number().int().nonnegative(),
  questionCount: z.number().int().positive(),
  score: z.number().min(0).max(10),
  submittedAt: z.string().datetime(),
});

const attemptAnswersSchema = z.record(
  z.string(),
  z.array(z.number().int().nonnegative()).max(6),
);

export const attemptSchema = z.object({
  id: z.string().uuid(),
  examId: z.string().uuid(),
  status: z.enum(attemptStatuses),
  startedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  answers: attemptAnswersSchema,
  questionOrder: z.array(z.string()).min(1),
  result: attemptResultSchema.nullable(),
  correctAnswers: attemptAnswersSchema.optional(),
});

export const attemptLaunchSchema = z.object({
  attempt: attemptSchema,
  resumed: z.boolean(),
});

/** An immutable view of the exact exam revision assigned to an attempt. */
export const attemptSessionSchema = z.object({
  attempt: attemptSchema,
  exam: examSchema,
});

export const attemptSummarySchema = z.object({
  id: z.string().uuid(),
  examId: z.string().uuid(),
  examCode: z.string(),
  courseCode: z.string(),
  status: z.enum(attemptStatuses),
  startedAt: z.string().datetime(),
  result: attemptResultSchema.nullable(),
});

export const studentStatisticsSchema = z.object({
  totalAttempts: z.number(),
  averageScore: z.number().nullable(),
  highestScore: z.number().nullable(),
  recentAttempts: z.array(
    z.object({
      id: z.string().uuid(),
      examCode: z.string(),
      score: z.number().nullable(),
      submittedAt: z.string().datetime().nullable(),
    }),
  ),
});

export type CreateAttemptInput = z.infer<typeof createAttemptSchema>;
export type SaveAnswerInput = z.infer<typeof saveAnswerSchema>;
export type SaveAnswerResult = z.infer<typeof saveAnswerResultSchema>;
export type AttemptResult = z.infer<typeof attemptResultSchema>;
export type Attempt = z.infer<typeof attemptSchema>;
export type AttemptLaunch = z.infer<typeof attemptLaunchSchema>;
export type AttemptSession = z.infer<typeof attemptSessionSchema>;
export type AttemptSummary = z.infer<typeof attemptSummarySchema>;
export type StudentStatistics = z.infer<typeof studentStatisticsSchema>;

export function isExactAnswer(
  selectedOptions: readonly number[],
  correctOptions: readonly number[],
): boolean {
  const selected = [...new Set(selectedOptions)].sort((a, b) => a - b);
  const correct = [...new Set(correctOptions)].sort((a, b) => a - b);
  return (
    selected.length === correct.length &&
    selected.every((value, index) => value === correct[index])
  );
}

export function calculateScore(
  answers: Record<string, readonly number[]>,
  answerKey: Record<string, readonly number[]>,
): Pick<AttemptResult, "correctCount" | "questionCount" | "score"> {
  const entries = Object.entries(answerKey);
  const correctCount = entries.reduce(
    (total, [questionId, correctOptions]) =>
      total +
      (isExactAnswer(answers[questionId] ?? [], correctOptions) ? 1 : 0),
    0,
  );
  const questionCount = entries.length;
  return {
    correctCount,
    questionCount,
    score:
      questionCount === 0
        ? 0
        : Math.round((correctCount / questionCount) * 1000) / 100,
  };
}

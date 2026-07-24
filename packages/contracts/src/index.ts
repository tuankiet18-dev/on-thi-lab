import { z } from "zod";

export const examTypes = ["FE", "PE"] as const;
export const questionTypes = ["single", "multiple"] as const;
export const aiSuggestionStatuses = [
  "queued",
  "processing",
  "suggested",
  "failed",
  "confirmed",
] as const;
export const attemptStatuses = [
  "in_progress",
  "submitted",
  "auto_submitted",
  "cancelled",
] as const;
export const userRoles = ["user", "contributor", "admin"] as const;

export const feZipImportConstraints = {
  expectedQuestionCount: 60,
  maxArchiveBytes: 250 * 1024 * 1024,
  maxImageBytes: 20 * 1024 * 1024,
  maxTotalUncompressedBytes: 500 * 1024 * 1024,
  maxCompressionRatio: 100,
  allowedExtensions: [".jpg", ".jpeg", ".png", ".webp"],
} as const;

export const profileOptionSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
});

export const studentProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string().min(1),
  studentCode: z.string().min(4),
  campus: profileOptionSchema,
  major: profileOptionSchema,
  role: z.enum(userRoles),
});

export const profileOptionsSchema = z.object({
  campuses: z.array(profileOptionSchema),
  majors: z.array(profileOptionSchema),
});

export const upsertStudentProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  studentCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{4,20}$/),
  campusCode: z.string().trim().min(1).max(20),
  majorCode: z.string().trim().min(1).max(30),
});

export const createDraftImportSchema = z.object({
  courseCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{3,12}$/),
  semester: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{3,20}$/),
  campusCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{1,20}$/),
  examType: z.literal("FE"),
  isRetake: z.boolean(),
  durationMinutes: z.number().int().min(15).max(240),
});

export const draftImportResultSchema = z.object({
  examId: z.string().uuid(),
  revisionId: z.string().uuid(),
  examCode: z.string(),
  questionCount: z.number().int().positive(),
  status: z.literal("draft"),
});

export const aiAnswerSuggestionSchema = z
  .object({
    status: z.enum(aiSuggestionStatuses),
    proposedType: z.enum(questionTypes).optional(),
    optionCount: z.number().int().min(2).max(6).optional(),
    proposedAnswers: z
      .array(z.number().int().min(0).max(5))
      .min(1)
      .max(6)
      .optional(),
    confidence: z.number().min(0).max(1).optional(),
    provider: z.string().optional(),
    model: z.string().optional(),
    error: z.string().optional(),
    updatedAt: z.string().datetime(),
  })
  .superRefine((value, context) => {
    if (
      value.status === "suggested" &&
      (!value.proposedType ||
        !value.optionCount ||
        !value.proposedAnswers?.length ||
        value.confidence === undefined)
    ) {
      context.addIssue({
        code: "custom",
        message: "Gợi ý hoàn tất phải có đầy đủ đáp án và độ tin cậy.",
      });
    }
  });

export const reviewQuestionSchema = z.object({
  id: z.string().uuid(),
  order: z.number().int().positive(),
  imageUrl: z.string().min(1),
  type: z.enum(questionTypes),
  options: z.array(z.string()).min(2).max(6),
  correctOptions: z.array(z.number().int().min(0).max(5)).max(6),
  aiSuggestion: aiAnswerSuggestionSchema.nullable(),
});
export const savedReviewQuestionSchema = reviewQuestionSchema.omit({
  imageUrl: true,
});

export const draftExamReviewSchema = z.object({
  examId: z.string().uuid(),
  revisionId: z.string().uuid(),
  examCode: z.string(),
  courseCode: z.string(),
  courseName: z.string(),
  semester: z.string(),
  campus: profileOptionSchema,
  durationMinutes: z.number().int().positive(),
  isRetake: z.boolean(),
  status: z.enum(["draft", "review", "published"]),
  publishedAt: z.string().datetime().nullable(),
  answeredCount: z.number().int().nonnegative(),
  questionCount: z.number().int().positive(),
  questions: z.array(reviewQuestionSchema),
});

export const updateQuestionAnswerSchema = z
  .object({
    type: z.enum(questionTypes),
    optionCount: z.number().int().min(2).max(6),
    correctOptions: z.array(z.number().int().min(0).max(5)).min(1).max(6),
  })
  .superRefine((value, context) => {
    const unique = new Set(value.correctOptions);
    if (unique.size !== value.correctOptions.length) {
      context.addIssue({
        code: "custom",
        path: ["correctOptions"],
        message: "Đáp án không được trùng lặp.",
      });
    }
    if (value.correctOptions.some((option) => option >= value.optionCount)) {
      context.addIssue({
        code: "custom",
        path: ["correctOptions"],
        message: "Đáp án vượt quá số lựa chọn của câu.",
      });
    }
    if (value.type === "single" && value.correctOptions.length !== 1) {
      context.addIssue({
        code: "custom",
        path: ["correctOptions"],
        message: "Câu một đáp án phải có đúng một đáp án.",
      });
    }
  });

export const reviewReadinessResultSchema = z.object({
  examId: z.string().uuid(),
  status: z.literal("review"),
  answeredCount: z.number().int().positive(),
  questionCount: z.number().int().positive(),
});

export const publishExamResultSchema = z.object({
  examId: z.string().uuid(),
  revisionId: z.string().uuid(),
  status: z.literal("published"),
  publishedAt: z.string().datetime(),
});

export const queueAiSuggestionsResultSchema = z.object({
  examId: z.string().uuid(),
  queuedCount: z.number().int().nonnegative(),
  skippedCount: z.number().int().nonnegative(),
});

export const questionSchema = z.object({
  id: z.string(),
  order: z.number().int().positive(),
  imageUrl: z.string(),
  imageAlt: z.string(),
  type: z.enum(questionTypes),
  options: z.array(z.string()).min(2).max(6),
});

export const examSummarySchema = z.object({
  id: z.string(),
  code: z.string(),
  courseCode: z.string(),
  courseName: z.string(),
  semester: z.string(),
  campus: z.string(),
  examType: z.enum(examTypes),
  isRetake: z.boolean(),
  durationMinutes: z.number().int().positive(),
  questionCount: z.number().int().positive(),
  publishedAt: z.string(),
  answerConfidence: z.enum(["reviewed", "verified"]),
});

export const examSchema = examSummarySchema.extend({
  instructions: z.array(z.string()),
  shuffleQuestions: z.boolean(),
  questions: z.array(questionSchema),
});

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

export type Question = z.infer<typeof questionSchema>;
export type ExamSummary = z.infer<typeof examSummarySchema>;
export type Exam = z.infer<typeof examSchema>;
export type CreateAttemptInput = z.infer<typeof createAttemptSchema>;
export type SaveAnswerInput = z.infer<typeof saveAnswerSchema>;
export type SaveAnswerResult = z.infer<typeof saveAnswerResultSchema>;
export type AttemptStatus = (typeof attemptStatuses)[number];
export type QuestionType = (typeof questionTypes)[number];
export type AiSuggestionStatus = (typeof aiSuggestionStatuses)[number];
export type AiAnswerSuggestion = z.infer<typeof aiAnswerSuggestionSchema>;
export type UserRole = (typeof userRoles)[number];
export type ProfileOption = z.infer<typeof profileOptionSchema>;
export type StudentProfile = z.infer<typeof studentProfileSchema>;
export type ProfileOptions = z.infer<typeof profileOptionsSchema>;
export type UpsertStudentProfileInput = z.infer<
  typeof upsertStudentProfileSchema
>;
export type CreateDraftImportInput = z.infer<typeof createDraftImportSchema>;
export type DraftImportResult = z.infer<typeof draftImportResultSchema>;
export type ReviewQuestion = z.infer<typeof reviewQuestionSchema>;
export type SavedReviewQuestion = z.infer<typeof savedReviewQuestionSchema>;
export type DraftExamReview = z.infer<typeof draftExamReviewSchema>;
export type UpdateQuestionAnswerInput = z.infer<
  typeof updateQuestionAnswerSchema
>;
export type ReviewReadinessResult = z.infer<typeof reviewReadinessResultSchema>;
export type PublishExamResult = z.infer<typeof publishExamResultSchema>;
export type QueueAiSuggestionsResult = z.infer<
  typeof queueAiSuggestionsResultSchema
>;
export type AttemptResult = z.infer<typeof attemptResultSchema>;
export type Attempt = z.infer<typeof attemptSchema>;
export type AttemptLaunch = z.infer<typeof attemptLaunchSchema>;

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

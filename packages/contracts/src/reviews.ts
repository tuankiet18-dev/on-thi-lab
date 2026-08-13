import { z } from "zod";
import { profileOptionSchema } from "./catalog";
import { aiSuggestionStatuses, examStatuses, questionTypes } from "./common";

export const feZipImportConstraints = {
  minQuestionCount: 1,
  maxQuestionCount: 120,
  maxArchiveBytes: 250 * 1024 * 1024,
  maxImageBytes: 20 * 1024 * 1024,
  maxTotalUncompressedBytes: 500 * 1024 * 1024,
  maxCompressionRatio: 100,
  allowedExtensions: [".jpg", ".jpeg", ".png", ".webp"],
} as const;

export const adminExamSummarySchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  courseCode: z.string(),
  semester: z.string(),
  status: z.enum(examStatuses),
  creatorName: z.string(),
  createdAt: z.string().datetime(),
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
  extractText: z.boolean().default(false),
});

export const draftImportResultSchema = z.object({
  examId: z.string().uuid(),
  revisionId: z.string().uuid(),
  examCode: z.string(),
  questionCount: z.number().int().positive(),
  status: z.literal("draft"),
  /** The draft is usable even if its optional OCR jobs could not be queued. */
  ocrQueueWarning: z.string().optional(),
});

export const ocrStatuses = [
  "pending",
  "processing",
  "approved",
  "needs_review",
  "failed",
] as const;

export const examPresentationModes = ["image", "text", "hybrid"] as const;
export const questionContentModes = ["image", "text"] as const;

export const ocrQuestionStatusSchema = z.object({
  questionId: z.string().uuid(),
  order: z.number(),
  ocrStatus: z.enum(ocrStatuses),
  textContent: z.string().nullable(),
  // OCR review must represent incomplete extraction so an admin can repair
  // it. The 2–6 option rule is enforced only when text is approved/published.
  options: z.array(z.string()).max(6).nullable(),
  optionCount: z.number().int().min(0).max(6),
  confidence: z.number().nullable(),
  flagReasons: z.array(z.string()),
  validationIssues: z.array(z.string()),
  imageUrl: z.string(),
  contentMode: z.enum(questionContentModes),
});

export const examOcrStatusSchema = z.object({
  revisionId: z.string().uuid(),
  presentationMode: z.enum(examPresentationModes),
  ocrProgress: z.object({
    total: z.number(),
    approved: z.number(),
    needsReview: z.number(),
    pending: z.number(),
    failed: z.number(),
  }),
  questions: z.array(ocrQuestionStatusSchema),
  canPublish: z.boolean(),
});

export const updateOcrQuestionSchema = z.object({
  textContent: z.string().trim().min(1).max(12_000),
  options: z.array(z.string().trim().min(1).max(2_000)).min(2).max(6),
});

export const updateExamPresentationModeSchema = z.object({
  mode: z.enum(examPresentationModes),
});

export const aiAnswerSuggestionSchema = z
  .object({
    status: z.enum(aiSuggestionStatuses),
    proposedType: z.enum(questionTypes).optional(),
    optionCount: z.number().int().min(2).max(6).optional(),
    optionCountConfidence: z.number().min(0).max(1).optional(),
    optionCountSource: z.string().max(50).optional(),
    proposedAnswers: z
      .array(z.number().int().min(0).max(5))
      .min(1)
      .max(6)
      .optional(),
    confidence: z.number().min(0).max(1).optional(),
    provider: z.string().optional(),
    model: z.string().optional(),
    error: z.string().optional(),
    validVotes: z.number().int().nonnegative().optional(),
    totalComments: z.number().int().nonnegative().optional(),
    voteBreakdown: z
      .record(z.string(), z.number().int().nonnegative())
      .optional(),
    requiresReview: z.boolean().optional(),
    disputeReason: z.string().max(500).optional(),
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
  presentationMode: z.enum(examPresentationModes),
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

export const confirmTrustedSuggestionsResultSchema = z.object({
  examId: z.string().uuid(),
  confirmedCount: z.number().int().nonnegative(),
  answeredCount: z.number().int().nonnegative(),
  questionCount: z.number().int().positive(),
  remainingCount: z.number().int().nonnegative(),
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

export type AdminExamSummary = z.infer<typeof adminExamSummarySchema>;
export type CreateDraftImportInput = z.infer<typeof createDraftImportSchema>;
export type DraftImportResult = z.infer<typeof draftImportResultSchema>;
export type ExamOcrStatus = z.infer<typeof examOcrStatusSchema>;
export type OcrQuestionStatus = z.infer<typeof ocrQuestionStatusSchema>;
export type AiAnswerSuggestion = z.infer<typeof aiAnswerSuggestionSchema>;
export type ReviewQuestion = z.infer<typeof reviewQuestionSchema>;
export type SavedReviewQuestion = z.infer<typeof savedReviewQuestionSchema>;
export type DraftExamReview = z.infer<typeof draftExamReviewSchema>;
export type UpdateQuestionAnswerInput = z.infer<
  typeof updateQuestionAnswerSchema
>;
export type ReviewReadinessResult = z.infer<typeof reviewReadinessResultSchema>;
export type ConfirmTrustedSuggestionsResult = z.infer<
  typeof confirmTrustedSuggestionsResultSchema
>;
export type PublishExamResult = z.infer<typeof publishExamResultSchema>;
export type QueueAiSuggestionsResult = z.infer<
  typeof queueAiSuggestionsResultSchema
>;

import { z } from "zod";
import { questionTypes } from "./common";
import { examSummarySchema } from "./exams";
import { examPresentationModes, questionContentModes } from "./reviews";

export const bookmarkedExamSchema = examSummarySchema.extend({
  bookmarkedAt: z.string().datetime(),
});

/**
 * Deliberately excludes correctOptions. Saving a question must not reveal its
 * answer before the student submits an attempt.
 */
export const bookmarkedQuestionSchema = z.object({
  questionId: z.string().uuid(),
  examId: z.string().uuid(),
  examCode: z.string(),
  courseCode: z.string(),
  courseName: z.string(),
  semester: z.string(),
  campus: z.string(),
  order: z.number().int().positive(),
  imageUrl: z.string(),
  imageAlt: z.string(),
  textContent: z.string().nullable().optional(),
  contentMode: z.enum(questionContentModes).default("image"),
  type: z.enum(questionTypes),
  options: z.array(z.string()).min(2).max(6),
  bookmarkedAt: z.string().datetime(),
  presentationMode: z.enum(examPresentationModes).default("image"),
});

export const bookmarkCollectionSchema = z.object({
  exams: z.array(bookmarkedExamSchema),
  questions: z.array(bookmarkedQuestionSchema),
});

export const bookmarkStateSchema = z.object({
  bookmarked: z.boolean(),
});

export type BookmarkedExam = z.infer<typeof bookmarkedExamSchema>;
export type BookmarkedQuestion = z.infer<typeof bookmarkedQuestionSchema>;
export type BookmarkCollection = z.infer<typeof bookmarkCollectionSchema>;

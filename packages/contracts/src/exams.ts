import { z } from "zod";
import { examTypes, questionTypes } from "./common";
import { examPresentationModes, questionContentModes } from "./reviews";

export const questionSchema = z.object({
  id: z.string(),
  order: z.number().int().positive(),
  imageUrl: z.string(),
  imageAlt: z.string(),
  textContent: z.string().nullable().optional(),
  contentMode: z.enum(questionContentModes).default("image"),
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
  presentationMode: z.enum(examPresentationModes).default("image"),
  publishedAt: z.string(),
  answerConfidence: z.enum(["reviewed", "verified"]),
});

export const examSchema = examSummarySchema.extend({
  instructions: z.array(z.string()),
  shuffleQuestions: z.boolean(),
  questions: z.array(questionSchema),
});

export type Question = z.infer<typeof questionSchema>;
export type ExamSummary = z.infer<typeof examSummarySchema>;
export type Exam = z.infer<typeof examSchema>;

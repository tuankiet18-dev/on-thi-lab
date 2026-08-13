import { z } from "zod";
import { questionTypes, reportStatuses } from "./common";

export const createReportSchema = z.object({
  category: z.string(),
  detail: z.string(),
});

export const reportSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  questionId: z.string().uuid(),
  attemptId: z.string().uuid().nullable(),
  category: z.string(),
  detail: z.string(),
  status: z.enum(reportStatuses),
  resolution: z.string().nullable(),
  resolvedBy: z.string().uuid().nullable(),
  resolvedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  question: z
    .object({
      examCode: z.string(),
      courseCode: z.string(),
      imageUrl: z.string(),
      textContent: z.string().nullable().optional(),
      options: z.array(z.string()),
      correctOptions: z.array(z.number()),
      type: z.enum(questionTypes),
    })
    .optional(),
});

export const resolveReportSchema = z.object({
  status: z.enum(["resolved", "rejected"]),
  resolution: z.string(),
  correctOptions: z.array(z.number().int().nonnegative()).max(6).optional(),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;
export type Report = z.infer<typeof reportSchema>;
export type ResolveReportInput = z.infer<typeof resolveReportSchema>;

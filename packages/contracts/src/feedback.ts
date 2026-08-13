import { z } from "zod";

export const feedbackStatuses = ["new", "resolved"] as const;

export const createFeedbackSchema = z.object({
  title: z.string().trim().min(3).max(100),
  detail: z.string().trim().min(10).max(2000),
});

export const feedbackSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  title: z.string(),
  detail: z.string(),
  status: z.enum(feedbackStatuses),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>;
export type Feedback = z.infer<typeof feedbackSchema>;
export type FeedbackStatus = (typeof feedbackStatuses)[number];

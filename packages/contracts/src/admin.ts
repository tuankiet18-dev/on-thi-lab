import { z } from "zod";

export const adminAttentionSummarySchema = z.object({
  drafts: z.number().int().nonnegative(),
  reports: z.number().int().nonnegative(),
  feedback: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

export type AdminAttentionSummary = z.infer<typeof adminAttentionSummarySchema>;

import { count, eq, inArray } from "drizzle-orm";

import type { OnThiLabDatabase } from "./index";
import { exams, feedback, reports } from "./schema";

export type AdminAttentionSummary = {
  drafts: number;
  reports: number;
  feedback: number;
  total: number;
};

export interface AdminAttentionRepository {
  getSummary(): Promise<AdminAttentionSummary>;
}

export class PostgresAdminAttentionRepository implements AdminAttentionRepository {
  constructor(private readonly db: OnThiLabDatabase) {}

  async getSummary(): Promise<AdminAttentionSummary> {
    const [draftRows, reportRows, feedbackRows] = await Promise.all([
      this.db
        .select({ value: count() })
        .from(exams)
        .where(inArray(exams.status, ["draft", "review"])),
      this.db
        .select({ value: count() })
        .from(reports)
        .where(eq(reports.status, "open")),
      this.db
        .select({ value: count() })
        .from(feedback)
        .where(eq(feedback.status, "new")),
    ]);

    const drafts = Number(draftRows[0]?.value ?? 0);
    const openReports = Number(reportRows[0]?.value ?? 0);
    const newFeedback = Number(feedbackRows[0]?.value ?? 0);

    return {
      drafts,
      reports: openReports,
      feedback: newFeedback,
      total: drafts + openReports + newFeedback,
    };
  }
}

import type { CreateFeedbackInput, Feedback } from "@onthilab/contracts";
import { desc, eq } from "drizzle-orm";
import type { OnThiLabDatabase } from "./index";
import { feedback } from "./schema";

export interface FeedbackRepository {
  create(userId: string, input: CreateFeedbackInput): Promise<Feedback>;
  listNew(): Promise<Feedback[]>;
  resolve(id: string): Promise<Feedback | null>;
}

function toFeedback(row: typeof feedback.$inferSelect): Feedback {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    detail: row.detail,
    status: row.status === "resolved" ? "resolved" : "new",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class PostgresFeedbackRepository implements FeedbackRepository {
  constructor(private readonly db: OnThiLabDatabase) {}

  async create(userId: string, input: CreateFeedbackInput): Promise<Feedback> {
    const [created] = await this.db
      .insert(feedback)
      .values({
        userId,
        title: input.title,
        detail: input.detail,
        status: "new",
      })
      .returning();
    if (!created) throw new Error("Failed to create feedback.");
    return toFeedback(created);
  }

  async listNew(): Promise<Feedback[]> {
    const rows = await this.db
      .select()
      .from(feedback)
      .where(eq(feedback.status, "new"))
      .orderBy(desc(feedback.createdAt));
    return rows.map(toFeedback);
  }

  async resolve(id: string): Promise<Feedback | null> {
    const [updated] = await this.db
      .update(feedback)
      .set({ status: "resolved", updatedAt: new Date() })
      .where(eq(feedback.id, id))
      .returning();
    return updated ? toFeedback(updated) : null;
  }
}

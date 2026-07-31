import type { ExamOcrStatus, OcrQuestionStatus } from "@onthilab/contracts";
import { eq, inArray } from "drizzle-orm";
import type { OnThiLabDatabase } from "./index.js";
import { examRevisions, questions } from "./schema.js";

export type OcrMetadata = NonNullable<
  typeof questions.$inferSelect.ocrMetadata
>;

export interface OcrResult {
  status: "approved" | "needs_review" | "failed";
  textContent?: string;
  options?: string[];
  confidence?: number;
  flagReasons?: string[];
  rawText?: string;
  providerVersion: string;
}

export class PostgresOcrRepository {
  constructor(private readonly db: OnThiLabDatabase) {}

  async enqueueOcrJobs(
    revisionId: string,
  ): Promise<{ id: string; imageKey: string; imageHash: string }[]> {
    const questionsList = await this.db
      .select({
        id: questions.id,
        imageKey: questions.imageKey,
        imageHash: questions.imageHash,
      })
      .from(questions)
      .where(eq(questions.revisionId, revisionId));

    if (questionsList.length === 0) return [];

    await this.db
      .update(questions)
      .set({
        ocrMetadata: {
          status: "pending",
        },
      })
      .where(
        inArray(
          questions.id,
          questionsList.map((q) => q.id),
        ),
      );

    return questionsList;
  }

  async markOcrProcessing(questionId: string): Promise<void> {
    await this.db
      .update(questions)
      .set({
        ocrMetadata: {
          status: "processing",
        },
      })
      .where(eq(questions.id, questionId));
  }

  async saveOcrResult(questionId: string, result: OcrResult): Promise<void> {
    await this.db
      .update(questions)
      .set({
        ocrMetadata: {
          status: result.status,
          textContent: result.textContent,
          confidence: result.confidence,
          flagReasons: result.flagReasons,
          rawText: result.rawText,
          providerVersion: result.providerVersion,
        },
      })
      .where(eq(questions.id, questionId));
  }

  async markOcrFailed(questionId: string, error: string): Promise<void> {
    await this.db
      .update(questions)
      .set({
        ocrMetadata: {
          status: "failed",
          error,
        },
      })
      .where(eq(questions.id, questionId));
  }

  async getExamOcrStatus(revisionId: string): Promise<ExamOcrStatus> {
    const [revision] = await this.db
      .select({ presentationMode: examRevisions.presentationMode })
      .from(examRevisions)
      .where(eq(examRevisions.id, revisionId));

    if (!revision) throw new Error("Revision not found");

    const questionsList = await this.db
      .select({
        id: questions.id,
        order: questions.order,
        imageKey: questions.imageKey,
        ocrMetadata: questions.ocrMetadata,
      })
      .from(questions)
      .where(eq(questions.revisionId, revisionId))
      .orderBy(questions.order);

    const ocrProgress = {
      total: questionsList.length,
      approved: 0,
      needsReview: 0,
      pending: 0,
      failed: 0,
    };

    const questionStatuses: OcrQuestionStatus[] = questionsList.map((q) => {
      const status = q.ocrMetadata?.status ?? "pending";
      if (status === "approved") ocrProgress.approved++;
      else if (status === "needs_review") ocrProgress.needsReview++;
      else if (status === "failed") ocrProgress.failed++;
      else ocrProgress.pending++;

      return {
        questionId: q.id,
        order: q.order,
        ocrStatus: status,
        textContent: q.ocrMetadata?.textContent ?? null,
        confidence: q.ocrMetadata?.confidence ?? null,
        flagReasons: q.ocrMetadata?.flagReasons ?? [],
        imageUrl: q.imageKey,
      };
    });

    const canPublish =
      revision.presentationMode === "image" ||
      (ocrProgress.pending === 0 &&
        ocrProgress.needsReview === 0 &&
        ocrProgress.failed === 0);

    return {
      revisionId,
      presentationMode: revision.presentationMode as "image" | "text",
      ocrProgress,
      questions: questionStatuses,
      canPublish,
    };
  }

  async approveOcrQuestion(
    questionId: string,
    textContent: string,
    userId: string,
  ): Promise<void> {
    const [question] = await this.db
      .select({ ocrMetadata: questions.ocrMetadata })
      .from(questions)
      .where(eq(questions.id, questionId));

    if (!question) throw new Error("Question not found");

    const existingMetadata = question.ocrMetadata ?? { status: "pending" };

    await this.db
      .update(questions)
      .set({
        ocrMetadata: {
          ...existingMetadata,
          status: "approved",
          textContent,
          reviewedAt: new Date().toISOString(),
          reviewedBy: userId,
        },
      })
      .where(eq(questions.id, questionId));
  }

  async rejectOcrQuestion(questionId: string, userId: string): Promise<void> {
    const [question] = await this.db
      .select({ ocrMetadata: questions.ocrMetadata })
      .from(questions)
      .where(eq(questions.id, questionId));

    if (!question) throw new Error("Question not found");

    const existingMetadata = question.ocrMetadata ?? { status: "pending" };

    await this.db
      .update(questions)
      .set({
        ocrMetadata: {
          ...existingMetadata,
          status: "failed", // fallback to image
          error: "Rejected by admin",
          reviewedAt: new Date().toISOString(),
          reviewedBy: userId,
        },
      })
      .where(eq(questions.id, questionId));
  }

  async triggerReOcr(questionId: string): Promise<{
    id: string;
    imageKey: string;
    imageHash: string;
    revisionId: string;
  }> {
    const [updated] = await this.db
      .update(questions)
      .set({
        ocrMetadata: {
          status: "pending",
        },
      })
      .where(eq(questions.id, questionId))
      .returning({
        id: questions.id,
        imageKey: questions.imageKey,
        imageHash: questions.imageHash,
        revisionId: questions.revisionId,
      });

    if (!updated) throw new Error("Question not found");
    return updated;
  }

  async setExamPresentationMode(
    revisionId: string,
    mode: "image" | "text",
  ): Promise<void> {
    await this.db
      .update(examRevisions)
      .set({ presentationMode: mode })
      .where(eq(examRevisions.id, revisionId));
  }

  async findCachedOcrByHash(
    imageHash: string,
    providerVersion: string,
  ): Promise<OcrResult | null> {
    const [cached] = await this.db
      .select({ ocrMetadata: questions.ocrMetadata })
      .from(questions)
      .where(eq(questions.imageHash, imageHash))
      .limit(1);

    if (
      cached?.ocrMetadata &&
      cached.ocrMetadata.providerVersion === providerVersion &&
      (cached.ocrMetadata.status === "approved" ||
        cached.ocrMetadata.status === "needs_review")
    ) {
      return {
        status: cached.ocrMetadata.status,
        textContent: cached.ocrMetadata.textContent,
        confidence: cached.ocrMetadata.confidence,
        flagReasons: cached.ocrMetadata.flagReasons,
        rawText: cached.ocrMetadata.rawText,
        providerVersion: cached.ocrMetadata.providerVersion,
      };
    }
    return null;
  }
}

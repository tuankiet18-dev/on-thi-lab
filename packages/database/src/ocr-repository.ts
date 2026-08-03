import type { ExamOcrStatus, OcrQuestionStatus } from "@onthilab/contracts";
import { and, desc, eq, sql } from "drizzle-orm";
import type { OnThiLabDatabase } from "./index.js";
import {
  resolveQuestionContentMode,
  type ExamPresentationMode,
} from "./question-presentation.js";
import { examRevisions, questions } from "./schema.js";

export type OcrMetadata = NonNullable<
  typeof questions.$inferSelect.ocrMetadata
>;

export interface OcrResult {
  status: "approved" | "needs_review";
  textContent?: string;
  options?: string[];
  confidence?: number;
  flagReasons?: string[];
  rawText?: string;
  providerVersion: string;
}

type OcrQuestionRow = {
  id: string;
  revisionId: string;
  order: number;
  imageKey: string;
  imageHash: string;
  options: string[];
  correctOptions: number[];
  ocrMetadata: OcrMetadata | null;
};

function optionLabels(count: number): string[] {
  return Array.from({ length: count }, (_, index) =>
    String.fromCharCode(65 + index),
  );
}

function validateTextQuestion(question: OcrQuestionRow): string[] {
  const issues: string[] = [];
  const metadata = question.ocrMetadata;
  const text = metadata?.textContent?.trim() ?? "";
  const options = metadata?.options ?? [];

  if (metadata?.status !== "approved") {
    issues.push("Chưa được duyệt OCR.");
  }
  if (!text) {
    issues.push("Thiếu nội dung câu hỏi.");
  }
  if (options.length < 2 || options.length > 6) {
    issues.push("Câu hỏi phải có từ 2 đến 6 lựa chọn.");
  }
  if (options.some((option) => !option.trim())) {
    issues.push("Có lựa chọn trống.");
  }
  if (question.correctOptions.length === 0) {
    issues.push("Chưa có đáp án đúng.");
  }
  if (question.correctOptions.some((option) => option >= options.length)) {
    issues.push("Đáp án đúng vượt quá số lựa chọn OCR.");
  }

  return issues;
}

export class PostgresOcrRepository {
  constructor(private readonly db: OnThiLabDatabase) {}

  async enqueueOcrJobs(
    revisionId: string,
    force = false,
  ): Promise<{ id: string; imageKey: string; imageHash: string }[]> {
    const questionsList = await this.db
      .select({
        id: questions.id,
        imageKey: questions.imageKey,
        imageHash: questions.imageHash,
        ocrMetadata: questions.ocrMetadata,
      })
      .from(questions)
      .where(eq(questions.revisionId, revisionId));

    const queuedAt = new Date().toISOString();
    const toQueue = questionsList.filter((question) => {
      if (force) return true;
      const status = question.ocrMetadata?.status;
      return status === undefined || status === "pending";
    });

    await Promise.all(
      toQueue.map((question) =>
        this.db
          .update(questions)
          .set({
            ocrMetadata: {
              ...question.ocrMetadata,
              status: "pending",
              queuedAt,
              error: undefined,
            },
          })
          .where(eq(questions.id, question.id)),
      ),
    );

    return toQueue.map(({ id, imageKey, imageHash }) => ({
      id,
      imageKey,
      imageHash,
    }));
  }

  async resetRevisionOcrJobs(
    revisionId: string,
  ): Promise<{ id: string; imageKey: string; imageHash: string }[]> {
    return this.enqueueOcrJobs(revisionId, true);
  }

  /**
   * Claims a pending job only while its revision is still OCR-capable.
   * This makes stale SQS messages harmless after an admin switches back to image.
   */
  async claimOcrJob(questionId: string, revisionId: string): Promise<boolean> {
    const [question] = await this.db
      .select({
        id: questions.id,
        revisionId: questions.revisionId,
        ocrMetadata: questions.ocrMetadata,
      })
      .from(questions)
      .where(eq(questions.id, questionId))
      .limit(1);

    if (!question || question.revisionId !== revisionId) return false;

    const [revision] = await this.db
      .select({ presentationMode: examRevisions.presentationMode })
      .from(examRevisions)
      .where(eq(examRevisions.id, revisionId))
      .limit(1);

    if (
      revision?.presentationMode !== "text" &&
      revision?.presentationMode !== "hybrid"
    ) {
      return false;
    }
    if (question.ocrMetadata?.status !== "pending") return false;

    // Claim atomically. Standard SQS is at-least-once delivery, so duplicate
    // messages must never result in duplicate Textract calls.
    const [claimedQuestion] = await this.db
      .update(questions)
      .set({
        ocrMetadata: {
          ...question.ocrMetadata,
          status: "processing",
          startedAt: new Date().toISOString(),
          attemptCount: (question.ocrMetadata?.attemptCount ?? 0) + 1,
          error: undefined,
        },
      })
      .where(
        and(
          eq(questions.id, questionId),
          eq(questions.revisionId, revisionId),
          sql`(${questions.ocrMetadata}->>'status') = 'pending'`,
        ),
      )
      .returning({ id: questions.id });

    return Boolean(claimedQuestion);
  }

  /** Re-check immediately before Textract so a mode change/cancel avoids spend. */
  async isOcrJobActive(
    questionId: string,
    revisionId: string,
  ): Promise<boolean> {
    const [question] = await this.db
      .select({
        revisionId: questions.revisionId,
        ocrMetadata: questions.ocrMetadata,
      })
      .from(questions)
      .where(eq(questions.id, questionId))
      .limit(1);
    if (
      !question ||
      question.revisionId !== revisionId ||
      question.ocrMetadata?.status !== "processing"
    ) {
      return false;
    }

    const [revision] = await this.db
      .select({ presentationMode: examRevisions.presentationMode })
      .from(examRevisions)
      .where(eq(examRevisions.id, revisionId))
      .limit(1);
    return (
      revision?.presentationMode === "text" ||
      revision?.presentationMode === "hybrid"
    );
  }

  async saveOcrResult(questionId: string, result: OcrResult): Promise<void> {
    const [question] = await this.db
      .select({
        ocrMetadata: questions.ocrMetadata,
        correctOptions: questions.correctOptions,
      })
      .from(questions)
      .where(eq(questions.id, questionId))
      .limit(1);
    if (!question) throw new Error("Question not found");

    const options = result.options
      ?.map((option) => option.trim())
      .filter(Boolean);
    const optionCount = options?.length ?? 0;
    const flagReasons = [...(result.flagReasons ?? [])];
    if (optionCount < 2 || optionCount > 6) {
      flagReasons.push("invalid_option_count");
    }
    if (question.correctOptions.some((option) => option >= optionCount)) {
      flagReasons.push("answer_out_of_range");
    }

    const metadata: OcrMetadata = {
      ...question.ocrMetadata,
      status: flagReasons.length > 0 ? "needs_review" : result.status,
      textContent: result.textContent?.trim(),
      options,
      confidence: result.confidence,
      flagReasons: [...new Set(flagReasons)],
      rawText: result.rawText,
      providerVersion: result.providerVersion,
      completedAt: new Date().toISOString(),
      error: undefined,
    };

    await this.db
      .update(questions)
      .set({
        ocrMetadata: metadata,
        ...(optionCount >= 2 && optionCount <= 6
          ? { options: optionLabels(optionCount) }
          : {}),
      })
      .where(eq(questions.id, questionId));
  }

  async markOcrFailed(questionId: string, error: string): Promise<void> {
    const [question] = await this.db
      .select({ ocrMetadata: questions.ocrMetadata })
      .from(questions)
      .where(eq(questions.id, questionId))
      .limit(1);
    if (!question) return;

    await this.db
      .update(questions)
      .set({
        ocrMetadata: {
          ...question.ocrMetadata,
          status: "failed",
          error: error.slice(0, 1_000),
          completedAt: new Date().toISOString(),
        },
      })
      .where(eq(questions.id, questionId));
  }

  /**
   * Restores a failed in-flight job to pending so SQS can retry a transient
   * Textract, S3, or database failure. The worker only calls this before the
   * queue's final receive attempt.
   */
  async scheduleOcrRetry(questionId: string, error: string): Promise<void> {
    const [question] = await this.db
      .select({ ocrMetadata: questions.ocrMetadata })
      .from(questions)
      .where(eq(questions.id, questionId))
      .limit(1);
    if (!question) return;

    await this.db
      .update(questions)
      .set({
        ocrMetadata: {
          ...question.ocrMetadata,
          status: "pending",
          queuedAt: new Date().toISOString(),
          error: error.slice(0, 1_000),
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
        revisionId: questions.revisionId,
        order: questions.order,
        imageKey: questions.imageKey,
        imageHash: questions.imageHash,
        options: questions.options,
        correctOptions: questions.correctOptions,
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

    const presentationMode = revision.presentationMode as ExamPresentationMode;
    const questionStatuses: OcrQuestionStatus[] = questionsList.map(
      (question) => {
        const status = question.ocrMetadata?.status ?? "pending";
        if (status === "approved") ocrProgress.approved++;
        else if (status === "needs_review") ocrProgress.needsReview++;
        else if (status === "failed") ocrProgress.failed++;
        else ocrProgress.pending++;

        const row: OcrQuestionRow = question;
        return {
          questionId: question.id,
          order: question.order,
          ocrStatus: status,
          textContent: question.ocrMetadata?.textContent ?? null,
          options: question.ocrMetadata?.options ?? null,
          optionCount: question.ocrMetadata?.options?.length ?? 0,
          confidence: question.ocrMetadata?.confidence ?? null,
          flagReasons: question.ocrMetadata?.flagReasons ?? [],
          validationIssues:
            presentationMode === "text" ? validateTextQuestion(row) : [],
          imageUrl: question.imageKey,
          contentMode: resolveQuestionContentMode(
            presentationMode,
            question.ocrMetadata,
          ),
        };
      },
    );

    const canPublish =
      presentationMode === "image" ||
      presentationMode === "hybrid" ||
      questionStatuses.every(
        (question) => question.validationIssues.length === 0,
      );

    return {
      revisionId,
      presentationMode,
      ocrProgress,
      questions: questionStatuses,
      canPublish,
    };
  }

  async approveOcrQuestion(
    questionId: string,
    input: { textContent: string; options: string[] },
    userId: string,
  ): Promise<void> {
    const [question] = await this.db
      .select({ ocrMetadata: questions.ocrMetadata })
      .from(questions)
      .where(eq(questions.id, questionId))
      .limit(1);
    if (!question) throw new Error("Question not found");

    const options = input.options.map((option) => option.trim());
    await this.db
      .update(questions)
      .set({
        ocrMetadata: {
          ...question.ocrMetadata,
          status: "approved",
          contentMode: "text",
          textContent: input.textContent.trim(),
          options,
          flagReasons: [],
          error: undefined,
          completedAt: new Date().toISOString(),
          reviewedAt: new Date().toISOString(),
          reviewedBy: userId,
        },
        options: optionLabels(options.length),
      })
      .where(eq(questions.id, questionId));
  }

  /** Marks the result for manual attention. Image fallback is a revision-wide action. */
  async rejectOcrQuestion(questionId: string, userId: string): Promise<void> {
    const [question] = await this.db
      .select({ ocrMetadata: questions.ocrMetadata })
      .from(questions)
      .where(eq(questions.id, questionId))
      .limit(1);
    if (!question) throw new Error("Question not found");

    await this.db
      .update(questions)
      .set({
        ocrMetadata: {
          ...question.ocrMetadata,
          status: "needs_review",
          contentMode: "image",
          error: "Admin marked this OCR result as unsupported",
          flagReasons: [
            ...new Set([
              ...(question.ocrMetadata?.flagReasons ?? []),
              "admin_marked_unsupported",
            ]),
          ],
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
    const [question] = await this.db
      .select({
        id: questions.id,
        imageKey: questions.imageKey,
        imageHash: questions.imageHash,
        revisionId: questions.revisionId,
        ocrMetadata: questions.ocrMetadata,
      })
      .from(questions)
      .where(eq(questions.id, questionId))
      .limit(1);
    if (!question) throw new Error("Question not found");

    await this.db
      .update(questions)
      .set({
        ocrMetadata: {
          ...question.ocrMetadata,
          status: "pending",
          queuedAt: new Date().toISOString(),
          error: undefined,
        },
      })
      .where(eq(questions.id, questionId));

    return question;
  }

  async setExamPresentationMode(
    revisionId: string,
    mode: ExamPresentationMode,
  ): Promise<void> {
    await this.db
      .update(examRevisions)
      .set({ presentationMode: mode })
      .where(eq(examRevisions.id, revisionId));
  }

  async findCachedOcrByHash(
    imageHash: string,
    providerVersion: string,
    excludeQuestionId: string,
  ): Promise<OcrResult | null> {
    const candidates = await this.db
      .select({ id: questions.id, ocrMetadata: questions.ocrMetadata })
      .from(questions)
      .where(eq(questions.imageHash, imageHash))
      .orderBy(desc(questions.updatedAt))
      .limit(20);

    const cached = candidates.find(
      (question) =>
        question.id !== excludeQuestionId &&
        question.ocrMetadata?.providerVersion === providerVersion &&
        (question.ocrMetadata.status === "approved" ||
          question.ocrMetadata.status === "needs_review") &&
        Boolean(question.ocrMetadata.textContent) &&
        (question.ocrMetadata.options?.length ?? 0) >= 2,
    );

    if (!cached?.ocrMetadata) return null;
    return {
      status: cached.ocrMetadata.status as "approved" | "needs_review",
      textContent: cached.ocrMetadata.textContent,
      options: cached.ocrMetadata.options,
      confidence: cached.ocrMetadata.confidence,
      flagReasons: cached.ocrMetadata.flagReasons,
      rawText: cached.ocrMetadata.rawText,
      providerVersion: cached.ocrMetadata.providerVersion ?? providerVersion,
    };
  }
}

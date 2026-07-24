import {
  calculateScore,
  type Attempt,
  type AttemptLaunch,
  type AttemptResult,
  type SaveAnswerInput,
} from "@onthilab/contracts";
import { createHash, randomInt } from "node:crypto";
import { and, desc, eq, gt, isNotNull, sql } from "drizzle-orm";
import type { OnThiLabDatabase } from "./index";
import {
  attemptAnswers,
  attempts,
  courses,
  dailyUsage,
  examRevisions,
  exams,
  questions,
  subscriptions,
} from "./schema";
import type { AttemptSummary, StudentStatistics } from "@onthilab/contracts";

export type AttemptRepositoryErrorCode =
  | "ATTEMPT_CLOSED"
  | "ATTEMPT_EXPIRED"
  | "ATTEMPT_NOT_FOUND"
  | "DAILY_LIMIT_REACHED"
  | "EXAM_NOT_FOUND"
  | "QUESTION_NOT_FOUND";

export class AttemptRepositoryError extends Error {
  constructor(
    readonly code: AttemptRepositoryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AttemptRepositoryError";
  }
}

export interface AttemptRepository {
  createOrResume(input: {
    userId: string;
    examId: string;
    deviceId: string;
  }): Promise<AttemptLaunch>;
  listUserAttempts(userId: string): Promise<AttemptSummary[]>;
  findForUser(attemptId: string, userId: string): Promise<Attempt | null>;
  saveAnswer(input: {
    attemptId: string;
    userId: string;
    answer: SaveAnswerInput;
  }): Promise<{ savedAt: string; sequence: number }>;
  submit(input: {
    attemptId: string;
    userId: string;
    reason: "user" | "timeout";
  }): Promise<{ result: AttemptResult; idempotent: boolean }>;
  getStatistics(userId: string): Promise<StudentStatistics>;
}

function hashDeviceId(deviceId: string): string {
  return createHash("sha256").update(deviceId).digest("hex");
}

function usageDateInVietnam(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function shuffled<T>(values: readonly T[]): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = randomInt(index + 1);
    [result[index], result[target]] = [result[target]!, result[index]!];
  }
  return result;
}

export class PostgresAttemptRepository implements AttemptRepository {
  constructor(private readonly db: OnThiLabDatabase) {}

  async createOrResume(input: {
    userId: string;
    examId: string;
    deviceId: string;
  }): Promise<AttemptLaunch> {
    const now = new Date();
    const deviceIdHash = hashDeviceId(input.deviceId);
    const [active] = await this.db
      .select({ id: attempts.id, expiresAt: attempts.expiresAt })
      .from(attempts)
      .where(
        and(
          eq(attempts.userId, input.userId),
          eq(attempts.examId, input.examId),
          eq(attempts.deviceIdHash, deviceIdHash),
          eq(attempts.status, "in_progress"),
        ),
      )
      .orderBy(desc(attempts.startedAt))
      .limit(1);
    if (active && active.expiresAt.getTime() > now.getTime()) {
      const attempt = await this.findForUser(active.id, input.userId);
      if (attempt) return { attempt, resumed: true };
    }
    if (active) {
      await this.submit({
        attemptId: active.id,
        userId: input.userId,
        reason: "timeout",
      });
    }

    const attemptId = await this.db.transaction(async (transaction) => {
      const [exam] = await transaction
        .select({
          revisionId: examRevisions.id,
          durationMinutes: exams.durationMinutes,
          shuffleQuestions: exams.shuffleQuestions,
        })
        .from(exams)
        .innerJoin(examRevisions, eq(examRevisions.examId, exams.id))
        .where(
          and(
            eq(exams.id, input.examId),
            eq(exams.status, "published"),
            isNotNull(examRevisions.approvedAt),
          ),
        )
        .orderBy(desc(examRevisions.revision))
        .limit(1);
      if (!exam) {
        throw new AttemptRepositoryError(
          "EXAM_NOT_FOUND",
          "Không tìm thấy đề đã xuất bản.",
        );
      }

      const [activeSubscription] = await transaction
        .select({ id: subscriptions.id })
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.userId, input.userId),
            eq(subscriptions.status, "active"),
            gt(subscriptions.expiresAt, now),
          ),
        )
        .limit(1);
      const usageDate = usageDateInVietnam(now);
      if (!activeSubscription) {
        const [usage] = await transaction
          .select({ attemptsStarted: dailyUsage.attemptsStarted })
          .from(dailyUsage)
          .where(
            and(
              eq(dailyUsage.userId, input.userId),
              eq(dailyUsage.usageDate, usageDate),
            ),
          )
          .limit(1);
        if ((usage?.attemptsStarted ?? 0) >= 2) {
          throw new AttemptRepositoryError(
            "DAILY_LIMIT_REACHED",
            "Bạn đã dùng hết 2 lượt thi miễn phí hôm nay.",
          );
        }
      }

      const questionRows = await transaction
        .select({ id: questions.id })
        .from(questions)
        .where(eq(questions.revisionId, exam.revisionId))
        .orderBy(questions.order);
      if (questionRows.length === 0) {
        throw new AttemptRepositoryError(
          "EXAM_NOT_FOUND",
          "Đề chưa có câu hỏi.",
        );
      }
      const questionOrder = exam.shuffleQuestions
        ? shuffled(questionRows.map((question) => question.id))
        : questionRows.map((question) => question.id);
      const expiresAt = new Date(now.getTime() + exam.durationMinutes * 60_000);
      const [created] = await transaction
        .insert(attempts)
        .values({
          userId: input.userId,
          examId: input.examId,
          revisionId: exam.revisionId,
          deviceIdHash,
          questionOrder,
          startedAt: now,
          expiresAt,
        })
        .returning({ id: attempts.id });
      if (!created) throw new Error("Không thể tạo lượt thi.");

      if (!activeSubscription) {
        await transaction
          .insert(dailyUsage)
          .values({
            userId: input.userId,
            usageDate,
            attemptsStarted: 1,
          })
          .onConflictDoUpdate({
            target: [dailyUsage.userId, dailyUsage.usageDate],
            set: {
              attemptsStarted: sql`${dailyUsage.attemptsStarted} + 1`,
            },
          });
      }

      return created.id;
    });

    const attempt = await this.findForUser(attemptId, input.userId);
    if (!attempt) throw new Error("Không thể tải lượt thi vừa tạo.");
    return { attempt, resumed: false };
  }

  async listUserAttempts(userId: string): Promise<AttemptSummary[]> {
    const rows = await this.db
      .select({
        id: attempts.id,
        examId: exams.id,
        examCode: exams.code,
        courseCode: courses.code,
        status: attempts.status,
        startedAt: attempts.startedAt,
        submittedAt: attempts.submittedAt,
        correctCount: attempts.correctCount,
        score: attempts.score,
        questionOrder: attempts.questionOrder,
      })
      .from(attempts)
      .innerJoin(exams, eq(attempts.examId, exams.id))
      .innerJoin(courses, eq(exams.courseId, courses.id))
      .where(eq(attempts.userId, userId))
      .orderBy(desc(attempts.startedAt));

    return rows.map((row) => ({
      id: row.id,
      examId: row.examId,
      examCode: row.examCode,
      courseCode: row.courseCode,
      status: row.status,
      startedAt: row.startedAt.toISOString(),
      result:
        row.status === "submitted" || row.status === "auto_submitted"
          ? {
              attemptId: row.id,
              status: row.status as "submitted" | "auto_submitted",
              correctCount: row.correctCount ?? 0,
              questionCount: row.questionOrder.length,
              score: row.score ? Number.parseFloat(row.score) : 0,
              submittedAt:
                row.submittedAt?.toISOString() ?? new Date().toISOString(),
            }
          : null,
    }));
  }

  async findForUser(
    attemptId: string,
    userId: string,
  ): Promise<Attempt | null> {
    const [row] = await this.db
      .select({
        id: attempts.id,
        examId: attempts.examId,
        revisionId: attempts.revisionId,
        status: attempts.status,
        startedAt: attempts.startedAt,
        expiresAt: attempts.expiresAt,
        submittedAt: attempts.submittedAt,
        correctCount: attempts.correctCount,
        score: attempts.score,
        questionOrder: attempts.questionOrder,
      })
      .from(attempts)
      .where(and(eq(attempts.id, attemptId), eq(attempts.userId, userId)))
      .limit(1);
    if (!row) return null;
    if (row.status === "in_progress" && row.expiresAt.getTime() <= Date.now()) {
      await this.submit({
        attemptId: row.id,
        userId,
        reason: "timeout",
      });
      return this.findForUser(attemptId, userId);
    }

    const answerRows = await this.db
      .select({
        questionId: attemptAnswers.questionId,
        selectedOptions: attemptAnswers.selectedOptions,
      })
      .from(attemptAnswers)
      .where(eq(attemptAnswers.attemptId, row.id));
    const answers = Object.fromEntries(
      answerRows.map((answer) => [answer.questionId, answer.selectedOptions]),
    );
    const isSubmitted =
      row.status === "submitted" || row.status === "auto_submitted";
    let correctAnswers: Record<string, number[]> | undefined;
    if (isSubmitted) {
      const keyRows = await this.db
        .select({
          id: questions.id,
          correctOptions: questions.correctOptions,
        })
        .from(questions)
        .where(eq(questions.revisionId, row.revisionId));
      correctAnswers = Object.fromEntries(
        keyRows.map((question) => [question.id, question.correctOptions]),
      );
    }

    const result: AttemptResult | null =
      isSubmitted &&
      row.submittedAt &&
      row.correctCount !== null &&
      row.score !== null
        ? {
            attemptId: row.id,
            status:
              row.status === "auto_submitted" ? "auto_submitted" : "submitted",
            correctCount: row.correctCount,
            questionCount: row.questionOrder.length,
            score: Number(row.score),
            submittedAt: row.submittedAt.toISOString(),
          }
        : null;

    return {
      id: row.id,
      examId: row.examId,
      status: row.status,
      startedAt: row.startedAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      answers,
      questionOrder: row.questionOrder,
      result,
      ...(correctAnswers ? { correctAnswers } : {}),
    };
  }

  async saveAnswer(input: {
    attemptId: string;
    userId: string;
    answer: SaveAnswerInput;
  }): Promise<{ savedAt: string; sequence: number }> {
    return this.db.transaction(async (transaction) => {
      const [attempt] = await transaction
        .select({
          id: attempts.id,
          revisionId: attempts.revisionId,
          status: attempts.status,
          expiresAt: attempts.expiresAt,
        })
        .from(attempts)
        .where(
          and(
            eq(attempts.id, input.attemptId),
            eq(attempts.userId, input.userId),
          ),
        )
        .limit(1);
      if (!attempt) {
        throw new AttemptRepositoryError(
          "ATTEMPT_NOT_FOUND",
          "Không tìm thấy lượt thi.",
        );
      }
      if (attempt.status !== "in_progress") {
        throw new AttemptRepositoryError(
          "ATTEMPT_CLOSED",
          "Lượt thi đã kết thúc.",
        );
      }
      if (attempt.expiresAt.getTime() <= Date.now()) {
        throw new AttemptRepositoryError(
          "ATTEMPT_EXPIRED",
          "Lượt thi đã hết giờ.",
        );
      }

      const [question] = await transaction
        .select({
          id: questions.id,
          options: questions.options,
          type: questions.type,
        })
        .from(questions)
        .where(
          and(
            eq(questions.id, input.answer.questionId),
            eq(questions.revisionId, attempt.revisionId),
          ),
        )
        .limit(1);
      if (
        !question ||
        input.answer.selectedOptions.some(
          (option) => option >= question.options.length,
        ) ||
        (question.type === "single" && input.answer.selectedOptions.length > 1)
      ) {
        throw new AttemptRepositoryError(
          "QUESTION_NOT_FOUND",
          "Câu hỏi hoặc đáp án không hợp lệ.",
        );
      }

      const [current] = await transaction
        .select({ sequence: attemptAnswers.sequence })
        .from(attemptAnswers)
        .where(
          and(
            eq(attemptAnswers.attemptId, attempt.id),
            eq(attemptAnswers.questionId, question.id),
          ),
        )
        .limit(1);
      if (current && input.answer.sequence < current.sequence) {
        return {
          savedAt: new Date().toISOString(),
          sequence: current.sequence,
        };
      }

      const savedAt = new Date();
      await transaction
        .insert(attemptAnswers)
        .values({
          attemptId: attempt.id,
          questionId: question.id,
          selectedOptions: input.answer.selectedOptions,
          sequence: input.answer.sequence,
          answeredAt: savedAt,
        })
        .onConflictDoUpdate({
          target: [attemptAnswers.attemptId, attemptAnswers.questionId],
          set: {
            selectedOptions: input.answer.selectedOptions,
            sequence: input.answer.sequence,
            answeredAt: savedAt,
          },
        });

      return {
        savedAt: savedAt.toISOString(),
        sequence: input.answer.sequence,
      };
    });
  }

  async submit(input: {
    attemptId: string;
    userId: string;
    reason: "user" | "timeout";
  }): Promise<{ result: AttemptResult; idempotent: boolean }> {
    return this.db.transaction(async (transaction) => {
      const [attempt] = await transaction
        .select({
          id: attempts.id,
          revisionId: attempts.revisionId,
          status: attempts.status,
          submittedAt: attempts.submittedAt,
          correctCount: attempts.correctCount,
          score: attempts.score,
          questionOrder: attempts.questionOrder,
        })
        .from(attempts)
        .where(
          and(
            eq(attempts.id, input.attemptId),
            eq(attempts.userId, input.userId),
          ),
        )
        .limit(1);
      if (!attempt) {
        throw new AttemptRepositoryError(
          "ATTEMPT_NOT_FOUND",
          "Không tìm thấy lượt thi.",
        );
      }

      if (
        (attempt.status === "submitted" ||
          attempt.status === "auto_submitted") &&
        attempt.submittedAt &&
        attempt.correctCount !== null &&
        attempt.score !== null
      ) {
        return {
          result: {
            attemptId: attempt.id,
            status: attempt.status,
            correctCount: attempt.correctCount,
            questionCount: attempt.questionOrder.length,
            score: Number(attempt.score),
            submittedAt: attempt.submittedAt.toISOString(),
          },
          idempotent: true,
        };
      }
      if (attempt.status !== "in_progress") {
        throw new AttemptRepositoryError(
          "ATTEMPT_CLOSED",
          "Lượt thi đã kết thúc.",
        );
      }

      const [answerRows, keyRows] = await Promise.all([
        transaction
          .select({
            questionId: attemptAnswers.questionId,
            selectedOptions: attemptAnswers.selectedOptions,
          })
          .from(attemptAnswers)
          .where(eq(attemptAnswers.attemptId, attempt.id)),
        transaction
          .select({
            id: questions.id,
            correctOptions: questions.correctOptions,
          })
          .from(questions)
          .where(eq(questions.revisionId, attempt.revisionId)),
      ]);
      const answers = Object.fromEntries(
        answerRows.map((answer) => [answer.questionId, answer.selectedOptions]),
      );
      const answerKey = Object.fromEntries(
        keyRows.map((question) => [question.id, question.correctOptions]),
      );
      const score = calculateScore(answers, answerKey);
      const submittedAt = new Date();
      const status =
        input.reason === "timeout" ? "auto_submitted" : "submitted";
      await transaction
        .update(attempts)
        .set({
          status,
          submittedAt,
          correctCount: score.correctCount,
          score: score.score.toFixed(2),
          updatedAt: submittedAt,
        })
        .where(eq(attempts.id, attempt.id));

      return {
        result: {
          attemptId: attempt.id,
          status,
          ...score,
          submittedAt: submittedAt.toISOString(),
        },
        idempotent: false,
      };
    });
  }

  async getStatistics(userId: string): Promise<StudentStatistics> {
    const statsQuery = await this.db
      .select({
        totalAttempts: sql<number>`count(*)::integer`,
        averageScore: sql<number>`avg(${attempts.score})::numeric`,
        highestScore: sql<number>`max(${attempts.score})::numeric`,
      })
      .from(attempts)
      .where(and(eq(attempts.userId, userId), isNotNull(attempts.score)));

    const recent = await this.db
      .select({
        id: attempts.id,
        examCode: exams.code,
        score: attempts.score,
        submittedAt: attempts.submittedAt,
      })
      .from(attempts)
      .innerJoin(exams, eq(attempts.examId, exams.id))
      .where(and(eq(attempts.userId, userId), isNotNull(attempts.score)))
      .orderBy(desc(attempts.submittedAt))
      .limit(5);

    const stats = statsQuery[0];

    return {
      totalAttempts: stats?.totalAttempts ?? 0,
      averageScore:
        stats?.averageScore !== null ? Number(stats!.averageScore) : null,
      highestScore:
        stats?.highestScore !== null ? Number(stats!.highestScore) : null,
      recentAttempts: recent.map((r) => ({
        id: r.id,
        examCode: r.examCode,
        score: r.score !== null ? Number(r.score) : null,
        submittedAt: r.submittedAt?.toISOString() ?? null,
      })),
    };
  }
}

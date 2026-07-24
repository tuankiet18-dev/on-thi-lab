import {
  calculateScore,
  type Attempt,
  type AttemptLaunch,
  type AttemptResult,
  type SaveAnswerInput,
  type AttemptSummary,
  type StudentStatistics,
} from "@onthilab/contracts";
import {
  AttemptRepositoryError,
  type AttemptRepository,
} from "@onthilab/database";
import { demoAnswerKey, demoExam } from "./fixtures";

export class MemoryAttemptRepository implements AttemptRepository {
  private readonly attempts = new Map<string, Attempt>();
  private readonly owners = new Map<string, string>();
  private readonly activeAttemptIds = new Map<string, string>();

  async createOrResume(input: {
    userId: string;
    examId: string;
    deviceId: string;
  }): Promise<AttemptLaunch> {
    if (input.examId !== demoExam.id) {
      throw new AttemptRepositoryError(
        "EXAM_NOT_FOUND",
        "Không tìm thấy đề đã xuất bản.",
      );
    }
    const activeKey = `${input.userId}:${input.examId}:${input.deviceId}`;
    const activeId = this.activeAttemptIds.get(activeKey);
    const active = activeId ? this.attempts.get(activeId) : undefined;
    if (
      active &&
      active.status === "in_progress" &&
      Date.parse(active.expiresAt) > Date.now()
    ) {
      return { attempt: active, resumed: true };
    }

    const startedAt = new Date();
    const attempt: Attempt = {
      id: crypto.randomUUID(),
      examId: demoExam.id,
      status: "in_progress",
      startedAt: startedAt.toISOString(),
      expiresAt: new Date(
        startedAt.getTime() + demoExam.durationMinutes * 60_000,
      ).toISOString(),
      answers: {},
      questionOrder: demoExam.questions.map((question) => question.id),
      result: null,
    };
    this.attempts.set(attempt.id, attempt);
    this.owners.set(attempt.id, input.userId);
    this.activeAttemptIds.set(activeKey, attempt.id);
    return {
      attempt,
      resumed: false,
    };
  }

  async listUserAttempts(userId: string): Promise<AttemptSummary[]> {
    return Array.from(this.attempts.entries())
      .filter(([id, _]) => this.owners.get(id) === userId)
      .map(([_, attempt]) => ({
        id: attempt.id,
        examId: attempt.examId,
        examCode: "DEMO-FE",
        courseCode: "DEMO",
        status: attempt.status,
        startedAt: attempt.startedAt,
        result: attempt.result,
      }));
  }

  async findForUser(
    attemptId: string,
    userId: string,
  ): Promise<Attempt | null> {
    if (this.owners.get(attemptId) !== userId) return null;
    const attempt = this.attempts.get(attemptId);
    if (
      attempt?.status === "in_progress" &&
      Date.parse(attempt.expiresAt) <= Date.now()
    ) {
      await this.submit({ attemptId, userId, reason: "timeout" });
    }
    return attempt ?? null;
  }

  async saveAnswer(input: {
    attemptId: string;
    userId: string;
    answer: SaveAnswerInput;
  }): Promise<{ savedAt: string; sequence: number }> {
    const attempt = this.attempts.get(input.attemptId);
    if (!attempt || this.owners.get(input.attemptId) !== input.userId) {
      throw new AttemptRepositoryError(
        "ATTEMPT_NOT_FOUND",
        "Không tìm thấy lượt thi.",
      );
    }
    if (attempt.status !== "in_progress") {
      throw new AttemptRepositoryError("ATTEMPT_CLOSED", "Lượt thi đã đóng.");
    }
    attempt.answers[input.answer.questionId] = input.answer.selectedOptions;
    return {
      savedAt: new Date().toISOString(),
      sequence: input.answer.sequence,
    };
  }

  async submit(input: {
    attemptId: string;
    userId: string;
    reason: "user" | "timeout";
  }): Promise<{ result: AttemptResult; idempotent: boolean }> {
    const attempt = this.attempts.get(input.attemptId);
    if (!attempt || this.owners.get(input.attemptId) !== input.userId) {
      throw new AttemptRepositoryError(
        "ATTEMPT_NOT_FOUND",
        "Không tìm thấy lượt thi.",
      );
    }
    if (attempt.result) {
      return { result: attempt.result, idempotent: true };
    }
    const submittedAt = new Date().toISOString();
    const result: AttemptResult = {
      attemptId: attempt.id,
      status: input.reason === "timeout" ? "auto_submitted" : "submitted",
      ...calculateScore(attempt.answers, demoAnswerKey),
      submittedAt,
    };
    attempt.status = result.status;
    attempt.result = result;
    attempt.correctAnswers = demoAnswerKey;
    return { result, idempotent: false };
  }

  async getStatistics(userId: string): Promise<StudentStatistics> {
    const userAttempts = Array.from(this.attempts.values()).filter(
      (a) => this.owners.get(a.id) === userId && a.result?.score !== undefined,
    );

    const totalAttempts = userAttempts.length;
    const averageScore =
      totalAttempts > 0
        ? userAttempts.reduce((acc, a) => acc + (a.result?.score ?? 0), 0) /
          totalAttempts
        : null;
    const highestScore =
      totalAttempts > 0
        ? Math.max(...userAttempts.map((a) => a.result?.score ?? 0))
        : null;

    const recentAttempts = [...userAttempts]
      .sort(
        (a, b) =>
          new Date(b.expiresAt ?? 0).getTime() -
          new Date(a.expiresAt ?? 0).getTime(),
      )
      .slice(0, 5)
      .map((a) => ({
        id: a.id,
        examCode: "DEMO-FE",
        score: a.result?.score ?? null,
        submittedAt: a.expiresAt ?? null,
      }));

    return {
      totalAttempts,
      averageScore,
      highestScore,
      recentAttempts,
    };
  }
}

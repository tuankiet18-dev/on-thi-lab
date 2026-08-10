import type {
  CreateReportInput,
  Report,
  ResolveReportInput,
} from "@onthilab/contracts";
import { desc, eq } from "drizzle-orm";
import type { OnThiLabDatabase } from "./index";
import { reports, questions, examRevisions, exams, courses } from "./schema";

export type ReportRepositoryErrorCode =
  "REPORT_NOT_FOUND" | "QUESTION_NOT_FOUND";

export class ReportRepositoryError extends Error {
  constructor(
    readonly code: ReportRepositoryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ReportRepositoryError";
  }
}

export interface ReportRepository {
  createReport(input: {
    userId: string;
    questionId: string;
    attemptId?: string;
    report: CreateReportInput;
  }): Promise<Report>;
  listPendingReports(): Promise<Report[]>;
  resolveReport(input: {
    reportId: string;
    resolvedBy: string;
    resolution: ResolveReportInput;
  }): Promise<Report>;
}

export interface PostgresReportRepositoryOptions {
  imageUrlForKey?: (key: string) => string;
}

export class PostgresReportRepository implements ReportRepository {
  private readonly imageUrlForKey: (key: string) => string;

  constructor(
    private readonly db: OnThiLabDatabase,
    options?: PostgresReportRepositoryOptions,
  ) {
    this.imageUrlForKey = options?.imageUrlForKey ?? ((key) => key);
  }

  async createReport(input: {
    userId: string;
    questionId: string;
    attemptId?: string;
    report: CreateReportInput;
  }): Promise<Report> {
    const [question] = await this.db
      .select({ id: questions.id })
      .from(questions)
      .where(eq(questions.id, input.questionId))
      .limit(1);

    if (!question) {
      throw new ReportRepositoryError(
        "QUESTION_NOT_FOUND",
        "Question does not exist.",
      );
    }

    const [created] = await this.db
      .insert(reports)
      .values({
        userId: input.userId,
        questionId: input.questionId,
        attemptId: input.attemptId,
        category: input.report.category,
        detail: input.report.detail,
        status: "open",
      })
      .returning();

    if (!created) {
      throw new ReportRepositoryError(
        "REPORT_NOT_FOUND",
        "Failed to insert report.",
      );
    }

    return {
      id: created.id,
      userId: created.userId,
      questionId: created.questionId,
      attemptId: created.attemptId,
      category: created.category,
      detail: created.detail,
      status: created.status,
      resolution: created.resolution,
      resolvedBy: created.resolvedBy,
      resolvedAt: created.resolvedAt?.toISOString() ?? null,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  async listPendingReports(): Promise<Report[]> {
    const rows = await this.db
      .select({
        report: reports,
        question: questions,
        exam: exams,
        course: courses,
      })
      .from(reports)
      .innerJoin(questions, eq(reports.questionId, questions.id))
      .innerJoin(examRevisions, eq(questions.revisionId, examRevisions.id))
      .innerJoin(exams, eq(examRevisions.examId, exams.id))
      .innerJoin(courses, eq(exams.courseId, courses.id))
      .where(eq(reports.status, "open"))
      .orderBy(desc(reports.createdAt));

    return rows.map(({ report: row, question, exam, course }) => ({
      id: row.id,
      userId: row.userId,
      questionId: row.questionId,
      attemptId: row.attemptId,
      category: row.category,
      detail: row.detail,
      status: row.status,
      resolution: row.resolution,
      resolvedBy: row.resolvedBy,
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      question: {
        examCode: exam.code,
        courseCode: course.code,
        imageUrl: this.imageUrlForKey(question.imageKey),
        textContent: question.ocrMetadata?.textContent ?? null,
        options: question.options,
        correctOptions: question.correctOptions,
        type: question.type,
      },
    }));
  }

  async resolveReport(input: {
    reportId: string;
    resolvedBy: string;
    resolution: ResolveReportInput;
  }): Promise<Report> {
    return await this.db.transaction(async (tx) => {
      const [report] = await tx
        .select()
        .from(reports)
        .where(eq(reports.id, input.reportId))
        .limit(1);

      if (!report) {
        throw new ReportRepositoryError(
          "REPORT_NOT_FOUND",
          "Report does not exist.",
        );
      }

      if (
        input.resolution.status === "resolved" &&
        input.resolution.correctOptions
      ) {
        // Update the question's correct options directly
        await tx
          .update(questions)
          .set({ correctOptions: input.resolution.correctOptions })
          .where(eq(questions.id, report.questionId));
      }

      const [updated] = await tx
        .update(reports)
        .set({
          status: input.resolution.status,
          resolution: input.resolution.resolution,
          resolvedBy: input.resolvedBy,
          resolvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(reports.id, input.reportId))
        .returning();

      if (!updated) {
        throw new ReportRepositoryError(
          "REPORT_NOT_FOUND",
          "Failed to update report.",
        );
      }

      return {
        id: updated.id,
        userId: updated.userId,
        questionId: updated.questionId,
        attemptId: updated.attemptId,
        category: updated.category,
        detail: updated.detail,
        status: updated.status,
        resolution: updated.resolution,
        resolvedBy: updated.resolvedBy,
        resolvedAt: updated.resolvedAt?.toISOString() ?? null,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      };
    });
  }
}

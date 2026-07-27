import type { BookmarkCollection, ExamSummary } from "@onthilab/contracts";
import { and, count, desc, eq, isNotNull, max } from "drizzle-orm";
import type { OnThiLabDatabase } from "./index";
import {
  bookmarks,
  campuses,
  courses,
  examBookmarks,
  examRevisions,
  exams,
  questions,
} from "./schema";

export type BookmarkRepositoryErrorCode =
  "EXAM_NOT_FOUND" | "QUESTION_NOT_FOUND";

export class BookmarkRepositoryError extends Error {
  constructor(
    readonly code: BookmarkRepositoryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "BookmarkRepositoryError";
  }
}

export interface BookmarkRepository {
  listForUser(userId: string): Promise<BookmarkCollection>;
  saveExam(userId: string, examId: string): Promise<void>;
  removeExam(userId: string, examId: string): Promise<void>;
  saveQuestion(userId: string, questionId: string): Promise<void>;
  removeQuestion(userId: string, questionId: string): Promise<void>;
}

export interface PostgresBookmarkRepositoryOptions {
  imageUrlForKey?: (key: string) => string;
}

export class PostgresBookmarkRepository implements BookmarkRepository {
  private readonly imageUrlForKey: (key: string) => string;

  constructor(
    private readonly db: OnThiLabDatabase,
    options: PostgresBookmarkRepositoryOptions = {},
  ) {
    this.imageUrlForKey =
      options.imageUrlForKey ?? ((key) => `/question-images/${key}`);
  }

  async listForUser(userId: string): Promise<BookmarkCollection> {
    const latestApprovedRevision = this.db
      .select({
        examId: examRevisions.examId,
        revision: max(examRevisions.revision).as("latest_revision_number"),
      })
      .from(examRevisions)
      .where(isNotNull(examRevisions.approvedAt))
      .groupBy(examRevisions.examId)
      .as("latest_approved_revision");

    const savedExams = await this.db
      .select({
        id: exams.id,
        code: exams.code,
        courseCode: courses.code,
        courseName: courses.name,
        semester: exams.semester,
        campus: campuses.name,
        examType: exams.examType,
        isRetake: exams.isRetake,
        durationMinutes: exams.durationMinutes,
        publishedAt: exams.publishedAt,
        answerConfidence: examRevisions.answerConfidence,
        questionCount: count(questions.id),
        bookmarkedAt: examBookmarks.createdAt,
      })
      .from(examBookmarks)
      .innerJoin(exams, eq(examBookmarks.examId, exams.id))
      .innerJoin(courses, eq(exams.courseId, courses.id))
      .leftJoin(campuses, eq(exams.campusId, campuses.id))
      .innerJoin(
        latestApprovedRevision,
        eq(latestApprovedRevision.examId, exams.id),
      )
      .innerJoin(
        examRevisions,
        and(
          eq(examRevisions.examId, exams.id),
          eq(examRevisions.revision, latestApprovedRevision.revision),
        ),
      )
      .leftJoin(questions, eq(questions.revisionId, examRevisions.id))
      .where(
        and(eq(examBookmarks.userId, userId), eq(exams.status, "published")),
      )
      .groupBy(
        exams.id,
        courses.code,
        courses.name,
        campuses.name,
        examRevisions.answerConfidence,
        examBookmarks.createdAt,
      )
      .orderBy(desc(examBookmarks.createdAt));

    const savedQuestions = await this.db
      .select({
        questionId: questions.id,
        examId: exams.id,
        examCode: exams.code,
        courseCode: courses.code,
        courseName: courses.name,
        semester: exams.semester,
        campus: campuses.name,
        order: questions.order,
        imageKey: questions.imageKey,
        type: questions.type,
        options: questions.options,
        bookmarkedAt: bookmarks.createdAt,
      })
      .from(bookmarks)
      .innerJoin(questions, eq(bookmarks.questionId, questions.id))
      .innerJoin(examRevisions, eq(questions.revisionId, examRevisions.id))
      .innerJoin(exams, eq(examRevisions.examId, exams.id))
      .innerJoin(courses, eq(exams.courseId, courses.id))
      .leftJoin(campuses, eq(exams.campusId, campuses.id))
      .where(
        and(
          eq(bookmarks.userId, userId),
          eq(exams.status, "published"),
          isNotNull(examRevisions.approvedAt),
        ),
      )
      .orderBy(desc(bookmarks.createdAt));

    return {
      exams: savedExams.map((row) => ({
        id: row.id,
        code: row.code,
        courseCode: row.courseCode,
        courseName: row.courseName,
        semester: row.semester,
        campus: row.campus ?? "Tất cả campus",
        examType: row.examType,
        isRetake: row.isRetake,
        durationMinutes: row.durationMinutes,
        questionCount: row.questionCount,
        publishedAt: (row.publishedAt ?? new Date(0)).toISOString(),
        answerConfidence:
          row.answerConfidence === "verified" ? "verified" : "reviewed",
        bookmarkedAt: row.bookmarkedAt.toISOString(),
      })),
      questions: savedQuestions.map((row) => ({
        questionId: row.questionId,
        examId: row.examId,
        examCode: row.examCode,
        courseCode: row.courseCode,
        courseName: row.courseName,
        semester: row.semester,
        campus: row.campus ?? "Tất cả campus",
        order: row.order,
        imageUrl: this.imageUrlForKey(row.imageKey),
        imageAlt: `Ảnh câu hỏi ${row.order} của đề ${row.examCode}`,
        type: row.type,
        options: row.options,
        bookmarkedAt: row.bookmarkedAt.toISOString(),
      })),
    };
  }

  async saveExam(userId: string, examId: string): Promise<void> {
    const [exam] = await this.db
      .select({ id: exams.id })
      .from(exams)
      .where(and(eq(exams.id, examId), eq(exams.status, "published")))
      .limit(1);
    if (!exam) {
      throw new BookmarkRepositoryError(
        "EXAM_NOT_FOUND",
        "Published exam does not exist.",
      );
    }
    await this.db
      .insert(examBookmarks)
      .values({ userId, examId })
      .onConflictDoNothing();
  }

  async removeExam(userId: string, examId: string): Promise<void> {
    await this.db
      .delete(examBookmarks)
      .where(
        and(eq(examBookmarks.userId, userId), eq(examBookmarks.examId, examId)),
      );
  }

  async saveQuestion(userId: string, questionId: string): Promise<void> {
    const [question] = await this.db
      .select({ id: questions.id })
      .from(questions)
      .innerJoin(examRevisions, eq(questions.revisionId, examRevisions.id))
      .innerJoin(exams, eq(examRevisions.examId, exams.id))
      .where(
        and(
          eq(questions.id, questionId),
          eq(exams.status, "published"),
          isNotNull(examRevisions.approvedAt),
        ),
      )
      .limit(1);
    if (!question) {
      throw new BookmarkRepositoryError(
        "QUESTION_NOT_FOUND",
        "Published question does not exist.",
      );
    }
    await this.db
      .insert(bookmarks)
      .values({ userId, questionId })
      .onConflictDoNothing();
  }

  async removeQuestion(userId: string, questionId: string): Promise<void> {
    await this.db
      .delete(bookmarks)
      .where(
        and(eq(bookmarks.userId, userId), eq(bookmarks.questionId, questionId)),
      );
  }
}

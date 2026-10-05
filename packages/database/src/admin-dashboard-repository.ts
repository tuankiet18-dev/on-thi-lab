import type {
  AdminDashboard,
  AdminDashboardActionItem,
  AdminDashboardContentQuality,
  AdminDashboardQuickStats,
  AdminDashboardUsagePoint,
} from "@onthilab/contracts";
import {
  and,
  count,
  countDistinct,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  notExists,
  sql,
} from "drizzle-orm";
import type { OnThiLabDatabase } from "./index";
import {
  attempts,
  examRevisions,
  exams,
  feedback,
  questions,
  reports,
  users,
} from "./schema";

export interface AdminDashboardRepository {
  getDashboard(days: number): Promise<AdminDashboard>;
}

export class PostgresAdminDashboardRepository implements AdminDashboardRepository {
  constructor(private readonly db: OnThiLabDatabase) {}

  async getDashboard(days: number): Promise<AdminDashboard> {
    const asOf = new Date();
    const since = new Date(asOf.getTime() - days * 24 * 60 * 60 * 1000);

    const [quickStats, actionItems, usageTrend, contentQuality] =
      await Promise.all([
        this.#getQuickStats(since),
        this.#getActionItems(),
        this.#getUsageTrend(since, days),
        this.#getContentQuality(since),
      ]);

    return {
      asOf: asOf.toISOString(),
      days,
      quickStats,
      actionItems,
      usageTrend,
      contentQuality,
    };
  }

  async #getQuickStats(since: Date): Promise<AdminDashboardQuickStats> {
    const [
      pendingReviewRow,
      openReportsRow,
      newFeedbackRow,
      publishedExamsRow,
      completedAttemptsRow,
      activeUsersRow,
    ] = await Promise.all([
      this.db
        .select({ value: count() })
        .from(exams)
        .where(eq(exams.status, "review")),
      this.db
        .select({ value: count() })
        .from(reports)
        .where(eq(reports.status, "open")),
      this.db
        .select({ value: count() })
        .from(feedback)
        .where(eq(feedback.status, "new")),
      this.db
        .select({ value: count() })
        .from(exams)
        .where(eq(exams.status, "published")),
      this.db
        .select({ value: count() })
        .from(attempts)
        .where(
          and(
            inArray(attempts.status, ["submitted", "auto_submitted"]),
            gte(attempts.submittedAt, since),
          ),
        ),
      this.db
        .select({ value: countDistinct(attempts.userId) })
        .from(attempts)
        .where(gte(attempts.startedAt, since)),
    ]);

    return {
      pendingReview: Number(pendingReviewRow[0]?.value ?? 0),
      openReports: Number(openReportsRow[0]?.value ?? 0),
      newFeedback: Number(newFeedbackRow[0]?.value ?? 0),
      publishedExams: Number(publishedExamsRow[0]?.value ?? 0),
      completedAttempts: Number(completedAttemptsRow[0]?.value ?? 0),
      activeUsers: Number(activeUsersRow[0]?.value ?? 0),
    };
  }

  async #getActionItems(): Promise<AdminDashboardActionItem[]> {
    const items: AdminDashboardActionItem[] = [];

    // 1. Exams in "review" state (pending_publish) — up to 5 oldest
    const pendingPublish = await this.db
      .select({ id: exams.id, code: exams.code })
      .from(exams)
      .where(eq(exams.status, "review"))
      .orderBy(exams.createdAt)
      .limit(5);

    for (const exam of pendingPublish) {
      items.push({
        type: "pending_publish",
        examId: exam.id,
        examCode: exam.code,
        detail: `Đề ${exam.code} đang chờ xuất bản`,
      });
      if (items.length >= 5) return items;
    }

    // 2. Exams with questions missing answers (correctOptions is empty array [])
    // Only check latest revision per exam — join exams → examRevisions → questions
    const missingAnswers = await this.db
      .selectDistinct({ examId: exams.id, examCode: exams.code })
      .from(exams)
      .innerJoin(
        examRevisions,
        and(
          eq(examRevisions.examId, exams.id),
          inArray(exams.status, ["draft", "review"]),
        ),
      )
      .innerJoin(
        questions,
        and(
          eq(questions.revisionId, examRevisions.id),
          sql`jsonb_array_length(${questions.correctOptions}) = 0`,
        ),
      )
      .limit(5 - items.length);

    for (const row of missingAnswers) {
      if (items.length >= 5) break;
      items.push({
        type: "missing_answers",
        examId: row.examId,
        examCode: row.examCode,
        detail: `Đề ${row.examCode} còn câu chưa có đáp án`,
      });
    }

    // 3. OCR needs_review questions
    if (items.length < 5) {
      const ocrWarnings = await this.db
        .selectDistinct({ examId: exams.id, examCode: exams.code })
        .from(exams)
        .innerJoin(examRevisions, eq(examRevisions.examId, exams.id))
        .innerJoin(
          questions,
          and(
            eq(questions.revisionId, examRevisions.id),
            sql`${questions.ocrMetadata}->>'status' = 'needs_review'`,
          ),
        )
        .limit(5 - items.length);

      for (const row of ocrWarnings) {
        if (items.length >= 5) break;
        // Don't duplicate an item already added for missing_answers on the same exam
        if (items.some((i) => i.examId === row.examId)) continue;
        items.push({
          type: "ocr_warning",
          examId: row.examId,
          examCode: row.examCode,
          detail: `Đề ${row.examCode} có câu OCR cần kiểm tra lại`,
        });
      }
    }

    return items;
  }

  async #getUsageTrend(
    since: Date,
    days: number,
  ): Promise<AdminDashboardUsagePoint[]> {
    // Generate a series of date strings for the window so we always return
    // a complete list even on days with no activity
    const datePoints: AdminDashboardUsagePoint[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(since.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().slice(0, 10);
      datePoints.push({ date: dateStr, started: 0, completed: 0, newUsers: 0 });
    }
    // But keep it readable — cap at 30 data points to avoid rendering 90 tiny bars
    const step = days > 30 ? 3 : 1;
    const sampledPoints = datePoints.filter((_, idx) => idx % step === 0);

    // Batch: started per day
    const startedRows = await this.db
      .select({
        date: sql<string>`to_char(${attempts.startedAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
        value: count(),
      })
      .from(attempts)
      .where(gte(attempts.startedAt, since))
      .groupBy(
        sql`to_char(${attempts.startedAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
      );

    // Batch: completed per day
    const completedRows = await this.db
      .select({
        date: sql<string>`to_char(${attempts.submittedAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
        value: count(),
      })
      .from(attempts)
      .where(
        and(
          inArray(attempts.status, ["submitted", "auto_submitted"]),
          gte(attempts.submittedAt, since),
        ),
      )
      .groupBy(
        sql`to_char(${attempts.submittedAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
      );

    // Batch: new users per day
    const newUserRows = await this.db
      .select({
        date: sql<string>`to_char(${users.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
        value: count(),
      })
      .from(users)
      .where(gte(users.createdAt, since))
      .groupBy(
        sql`to_char(${users.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
      );

    const startedByDate = Object.fromEntries(
      startedRows.map((r) => [r.date, Number(r.value)]),
    );
    const completedByDate = Object.fromEntries(
      completedRows.map((r) => [r.date, Number(r.value)]),
    );
    const newUsersByDate = Object.fromEntries(
      newUserRows.map((r) => [r.date, Number(r.value)]),
    );

    return sampledPoints.map((pt) => ({
      ...pt,
      started: startedByDate[pt.date] ?? 0,
      completed: completedByDate[pt.date] ?? 0,
      newUsers: newUsersByDate[pt.date] ?? 0,
    }));
  }

  async #getContentQuality(since: Date): Promise<AdminDashboardContentQuality> {
    const [reportsByCategoryRows, topExamsRows, unpopularExamsRows] =
      await Promise.all([
        // Reports by category (open only)
        this.db
          .select({ category: reports.category, value: count() })
          .from(reports)
          .where(eq(reports.status, "open"))
          .groupBy(reports.category)
          .orderBy(desc(count()))
          .limit(10),

        // Top exams by attempts in window
        this.db
          .select({
            examId: exams.id,
            examCode: exams.code,
            value: count(attempts.id),
          })
          .from(exams)
          .innerJoin(attempts, eq(attempts.examId, exams.id))
          .where(gte(attempts.startedAt, since))
          .groupBy(exams.id, exams.code)
          .orderBy(desc(count(attempts.id)))
          .limit(5),

        // Published exams with zero attempts in window
        this.db
          .select({
            examId: exams.id,
            examCode: exams.code,
            publishedAt: exams.publishedAt,
          })
          .from(exams)
          .where(
            and(
              eq(exams.status, "published"),
              notExists(
                this.db
                  .select({ _: sql<number>`1` })
                  .from(attempts)
                  .where(
                    and(
                      eq(attempts.examId, exams.id),
                      gte(attempts.startedAt, since),
                    ),
                  ),
              ),
            ),
          )
          .limit(5),
      ]);

    return {
      reportsByCategory: reportsByCategoryRows.map((r) => ({
        category: r.category,
        count: Number(r.value),
      })),
      topExams: topExamsRows.map((r) => ({
        examId: r.examId,
        examCode: r.examCode,
        attempts: Number(r.value),
      })),
      unpopularExams: unpopularExamsRows
        .filter((r) => r.publishedAt !== null)
        .map((r) => ({
          examId: r.examId,
          examCode: r.examCode,
          publishedAt: r.publishedAt!.toISOString(),
        })),
    };
  }
}

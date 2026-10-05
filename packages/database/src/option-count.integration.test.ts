import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { expect, it } from "vitest";
import { createDatabaseConnection } from "./index";
import { PostgresDraftImportRepository } from "./draft-import-repository";
import { PostgresOcrRepository } from "./ocr-repository";
import {
  campuses,
  courses,
  examRevisions,
  exams,
  questions,
  users,
} from "./schema";

const databaseUrl = process.env.TEST_DATABASE_URL;

it.skipIf(!databaseUrl)(
  "retries failed checks and protects manual options from concurrent OCR",
  async () => {
    const connection = createDatabaseConnection(databaseUrl!);
    const { db } = connection;
    const suffix = randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase();
    const courseCode = `T${suffix}`;
    const userId = randomUUID();
    let examId: string | undefined;
    let revisionId: string | undefined;
    let courseId: string | undefined;
    let campusId: string | undefined;

    try {
      const [campus] = await db
        .insert(campuses)
        .values({ code: `C${suffix}`, name: "OCR integration test" })
        .returning({ id: campuses.id });
      campusId = campus!.id;
      const [course] = await db
        .insert(courses)
        .values({ code: courseCode, name: "OCR integration test" })
        .returning({ id: courses.id });
      courseId = course!.id;
      await db.insert(users).values({
        id: userId,
        cognitoSubject: userId,
        email: `${suffix.toLowerCase()}@example.invalid`,
        fullName: "OCR integration test",
        role: "admin",
      });
      const [exam] = await db
        .insert(exams)
        .values({
          code: `${courseCode}-SP26-FE`,
          courseId,
          campusId,
          semester: "SP26",
          examType: "FE",
          durationMinutes: 90,
          status: "draft",
          createdBy: userId,
        })
        .returning({ id: exams.id });
      examId = exam!.id;
      const [revision] = await db
        .insert(examRevisions)
        .values({ examId, revision: 1, presentationMode: "hybrid" })
        .returning({ id: examRevisions.id });
      revisionId = revision!.id;
      const inserted = await db
        .insert(questions)
        .values(
          [1, 2].map((order) => ({
            revisionId: revisionId!,
            order,
            imageKey: `drafts/integration/Q${order}.jpg`,
            imageHash: String(order).repeat(64),
            type: "single" as const,
            options: ["A", "B", "C", "D"],
            correctOptions: [0],
          })),
        )
        .returning({ id: questions.id, order: questions.order });
      const first = inserted.find((question) => question.order === 1)!;
      const second = inserted.find((question) => question.order === 2)!;
      const reviewRepository = new PostgresDraftImportRepository(db);
      const ocrRepository = new PostgresOcrRepository(db);

      const initialJobs =
        await reviewRepository.queueOptionCountJobs(revisionId);
      expect(initialJobs).toHaveLength(2);
      const oldJob = initialJobs.find((job) => job.id === first.id)!;
      await reviewRepository.markOptionCountQueueFailed(
        [first.id],
        "Transient queue failure",
        oldJob.queuedAt,
      );
      await db
        .update(questions)
        .set({
          optionCountCheck: {
            status: "manual",
            detectedCount: null,
            labels: [],
            confidence: null,
            reason: null,
          },
        })
        .where(eq(questions.id, second.id));

      const retriedJobs = await reviewRepository.queueOptionCountJobs(
        revisionId,
        true,
      );
      expect(retriedJobs.map((job) => job.id)).toEqual([first.id]);
      expect(retriedJobs[0]?.queuedAt).not.toBe(oldJob.queuedAt);
      await reviewRepository.markOptionCountQueueFailed(
        [first.id],
        "Late failure from the previous send",
        oldJob.queuedAt,
      );
      const [afterLateFailure] = await db
        .select({ optionCountCheck: questions.optionCountCheck })
        .from(questions)
        .where(eq(questions.id, first.id));
      expect(afterLateFailure!.optionCountCheck?.status).toBe("pending");
      expect(
        await reviewRepository.queueOptionCountJobs(revisionId, true),
      ).toHaveLength(0);
      await db
        .update(questions)
        .set({
          optionCountCheck: {
            status: "pending",
            detectedCount: null,
            labels: [],
            confidence: null,
            reason: null,
            queuedAt: new Date(Date.now() - 16 * 60_000).toISOString(),
          },
        })
        .where(eq(questions.id, first.id));
      const timedOutJobs = await reviewRepository.queueOptionCountJobs(
        revisionId,
        true,
      );
      expect(timedOutJobs.map((job) => job.id)).toEqual([first.id]);
      expect(timedOutJobs[0]!.queuedAt).not.toBe(oldJob.queuedAt);

      await db
        .update(questions)
        .set({ ocrMetadata: { status: "processing" } })
        .where(eq(questions.id, first.id));
      await ocrRepository.saveOcrResult(first.id, {
        status: "approved",
        textContent: "Question text",
        options: ["one", "two", "three", "four", "five"],
        confidence: 0.99,
        providerVersion: "integration-test",
      });
      const [afterAutomaticOcr] = await db
        .select({
          options: questions.options,
          ocrMetadata: questions.ocrMetadata,
        })
        .from(questions)
        .where(eq(questions.id, first.id));
      expect(afterAutomaticOcr!.options).toEqual(["A", "B", "C", "D"]);
      expect(afterAutomaticOcr!.ocrMetadata?.status).toBe("needs_review");
      expect(afterAutomaticOcr!.ocrMetadata?.flagReasons).toContain(
        "option_count_conflict",
      );

      await ocrRepository.approveOcrQuestion(
        first.id,
        {
          textContent: "Question text",
          options: ["one", "two", "three", "four", "five"],
        },
        userId,
      );
      await ocrRepository.saveOcrResult(first.id, {
        status: "approved",
        textContent: "Stale result",
        options: ["one", "two"],
        providerVersion: "stale-result",
      });
      const [afterManualReview] = await db
        .select({
          options: questions.options,
          optionCountCheck: questions.optionCountCheck,
          ocrMetadata: questions.ocrMetadata,
        })
        .from(questions)
        .where(eq(questions.id, first.id));
      expect(afterManualReview!.options).toEqual(["A", "B", "C", "D", "E"]);
      expect(afterManualReview!.optionCountCheck?.status).toBe("manual");
      expect(afterManualReview!.ocrMetadata?.textContent).toBe("Question text");

      await ocrRepository.markOcrFailed(first.id, "Late OCR failure");
      await ocrRepository.scheduleOcrRetry(first.id, "Late OCR retry");
      const [afterLateOcrError] = await db
        .select({ ocrMetadata: questions.ocrMetadata })
        .from(questions)
        .where(eq(questions.id, first.id));
      expect(afterLateOcrError!.ocrMetadata?.status).toBe("approved");

      await db
        .update(questions)
        .set({
          ocrMetadata: { status: "processing" },
          optionCountCheck: {
            status: "failed",
            detectedCount: null,
            labels: [],
            confidence: null,
            reason: "Temporary test failure",
          },
        })
        .where(eq(questions.id, second.id));
      await Promise.all([
        reviewRepository.queueOptionCountJobs(revisionId, true),
        reviewRepository.markReady(examId, userId),
      ]);
      expect(
        await reviewRepository.queueOptionCountJobs(revisionId, true),
      ).toHaveLength(0);
      const [afterConcurrentReview] = await db
        .select({ optionCountCheck: questions.optionCountCheck })
        .from(questions)
        .where(eq(questions.id, second.id));
      expect(afterConcurrentReview!.optionCountCheck?.status).not.toBe(
        "pending",
      );
      await ocrRepository.saveOcrResult(second.id, {
        status: "approved",
        textContent: "Result after review completed",
        options: ["one", "two"],
        providerVersion: "late-result",
      });
      const [afterReviewCompleted] = await db
        .select({
          options: questions.options,
          ocrMetadata: questions.ocrMetadata,
        })
        .from(questions)
        .where(eq(questions.id, second.id));
      expect(afterReviewCompleted!.options).toEqual(["A", "B", "C", "D"]);
      expect(afterReviewCompleted!.ocrMetadata?.status).toBe("processing");
    } finally {
      if (revisionId) {
        await db.delete(questions).where(eq(questions.revisionId, revisionId));
        await db.delete(examRevisions).where(eq(examRevisions.id, revisionId));
      }
      if (examId) await db.delete(exams).where(eq(exams.id, examId));
      await db.delete(users).where(eq(users.id, userId));
      if (courseId) await db.delete(courses).where(eq(courses.id, courseId));
      if (campusId) await db.delete(campuses).where(eq(campuses.id, campusId));
      await connection.close();
    }
  },
);

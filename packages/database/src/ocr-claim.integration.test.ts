import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { expect, it } from "vitest";
import { createDatabaseConnection } from "./index";
import { PostgresDraftImportRepository } from "./draft-import-repository";
import {
  OCR_STALE_PROCESSING_MS,
  PostgresOcrRepository,
} from "./ocr-repository";
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
  "claims OCR jobs atomically, reclaims stale ones, and skips trusted option counts",
  async () => {
    const connection = createDatabaseConnection(databaseUrl!);
    const { db } = connection;
    const suffix = randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase();
    const userId = randomUUID();
    let examId: string | undefined;
    let revisionId: string | undefined;
    let courseId: string | undefined;
    let campusId: string | undefined;

    try {
      const [campus] = await db
        .insert(campuses)
        .values({ code: `C${suffix}`, name: "OCR claim test" })
        .returning({ id: campuses.id });
      campusId = campus!.id;
      const [course] = await db
        .insert(courses)
        .values({ code: `T${suffix}`, name: "OCR claim test" })
        .returning({ id: courses.id });
      courseId = course!.id;
      await db.insert(users).values({
        id: userId,
        cognitoSubject: userId,
        email: `${suffix.toLowerCase()}@example.invalid`,
        fullName: "OCR claim test",
        role: "admin",
      });
      const [exam] = await db
        .insert(exams)
        .values({
          code: `T${suffix}-SP26-FE`,
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
          [1, 2, 3].map((order) => ({
            revisionId: revisionId!,
            order,
            imageKey: `drafts/claim/Q${order}.jpg`,
            imageHash: String(order).repeat(64),
            type: "single" as const,
            options: ["A", "B", "C", "D"],
            correctOptions: [],
          })),
        )
        .returning({ id: questions.id, order: questions.order });
      const byOrder = (order: number) =>
        inserted.find((question) => question.order === order)!.id;
      const ocr = new PostgresOcrRepository(db);
      const startedAgo = (ms: number) =>
        new Date(Date.now() - ms).toISOString();
      const setOcr = (
        id: string,
        status: "pending" | "processing",
        startedAt?: string,
      ) =>
        db
          .update(questions)
          .set({ ocrMetadata: { status, ...(startedAt ? { startedAt } : {}) } })
          .where(eq(questions.id, id));

      // pending is claimable exactly once.
      const first = byOrder(1);
      await setOcr(first, "pending");
      expect(await ocr.claimOcrJob(first, revisionId)).toBe(true);
      expect(await ocr.claimOcrJob(first, revisionId)).toBe(false);

      // A recent processing job belongs to a live worker.
      await setOcr(
        first,
        "processing",
        startedAgo(OCR_STALE_PROCESSING_MS - 30_000),
      );
      expect(await ocr.claimOcrJob(first, revisionId)).toBe(false);

      // A job left behind by a timed-out worker can be reclaimed, but only once
      // even when two redeliveries race.
      await setOcr(
        first,
        "processing",
        startedAgo(OCR_STALE_PROCESSING_MS + 1_000),
      );
      const results = await Promise.all([
        ocr.claimOcrJob(first, revisionId),
        ocr.claimOcrJob(first, revisionId),
      ]);
      expect(results.filter(Boolean)).toHaveLength(1);
      const [reclaimed] = await db
        .select({ ocrMetadata: questions.ocrMetadata })
        .from(questions)
        .where(eq(questions.id, first));
      expect(reclaimed!.ocrMetadata?.status).toBe("processing");
      expect(reclaimed!.ocrMetadata?.attemptCount).toBe(1);

      // Questions whose packager already counted the choices are not re-OCRed.
      const second = byOrder(2);
      await db
        .update(questions)
        .set({
          aiMetadata: {
            status: "suggested",
            provider: "community-comments",
            optionCount: 4,
            optionCountConfidence: 0.95,
            optionCountSource: "ocr",
          },
        })
        .where(eq(questions.id, second));
      const jobs = await new PostgresDraftImportRepository(
        db,
      ).queueOptionCountJobs(revisionId);
      expect(jobs.map((job) => job.id).sort()).toEqual(
        [first, byOrder(3)].sort(),
      );
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

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { expect, it } from "vitest";
import { createDatabaseConnection } from "./index";
import {
  DraftImportRepositoryError,
  PostgresDraftImportRepository,
} from "./draft-import-repository";
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
  "re-imports a cancelled exam as a new revision but rejects live duplicates",
  async () => {
    const connection = createDatabaseConnection(databaseUrl!);
    const { db } = connection;
    const suffix = randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
    const courseCode = `R${suffix}`;
    const userId = randomUUID();
    let courseId: string | undefined;
    let campusId: string | undefined;
    let examId: string | undefined;

    const draftInput = (hashSeed: string) => ({
      courseCode,
      campusCode: `C${suffix}`,
      semester: "SU24",
      examType: "FE" as const,
      isRetake: false,
      durationMinutes: 60,
      extractText: false,
      createdBy: userId,
      questions: [1, 2].map((order) => ({
        order,
        imageKey: `drafts/${hashSeed}/Q${order}.jpg`,
        imageHash: `${hashSeed}${order}`.padEnd(64, "0"),
        optionCount: 4,
      })),
    });

    try {
      const [campus] = await db
        .insert(campuses)
        .values({ code: `C${suffix}`, name: "Reimport test" })
        .returning({ id: campuses.id });
      campusId = campus!.id;
      const [course] = await db
        .insert(courses)
        .values({ code: courseCode, name: "Reimport test" })
        .returning({ id: courses.id });
      courseId = course!.id;
      await db.insert(users).values({
        id: userId,
        cognitoSubject: userId,
        email: `${suffix.toLowerCase()}@example.invalid`,
        fullName: "Reimport test",
        role: "admin",
      });
      const repository = new PostgresDraftImportRepository(db);

      const first = await repository.createDraft(draftInput("a"));
      examId = first.examId;

      // A live exam (draft or published) cannot be imported again.
      await expect(
        repository.createDraft(draftInput("b")),
      ).rejects.toMatchObject({ code: "EXAM_ALREADY_EXISTS" });
      await db
        .update(exams)
        .set({ status: "published", publishedAt: new Date() })
        .where(eq(exams.id, examId));
      await expect(
        repository.createDraft(draftInput("b")),
      ).rejects.toBeInstanceOf(DraftImportRepositoryError);

      // Deleting a published exam cancels it; importing again revives it.
      await repository.deleteExam(examId);
      const [cancelled] = await db
        .select({ status: exams.status })
        .from(exams)
        .where(eq(exams.id, examId));
      expect(cancelled!.status).toBe("cancelled");

      const second = await repository.createDraft({
        ...draftInput("c"),
        durationMinutes: 75,
      });
      expect(second.examId).toBe(examId);
      expect(second.status).toBe("draft");
      expect(second.revisionId).not.toBe(first.revisionId);

      const revisions = await db
        .select({ id: examRevisions.id, revision: examRevisions.revision })
        .from(examRevisions)
        .where(eq(examRevisions.examId, examId));
      expect(revisions.map((row) => row.revision).sort()).toEqual([1, 2]);
      const [revived] = await db
        .select({
          status: exams.status,
          duration: exams.durationMinutes,
          publishedAt: exams.publishedAt,
        })
        .from(exams)
        .where(eq(exams.id, examId));
      expect(revived).toEqual({
        status: "draft",
        duration: 75,
        publishedAt: null,
      });
      // The first revision keeps its own questions.
      const oldQuestions = await db
        .select({ id: questions.id })
        .from(questions)
        .where(eq(questions.revisionId, first.revisionId));
      expect(oldQuestions).toHaveLength(2);

      // The revived draft is a live exam again.
      await expect(
        repository.createDraft(draftInput("d")),
      ).rejects.toMatchObject({ code: "EXAM_ALREADY_EXISTS" });
    } finally {
      if (examId) {
        const revisionIds = (
          await db
            .select({ id: examRevisions.id })
            .from(examRevisions)
            .where(eq(examRevisions.examId, examId))
        ).map((row) => row.id);
        for (const id of revisionIds) {
          await db.delete(questions).where(eq(questions.revisionId, id));
        }
        await db.delete(examRevisions).where(eq(examRevisions.examId, examId));
        await db.delete(exams).where(eq(exams.id, examId));
      }
      await db.delete(users).where(eq(users.id, userId));
      if (courseId) await db.delete(courses).where(eq(courses.id, courseId));
      if (campusId) await db.delete(campuses).where(eq(campuses.id, campusId));
      await connection.close();
    }
  },
);

import type {
  CreateDraftImportInput,
  DraftImportResult,
} from "@onthilab/contracts";
import { eq, ilike } from "drizzle-orm";
import type { OnThiLabDatabase } from "./index";
import { campuses, courses, examRevisions, exams, questions } from "./schema";

export interface DraftQuestionInput {
  order: number;
  imageKey: string;
  imageHash: string;
  optionCount: number;
}

export interface CreateDraftExamInput extends CreateDraftImportInput {
  createdBy: string;
  questions: DraftQuestionInput[];
}

export type DraftImportRepositoryErrorCode =
  "CAMPUS_NOT_FOUND" | "COURSE_NOT_FOUND" | "EXAM_ALREADY_EXISTS";

export class DraftImportRepositoryError extends Error {
  constructor(
    readonly code: DraftImportRepositoryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DraftImportRepositoryError";
  }
}

export interface DraftImportRepository {
  createDraft(input: CreateDraftExamInput): Promise<DraftImportResult>;
}

export function buildExamCode(
  input: Pick<
    CreateDraftImportInput,
    "courseCode" | "semester" | "examType" | "isRetake"
  >,
): string {
  return [
    input.courseCode.toUpperCase(),
    input.semester.toUpperCase(),
    input.examType,
    ...(input.isRetake ? ["RETAKE"] : []),
  ].join("-");
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

export class PostgresDraftImportRepository implements DraftImportRepository {
  constructor(private readonly db: OnThiLabDatabase) {}

  async createDraft(input: CreateDraftExamInput): Promise<DraftImportResult> {
    const examCode = buildExamCode(input);

    try {
      return await this.db.transaction(async (transaction) => {
        const [[course], [campus]] = await Promise.all([
          transaction
            .select({ id: courses.id })
            .from(courses)
            .where(ilike(courses.code, input.courseCode))
            .limit(1),
          transaction
            .select({ id: campuses.id })
            .from(campuses)
            .where(eq(campuses.code, input.campusCode))
            .limit(1),
        ]);

        if (!course) {
          throw new DraftImportRepositoryError(
            "COURSE_NOT_FOUND",
            `Không tìm thấy môn ${input.courseCode}.`,
          );
        }
        if (!campus) {
          throw new DraftImportRepositoryError(
            "CAMPUS_NOT_FOUND",
            `Không tìm thấy campus ${input.campusCode}.`,
          );
        }

        const [exam] = await transaction
          .insert(exams)
          .values({
            code: examCode,
            courseId: course.id,
            campusId: campus.id,
            semester: input.semester,
            examType: input.examType,
            isRetake: input.isRetake,
            durationMinutes: input.durationMinutes,
            shuffleQuestions: true,
            status: "draft",
            createdBy: input.createdBy,
          })
          .returning({ id: exams.id });
        if (!exam) throw new Error("Không thể tạo đề thi nháp.");

        const [revision] = await transaction
          .insert(examRevisions)
          .values({
            examId: exam.id,
            revision: 1,
            note: "Nhập từ ZIP ảnh câu hỏi",
            answerConfidence: "reviewed",
          })
          .returning({ id: examRevisions.id });
        if (!revision) throw new Error("Không thể tạo phiên bản đề thi.");

        await transaction.insert(questions).values(
          input.questions.map((question) => ({
            revisionId: revision.id,
            order: question.order,
            imageKey: question.imageKey,
            imageHash: question.imageHash,
            type: "single" as const,
            options: Array.from({ length: question.optionCount }, (_, index) =>
              String.fromCharCode(65 + index),
            ),
            correctOptions: [],
          })),
        );

        return {
          examId: exam.id,
          revisionId: revision.id,
          examCode,
          questionCount: input.questions.length,
          status: "draft",
        };
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DraftImportRepositoryError(
          "EXAM_ALREADY_EXISTS",
          `Đề ${examCode} đã tồn tại.`,
        );
      }
      throw error;
    }
  }
}

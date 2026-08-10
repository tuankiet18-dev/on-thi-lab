import type {
  AiAnswerSuggestion,
  ConfirmTrustedSuggestionsResult,
  CreateDraftImportInput,
  DraftExamReview,
  DraftImportResult,
  PublishExamResult,
  ReviewQuestion,
  ReviewReadinessResult,
  UpdateQuestionAnswerInput,
} from "@onthilab/contracts";
import { and, asc, desc, eq, ilike, inArray } from "drizzle-orm";
import type { OnThiLabDatabase } from "./index";
import {
  campuses,
  courses,
  examRevisions,
  exams,
  questionAnswerAudits,
  questions,
  users,
} from "./schema";

export interface DraftQuestionInput {
  order: number;
  imageKey: string;
  imageHash: string;
  type?: "single" | "multiple";
  optionCount: number;
  correctOptions?: number[];
  aiMetadata?: any;
}

export interface CreateDraftExamInput extends CreateDraftImportInput {
  createdBy: string;
  questions: DraftQuestionInput[];
}

export type DraftImportRepositoryErrorCode =
  | "ANSWERS_INCOMPLETE"
  | "CAMPUS_NOT_FOUND"
  | "COURSE_NOT_FOUND"
  | "EXAM_ALREADY_EXISTS"
  | "EXAM_NOT_EDITABLE"
  | "EXAM_NOT_FOUND"
  | "EXAM_NOT_READY"
  | "QUESTION_NOT_FOUND"
  | "DUPLICATE_IMAGES";

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

export type StoredReviewQuestion = Omit<ReviewQuestion, "imageUrl"> & {
  imageKey: string;
};

export type StoredDraftExamReview = Omit<DraftExamReview, "questions"> & {
  questions: StoredReviewQuestion[];
};

export interface AdminExamSummary {
  id: string;
  code: string;
  courseCode: string;
  semester: string;
  status: string;
  creatorName: string;
  createdAt: Date;
}

export interface ExamReviewRepository {
  findDrafts(): Promise<AdminExamSummary[]>;
  findAllExams(): Promise<AdminExamSummary[]>;
  deleteExam(examId: string): Promise<void>;
  findReview(examId: string): Promise<StoredDraftExamReview | null>;
  saveAnswer(input: {
    examId: string;
    questionId: string;
    changedBy: string;
    answer: UpdateQuestionAnswerInput;
  }): Promise<StoredReviewQuestion>;
  confirmTrustedSuggestions(
    examId: string,
    changedBy: string,
  ): Promise<ConfirmTrustedSuggestionsResult>;
  markReady(examId: string, changedBy: string): Promise<ReviewReadinessResult>;
  publish(examId: string, approvedBy: string): Promise<PublishExamResult>;
}

export interface AiSuggestionJob {
  examId: string;
  questionId: string;
  imageKey: string;
  courseCode: string;
  optionCount: number;
}

export interface AiAnswerProposalInput {
  proposedType: "single" | "multiple";
  optionCount: number;
  proposedAnswers: number[];
  confidence: number;
  provider: string;
  model: string;
  rationale?: string;
  raw?: unknown;
}

export interface AiSuggestionRepository {
  queueUnanswered(examId: string): Promise<{
    jobs: AiSuggestionJob[];
    skippedCount: number;
  }>;
  queueQuestion(
    examId: string,
    questionId: string,
  ): Promise<{
    jobs: AiSuggestionJob[];
    skippedCount: number;
  }>;
  markProcessing(questionId: string): Promise<void>;
  saveSuggestion(
    questionId: string,
    proposal: AiAnswerProposalInput,
  ): Promise<void>;
  markFailed(questionId: string, message: string): Promise<void>;
}

type QuestionAiMetadata = typeof questions.$inferSelect.aiMetadata;

export interface TrustedSuggestionAnswer {
  type: "single" | "multiple";
  optionCount: number;
  correctOptions: number[];
}

/**
 * Only community answers with an unambiguous consensus and a trusted option
 * count may be confirmed in bulk. AI suggestions always remain manual.
 */
export function trustedCommunitySuggestion(
  metadata: QuestionAiMetadata,
): TrustedSuggestionAnswer | null {
  const optionCount = metadata?.optionCount;
  if (
    metadata?.status !== "suggested" ||
    metadata.provider !== "community-comments" ||
    metadata.requiresReview !== false ||
    typeof metadata.optionCountConfidence !== "number" ||
    metadata.optionCountConfidence < 0.82 ||
    !metadata.optionCountSource ||
    (metadata.proposedType !== "single" &&
      metadata.proposedType !== "multiple") ||
    typeof optionCount !== "number" ||
    !Number.isInteger(optionCount) ||
    optionCount < 2 ||
    optionCount > 6 ||
    !Array.isArray(metadata.proposedAnswers) ||
    metadata.proposedAnswers.length === 0
  ) {
    return null;
  }

  const correctOptions = [...new Set(metadata.proposedAnswers)].sort(
    (left, right) => left - right,
  );
  if (
    correctOptions.length !== metadata.proposedAnswers.length ||
    correctOptions.some(
      (option) =>
        !Number.isInteger(option) || option < 0 || option >= optionCount,
    ) ||
    (metadata.proposedType === "single" && correctOptions.length !== 1) ||
    (metadata.proposedType === "multiple" && correctOptions.length < 2)
  ) {
    return null;
  }

  return {
    type: metadata.proposedType,
    optionCount,
    correctOptions,
  };
}

function toAiSuggestion(
  metadata: typeof questions.$inferSelect.aiMetadata,
): AiAnswerSuggestion | null {
  if (!metadata?.status || !metadata.updatedAt) return null;
  return {
    status: metadata.status,
    proposedType: metadata.proposedType,
    optionCount: metadata.optionCount,
    optionCountConfidence: metadata.optionCountConfidence,
    optionCountSource: metadata.optionCountSource,
    proposedAnswers: metadata.proposedAnswers,
    confidence: metadata.confidence,
    provider: metadata.provider,
    model: metadata.model,
    error: metadata.error,
    validVotes: metadata.validVotes,
    totalComments: metadata.totalComments,
    voteBreakdown: metadata.voteBreakdown,
    requiresReview: metadata.requiresReview,
    disputeReason: metadata.disputeReason,
    updatedAt: metadata.updatedAt,
  };
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

export function isUniqueViolation(
  error: unknown,
  constraintName?: string,
): boolean {
  let current: unknown = error;

  for (let depth = 0; depth < 6; depth += 1) {
    if (typeof current !== "object" || current === null) return false;
    if ("code" in current && current.code === "23505") {
      if (constraintName && "constraint_name" in current) {
        return current.constraint_name === constraintName;
      }
      return true;
    }
    current = "cause" in current ? current.cause : undefined;
  }

  return false;
}

export class PostgresDraftImportRepository
  implements DraftImportRepository, ExamReviewRepository, AiSuggestionRepository
{
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
            // OCR imports default to hybrid: clean questions render as text,
            // while formulas, charts, and low-confidence OCR safely retain
            // their original image without blocking the entire revision.
            presentationMode: input.extractText ? "hybrid" : "image",
            note: "Nhập từ ZIP ảnh câu hỏi",
            answerConfidence: "reviewed",
          })
          .returning({ id: examRevisions.id });
        if (!revision) throw new Error("Không thể tạo phiên bản đề thi.");

        await transaction.insert(questions).values(
          input.questions.map((q) => ({
            revisionId: revision.id,
            order: q.order,
            imageKey: q.imageKey,
            imageHash: q.imageHash,
            type: q.type ?? ("single" as const),
            options: Array.from({ length: q.optionCount }, (_, index) =>
              String.fromCharCode(65 + index),
            ),
            correctOptions: q.correctOptions ?? [],
            aiMetadata: q.aiMetadata,
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
      if (isUniqueViolation(error, "exams_code_unique")) {
        throw new DraftImportRepositoryError(
          "EXAM_ALREADY_EXISTS",
          `Đề ${examCode} đã tồn tại.`,
        );
      }
      if (isUniqueViolation(error, "questions_revision_hash_idx")) {
        throw new DraftImportRepositoryError(
          "DUPLICATE_IMAGES",
          "ZIP chứa các ảnh giống hệt nhau (nội dung trùng lặp).",
        );
      }
      throw error;
    }
  }

  async findDrafts(): Promise<AdminExamSummary[]> {
    const results = await this.db
      .select({
        id: exams.id,
        code: exams.code,
        courseCode: courses.code,
        semester: exams.semester,
        status: exams.status,
        creatorName: users.fullName,
        createdAt: exams.createdAt,
      })
      .from(exams)
      .innerJoin(courses, eq(exams.courseId, courses.id))
      .innerJoin(users, eq(exams.createdBy, users.id))
      .where(inArray(exams.status, ["draft", "review"]))
      .orderBy(desc(exams.createdAt));

    return results;
  }

  async findAllExams(): Promise<AdminExamSummary[]> {
    const results = await this.db
      .select({
        id: exams.id,
        code: exams.code,
        courseCode: courses.code,
        semester: exams.semester,
        status: exams.status,
        creatorName: users.fullName,
        createdAt: exams.createdAt,
      })
      .from(exams)
      .innerJoin(courses, eq(exams.courseId, courses.id))
      .innerJoin(users, eq(exams.createdBy, users.id))
      .orderBy(desc(exams.createdAt));

    return results;
  }

  async deleteExam(examId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [exam] = await tx
        .select({ status: exams.status })
        .from(exams)
        .where(eq(exams.id, examId));

      if (!exam) return;

      if (exam.status === "draft" || exam.status === "review") {
        const revisionIds = tx
          .select({ id: examRevisions.id })
          .from(examRevisions)
          .where(eq(examRevisions.examId, examId));
        const questionIds = tx
          .select({ id: questions.id })
          .from(questions)
          .where(inArray(questions.revisionId, revisionIds));

        // An answer can be saved while a draft is being reviewed, which creates
        // an audit row. Delete that dependent data before the draft questions.
        await tx
          .delete(questionAnswerAudits)
          .where(inArray(questionAnswerAudits.questionId, questionIds));
        await tx
          .delete(questions)
          .where(inArray(questions.revisionId, revisionIds));
        await tx.delete(examRevisions).where(eq(examRevisions.examId, examId));
        await tx.delete(exams).where(eq(exams.id, examId));
      } else {
        // Soft delete: set status to cancelled
        await tx
          .update(exams)
          .set({ status: "cancelled" })
          .where(eq(exams.id, examId));
      }
    });
  }

  async findReview(examId: string): Promise<StoredDraftExamReview | null> {
    const [exam] = await this.db
      .select({
        examId: exams.id,
        revisionId: examRevisions.id,
        examCode: exams.code,
        courseCode: courses.code,
        courseName: courses.name,
        semester: exams.semester,
        campusCode: campuses.code,
        campusName: campuses.name,
        durationMinutes: exams.durationMinutes,
        isRetake: exams.isRetake,
        status: exams.status,
        presentationMode: examRevisions.presentationMode,
        publishedAt: exams.publishedAt,
      })
      .from(exams)
      .innerJoin(courses, eq(exams.courseId, courses.id))
      .innerJoin(campuses, eq(exams.campusId, campuses.id))
      .innerJoin(examRevisions, eq(examRevisions.examId, exams.id))
      .where(
        and(
          eq(exams.id, examId),
          inArray(exams.status, ["draft", "review", "published"]),
        ),
      )
      .orderBy(desc(examRevisions.revision))
      .limit(1);
    if (
      !exam ||
      (exam.status !== "draft" &&
        exam.status !== "review" &&
        exam.status !== "published")
    ) {
      return null;
    }

    const questionRows = await this.db
      .select({
        id: questions.id,
        order: questions.order,
        imageKey: questions.imageKey,
        type: questions.type,
        options: questions.options,
        correctOptions: questions.correctOptions,
        aiMetadata: questions.aiMetadata,
      })
      .from(questions)
      .where(eq(questions.revisionId, exam.revisionId))
      .orderBy(asc(questions.order));

    return {
      examId: exam.examId,
      revisionId: exam.revisionId,
      examCode: exam.examCode,
      courseCode: exam.courseCode,
      courseName: exam.courseName,
      semester: exam.semester,
      campus: { code: exam.campusCode, name: exam.campusName },
      durationMinutes: exam.durationMinutes,
      isRetake: exam.isRetake,
      status: exam.status,
      presentationMode: exam.presentationMode as "image" | "text" | "hybrid",
      publishedAt: exam.publishedAt?.toISOString() ?? null,
      answeredCount: questionRows.filter(
        (question) => question.correctOptions.length > 0,
      ).length,
      questionCount: questionRows.length,
      questions: questionRows.map(({ aiMetadata, ...question }) => ({
        ...question,
        aiSuggestion: toAiSuggestion(aiMetadata),
      })),
    };
  }

  async saveAnswer(input: {
    examId: string;
    questionId: string;
    changedBy: string;
    answer: UpdateQuestionAnswerInput;
  }): Promise<StoredReviewQuestion> {
    return this.db.transaction(async (transaction) => {
      const [current] = await transaction
        .select({
          id: questions.id,
          order: questions.order,
          imageKey: questions.imageKey,
          type: questions.type,
          options: questions.options,
          correctOptions: questions.correctOptions,
          aiMetadata: questions.aiMetadata,
          examStatus: exams.status,
        })
        .from(questions)
        .innerJoin(examRevisions, eq(questions.revisionId, examRevisions.id))
        .innerJoin(exams, eq(examRevisions.examId, exams.id))
        .where(
          and(eq(exams.id, input.examId), eq(questions.id, input.questionId)),
        )
        .limit(1);

      if (!current) {
        throw new DraftImportRepositoryError(
          "QUESTION_NOT_FOUND",
          "Không tìm thấy câu hỏi trong đề.",
        );
      }
      if (current.examStatus !== "draft") {
        throw new DraftImportRepositoryError(
          "EXAM_NOT_EDITABLE",
          "Đề không còn ở trạng thái có thể chỉnh sửa.",
        );
      }

      const nextOptions = Array.from(
        { length: input.answer.optionCount },
        (_, index) => String.fromCharCode(65 + index),
      );
      const nextCorrectOptions = [...input.answer.correctOptions].sort(
        (left, right) => left - right,
      );
      const unchanged =
        current.type === input.answer.type &&
        JSON.stringify(current.options) === JSON.stringify(nextOptions) &&
        JSON.stringify(current.correctOptions) ===
          JSON.stringify(nextCorrectOptions);

      const confirmsSuggestion = current.aiMetadata?.status === "suggested";

      if (!unchanged) {
        await transaction.insert(questionAnswerAudits).values({
          questionId: current.id,
          changedBy: input.changedBy,
          previousType: current.type,
          nextType: input.answer.type,
          previousOptions: current.options,
          nextOptions,
          previousCorrectOptions: current.correctOptions,
          nextCorrectOptions,
        });
      }

      if (!unchanged || confirmsSuggestion) {
        await transaction
          .update(questions)
          .set({
            type: input.answer.type,
            options: nextOptions,
            correctOptions: nextCorrectOptions,
            aiMetadata: confirmsSuggestion
              ? {
                  ...current.aiMetadata,
                  status: "confirmed",
                  updatedAt: new Date().toISOString(),
                }
              : current.aiMetadata?.status === "confirmed"
                ? current.aiMetadata
                : null,
            updatedAt: new Date(),
          })
          .where(eq(questions.id, current.id));
      }

      return {
        id: current.id,
        order: current.order,
        imageKey: current.imageKey,
        type: input.answer.type,
        options: nextOptions,
        correctOptions: nextCorrectOptions,
        aiSuggestion:
          current.aiMetadata?.status === "suggested"
            ? toAiSuggestion({
                ...current.aiMetadata,
                status: "confirmed",
                updatedAt: new Date().toISOString(),
              })
            : current.aiMetadata?.status === "confirmed"
              ? toAiSuggestion(current.aiMetadata)
              : null,
      };
    });
  }

  async confirmTrustedSuggestions(
    examId: string,
    changedBy: string,
  ): Promise<ConfirmTrustedSuggestionsResult> {
    return this.db.transaction(async (transaction) => {
      const [exam] = await transaction
        .select({ id: exams.id, status: exams.status })
        .from(exams)
        .where(eq(exams.id, examId))
        .limit(1);
      if (!exam) {
        throw new DraftImportRepositoryError(
          "EXAM_NOT_FOUND",
          "Không tìm thấy đề thi.",
        );
      }
      if (exam.status !== "draft") {
        throw new DraftImportRepositoryError(
          "EXAM_NOT_EDITABLE",
          "Đề không còn ở trạng thái có thể chỉnh sửa.",
        );
      }

      const [revision] = await transaction
        .select({ id: examRevisions.id })
        .from(examRevisions)
        .where(eq(examRevisions.examId, examId))
        .orderBy(desc(examRevisions.revision))
        .limit(1);
      if (!revision) {
        throw new DraftImportRepositoryError(
          "EXAM_NOT_FOUND",
          "Không tìm thấy phiên bản đề thi.",
        );
      }

      const questionRows = await transaction
        .select({
          id: questions.id,
          type: questions.type,
          options: questions.options,
          correctOptions: questions.correctOptions,
          aiMetadata: questions.aiMetadata,
        })
        .from(questions)
        .where(eq(questions.revisionId, revision.id));
      const updatedAt = new Date();
      const updatedAtIso = updatedAt.toISOString();
      let confirmedCount = 0;

      for (const question of questionRows) {
        if (question.correctOptions.length > 0) continue;
        const answer = trustedCommunitySuggestion(question.aiMetadata);
        if (!answer) continue;

        const nextOptions = Array.from(
          { length: answer.optionCount },
          (_, index) => String.fromCharCode(65 + index),
        );
        await transaction.insert(questionAnswerAudits).values({
          questionId: question.id,
          changedBy,
          previousType: question.type,
          nextType: answer.type,
          previousOptions: question.options,
          nextOptions,
          previousCorrectOptions: question.correctOptions,
          nextCorrectOptions: answer.correctOptions,
        });
        await transaction
          .update(questions)
          .set({
            type: answer.type,
            options: nextOptions,
            correctOptions: answer.correctOptions,
            aiMetadata: {
              ...question.aiMetadata,
              status: "confirmed",
              updatedAt: updatedAtIso,
            },
            updatedAt,
          })
          .where(eq(questions.id, question.id));
        confirmedCount += 1;
      }

      const previouslyAnswered = questionRows.filter(
        (question) => question.correctOptions.length > 0,
      ).length;
      const answeredCount = previouslyAnswered + confirmedCount;
      const questionCount = questionRows.length;
      return {
        examId,
        confirmedCount,
        answeredCount,
        questionCount,
        remainingCount: questionCount - answeredCount,
      };
    });
  }

  async queueUnanswered(examId: string): Promise<{
    jobs: AiSuggestionJob[];
    skippedCount: number;
  }> {
    return this.db.transaction(async (transaction) => {
      const [exam] = await transaction
        .select({
          id: exams.id,
          status: exams.status,
          courseCode: courses.code,
        })
        .from(exams)
        .innerJoin(courses, eq(exams.courseId, courses.id))
        .where(eq(exams.id, examId))
        .limit(1);
      if (!exam) {
        throw new DraftImportRepositoryError(
          "EXAM_NOT_FOUND",
          "Không tìm thấy đề thi.",
        );
      }
      if (exam.status !== "draft") {
        throw new DraftImportRepositoryError(
          "EXAM_NOT_EDITABLE",
          "Chỉ có thể tạo gợi ý cho đề đang ở trạng thái nháp.",
        );
      }

      const [revision] = await transaction
        .select({ id: examRevisions.id })
        .from(examRevisions)
        .where(eq(examRevisions.examId, examId))
        .orderBy(desc(examRevisions.revision))
        .limit(1);
      if (!revision) {
        throw new DraftImportRepositoryError(
          "EXAM_NOT_FOUND",
          "Đề chưa có phiên bản để xử lý.",
        );
      }

      const questionRows = await transaction
        .select({
          id: questions.id,
          imageKey: questions.imageKey,
          options: questions.options,
          correctOptions: questions.correctOptions,
          aiMetadata: questions.aiMetadata,
        })
        .from(questions)
        .where(eq(questions.revisionId, revision.id))
        .orderBy(asc(questions.order));

      const candidates = questionRows.filter(
        (question) =>
          question.correctOptions.length === 0 &&
          !["queued", "processing", "suggested", "confirmed"].includes(
            question.aiMetadata?.status ?? "",
          ),
      );
      const updatedAt = new Date().toISOString();
      for (const question of candidates) {
        await transaction
          .update(questions)
          .set({
            aiMetadata: { status: "queued", updatedAt },
            updatedAt: new Date(updatedAt),
          })
          .where(eq(questions.id, question.id));
      }

      return {
        jobs: candidates.map((question) => ({
          examId,
          questionId: question.id,
          imageKey: question.imageKey,
          courseCode: exam.courseCode,
          optionCount: question.options.length,
        })),
        skippedCount: questionRows.length - candidates.length,
      };
    });
  }

  async queueQuestion(
    examId: string,
    questionId: string,
  ): Promise<{
    jobs: AiSuggestionJob[];
    skippedCount: number;
  }> {
    return this.db.transaction(async (transaction) => {
      const [exam] = await transaction
        .select({
          id: exams.id,
          status: exams.status,
          courseCode: courses.code,
        })
        .from(exams)
        .innerJoin(courses, eq(exams.courseId, courses.id))
        .where(eq(exams.id, examId))
        .limit(1);
      if (!exam) {
        throw new DraftImportRepositoryError(
          "EXAM_NOT_FOUND",
          "Không tìm thấy đề thi.",
        );
      }
      if (exam.status !== "draft") {
        throw new DraftImportRepositoryError(
          "EXAM_NOT_EDITABLE",
          "Chỉ có thể tạo gợi ý cho đề đang ở trạng thái nháp.",
        );
      }

      const [revision] = await transaction
        .select({ id: examRevisions.id })
        .from(examRevisions)
        .where(eq(examRevisions.examId, examId))
        .orderBy(desc(examRevisions.revision))
        .limit(1);
      if (!revision) {
        throw new DraftImportRepositoryError(
          "EXAM_NOT_FOUND",
          "Đề chưa có phiên bản để xử lý.",
        );
      }

      const [question] = await transaction
        .select({
          id: questions.id,
          imageKey: questions.imageKey,
          options: questions.options,
          correctOptions: questions.correctOptions,
          aiMetadata: questions.aiMetadata,
        })
        .from(questions)
        .where(
          and(
            eq(questions.id, questionId),
            eq(questions.revisionId, revision.id),
          ),
        )
        .limit(1);
      if (!question) {
        throw new DraftImportRepositoryError(
          "QUESTION_NOT_FOUND",
          "Không tìm thấy câu hỏi trong đề thi.",
        );
      }

      const alreadyHandled =
        question.correctOptions.length > 0 ||
        ["queued", "processing", "confirmed"].includes(
          question.aiMetadata?.status ?? "",
        );
      if (alreadyHandled) {
        return { jobs: [], skippedCount: 1 };
      }

      const updatedAt = new Date().toISOString();
      await transaction
        .update(questions)
        .set({
          aiMetadata: { status: "queued", updatedAt },
          updatedAt: new Date(updatedAt),
        })
        .where(eq(questions.id, question.id));

      return {
        jobs: [
          {
            examId,
            questionId: question.id,
            imageKey: question.imageKey,
            courseCode: exam.courseCode,
            optionCount: question.options.length,
          },
        ],
        skippedCount: 0,
      };
    });
  }

  async markProcessing(questionId: string): Promise<void> {
    const updatedAt = new Date();
    await this.db
      .update(questions)
      .set({
        aiMetadata: {
          status: "processing",
          updatedAt: updatedAt.toISOString(),
        },
        updatedAt,
      })
      .where(eq(questions.id, questionId));
  }

  async saveSuggestion(
    questionId: string,
    proposal: AiAnswerProposalInput,
  ): Promise<void> {
    const updatedAt = new Date();
    await this.db
      .update(questions)
      .set({
        type: proposal.proposedType,
        options: Array.from({ length: proposal.optionCount }, (_, index) =>
          String.fromCharCode(65 + index),
        ),
        aiMetadata: {
          status: "suggested",
          proposedType: proposal.proposedType,
          optionCount: proposal.optionCount,
          optionCountConfidence: proposal.confidence,
          optionCountSource: "ai-vision",
          proposedAnswers: proposal.proposedAnswers,
          confidence: proposal.confidence,
          provider: proposal.provider,
          model: proposal.model,
          rationale: proposal.rationale,
          raw: proposal.raw,
          updatedAt: updatedAt.toISOString(),
        },
        updatedAt,
      })
      .where(eq(questions.id, questionId));
  }

  async markFailed(questionId: string, message: string): Promise<void> {
    const updatedAt = new Date();
    await this.db
      .update(questions)
      .set({
        aiMetadata: {
          status: "failed",
          error: message.slice(0, 500),
          updatedAt: updatedAt.toISOString(),
        },
        updatedAt,
      })
      .where(eq(questions.id, questionId));
  }

  async markReady(
    examId: string,
    _changedBy: string,
  ): Promise<ReviewReadinessResult> {
    return this.db.transaction(async (transaction) => {
      const [exam] = await transaction
        .select({ id: exams.id, status: exams.status })
        .from(exams)
        .where(eq(exams.id, examId))
        .limit(1);
      if (!exam) {
        throw new DraftImportRepositoryError(
          "EXAM_NOT_FOUND",
          "Không tìm thấy đề thi.",
        );
      }
      if (exam.status !== "draft" && exam.status !== "review") {
        throw new DraftImportRepositoryError(
          "EXAM_NOT_EDITABLE",
          "Đề không thể chuyển sang bước duyệt.",
        );
      }

      const [revision] = await transaction
        .select({ id: examRevisions.id })
        .from(examRevisions)
        .where(eq(examRevisions.examId, examId))
        .orderBy(desc(examRevisions.revision))
        .limit(1);
      if (!revision) {
        throw new DraftImportRepositoryError(
          "EXAM_NOT_FOUND",
          "Đề chưa có phiên bản để duyệt.",
        );
      }

      const answers = await transaction
        .select({ correctOptions: questions.correctOptions })
        .from(questions)
        .where(eq(questions.revisionId, revision.id));
      const answeredCount = answers.filter(
        (question) => question.correctOptions.length > 0,
      ).length;
      if (answers.length === 0 || answeredCount !== answers.length) {
        throw new DraftImportRepositoryError(
          "ANSWERS_INCOMPLETE",
          `Cần duyệt đủ ${answers.length} câu trước khi hoàn tất.`,
        );
      }

      if (exam.status === "draft") {
        await transaction
          .update(exams)
          .set({ status: "review", updatedAt: new Date() })
          .where(eq(exams.id, examId));
      }

      return {
        examId,
        status: "review",
        answeredCount,
        questionCount: answers.length,
      };
    });
  }

  async publish(
    examId: string,
    approvedBy: string,
  ): Promise<PublishExamResult> {
    return this.db.transaction(async (transaction) => {
      const [exam] = await transaction
        .select({
          id: exams.id,
          status: exams.status,
          publishedAt: exams.publishedAt,
        })
        .from(exams)
        .where(eq(exams.id, examId))
        .limit(1);
      if (!exam) {
        throw new DraftImportRepositoryError(
          "EXAM_NOT_FOUND",
          "Không tìm thấy đề thi.",
        );
      }

      const [revision] = await transaction
        .select({
          id: examRevisions.id,
          approvedAt: examRevisions.approvedAt,
        })
        .from(examRevisions)
        .where(eq(examRevisions.examId, examId))
        .orderBy(desc(examRevisions.revision))
        .limit(1);
      if (!revision) {
        throw new DraftImportRepositoryError(
          "EXAM_NOT_FOUND",
          "Đề chưa có phiên bản để xuất bản.",
        );
      }

      if (exam.status === "published" && exam.publishedAt) {
        return {
          examId,
          revisionId: revision.id,
          status: "published",
          publishedAt: exam.publishedAt.toISOString(),
        };
      }
      if (exam.status !== "review") {
        throw new DraftImportRepositoryError(
          "EXAM_NOT_READY",
          "Đề phải hoàn tất duyệt đáp án trước khi xuất bản.",
        );
      }

      const answerRows = await transaction
        .select({ correctOptions: questions.correctOptions })
        .from(questions)
        .where(eq(questions.revisionId, revision.id));
      if (
        answerRows.length === 0 ||
        answerRows.some((question) => question.correctOptions.length === 0)
      ) {
        throw new DraftImportRepositoryError(
          "ANSWERS_INCOMPLETE",
          "Đề vẫn còn câu chưa có đáp án.",
        );
      }

      const publishedAt = new Date();
      await transaction
        .update(examRevisions)
        .set({
          approvedBy,
          approvedAt: publishedAt,
          answerConfidence: "verified",
          updatedAt: publishedAt,
        })
        .where(eq(examRevisions.id, revision.id));
      await transaction
        .update(exams)
        .set({
          status: "published",
          publishedAt,
          updatedAt: publishedAt,
        })
        .where(eq(exams.id, examId));

      return {
        examId,
        revisionId: revision.id,
        status: "published",
        publishedAt: publishedAt.toISOString(),
      };
    });
  }
}

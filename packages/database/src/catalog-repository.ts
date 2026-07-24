import type {
  Exam,
  ExamSummary,
  Campus,
  Major,
  Curriculum,
  TermCourse,
} from "@onthilab/contracts";
import { and, count, desc, eq, isNotNull, max, or, asc, lt } from "drizzle-orm";
import type { OnThiLabDatabase } from "./index";
import {
  campuses,
  courses,
  curricula,
  curriculumCourses,
  examRevisions,
  exams,
  majors,
  questions,
} from "./schema";

export interface CatalogFilters {
  campus?: string;
  courseCode?: string;
  semester?: string;
  cursor?: string; // Tên môn (mã môn) hoặc ID tuỳ cách sort, hiện tại orderBy code thì cursor có thể là (code, id)
  limit?: number;
}

export interface CatalogRepository {
  listCampuses(): Promise<Campus[]>;
  listMajors(): Promise<Major[]>;
  listCurricula(majorId: string): Promise<Curriculum[]>;
  listTermCourses(curriculumId: string): Promise<TermCourse[]>;
  listPublished(filters?: CatalogFilters): Promise<ExamSummary[]>;
  findPublishedByIdOrCode(idOrCode: string): Promise<Exam | null>;
}

interface PostgresCatalogRepositoryOptions {
  imageUrlForKey?: (key: string) => string;
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class PostgresCatalogRepository implements CatalogRepository {
  private readonly imageUrlForKey: (key: string) => string;

  constructor(
    private readonly db: OnThiLabDatabase,
    options: PostgresCatalogRepositoryOptions = {},
  ) {
    this.imageUrlForKey =
      options.imageUrlForKey ?? ((key) => `/question-images/${key}`);
  }

  async listPublished(filters: CatalogFilters = {}): Promise<ExamSummary[]> {
    const latestApprovedRevision = this.db
      .select({
        examId: examRevisions.examId,
        revision: max(examRevisions.revision).as("latest_revision_number"),
      })
      .from(examRevisions)
      .where(isNotNull(examRevisions.approvedAt))
      .groupBy(examRevisions.examId)
      .as("latest_approved_revision");

    const conditions = [eq(exams.status, "published")];
    if (filters.campus) conditions.push(eq(campuses.code, filters.campus));
    if (filters.courseCode)
      conditions.push(eq(courses.code, filters.courseCode));
    if (filters.semester) conditions.push(eq(exams.semester, filters.semester));

    if (filters.cursor) {
      const [publishedAt, id] = filters.cursor.split("_");
      if (publishedAt && id) {
        conditions.push(
          or(
            lt(exams.publishedAt, new Date(publishedAt)),
            and(eq(exams.publishedAt, new Date(publishedAt)), lt(exams.id, id)),
          )!,
        );
      }
    }

    let query = this.db
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
      })
      .from(exams)
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
      .where(and(...conditions))
      .groupBy(
        exams.id,
        courses.code,
        courses.name,
        campuses.name,
        examRevisions.answerConfidence,
      )
      .orderBy(desc(exams.publishedAt), desc(exams.id));

    if (filters.limit) {
      query = query.limit(filters.limit) as any;
    }

    const rows = await query;

    return rows.map((row) => ({
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
    }));
  }

  async findPublishedByIdOrCode(idOrCode: string): Promise<Exam | null> {
    const identityCondition = uuidPattern.test(idOrCode)
      ? or(eq(exams.id, idOrCode), eq(exams.code, idOrCode))
      : eq(exams.code, idOrCode);

    const [examRow] = await this.db
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
        shuffleQuestions: exams.shuffleQuestions,
        publishedAt: exams.publishedAt,
        revisionId: examRevisions.id,
        answerConfidence: examRevisions.answerConfidence,
      })
      .from(exams)
      .innerJoin(courses, eq(exams.courseId, courses.id))
      .leftJoin(campuses, eq(exams.campusId, campuses.id))
      .innerJoin(examRevisions, eq(examRevisions.examId, exams.id))
      .where(
        and(
          eq(exams.status, "published"),
          isNotNull(examRevisions.approvedAt),
          identityCondition,
        ),
      )
      .orderBy(desc(examRevisions.revision))
      .limit(1);

    if (!examRow) return null;

    const questionRows = await this.db
      .select({
        id: questions.id,
        order: questions.order,
        imageKey: questions.imageKey,
        type: questions.type,
        options: questions.options,
      })
      .from(questions)
      .where(eq(questions.revisionId, examRow.revisionId))
      .orderBy(questions.order);

    return {
      id: examRow.id,
      code: examRow.code,
      courseCode: examRow.courseCode,
      courseName: examRow.courseName,
      semester: examRow.semester,
      campus: examRow.campus ?? "Tất cả campus",
      examType: examRow.examType,
      isRetake: examRow.isRetake,
      durationMinutes: examRow.durationMinutes,
      questionCount: questionRows.length,
      publishedAt: (examRow.publishedAt ?? new Date(0)).toISOString(),
      answerConfidence:
        examRow.answerConfidence === "verified" ? "verified" : "reviewed",
      shuffleQuestions: examRow.shuffleQuestions,
      instructions: [
        "Bài thi không thể tạm dừng và sẽ tự động nộp khi hết giờ.",
        "Câu nhiều đáp án chỉ được tính đúng khi chọn chính xác toàn bộ đáp án.",
        "Đáp án và điểm số chỉ mang tính tham khảo.",
      ],
      questions: questionRows.map((question) => ({
        id: question.id,
        order: question.order,
        imageUrl: this.imageUrlForKey(question.imageKey),
        imageAlt: `Ảnh câu hỏi ${question.order} của đề ${examRow.code}`,
        type: question.type,
        options: question.options,
      })),
    };
  }

  async listCampuses(): Promise<Campus[]> {
    return this.db
      .select({
        id: campuses.id,
        code: campuses.code,
        name: campuses.name,
      })
      .from(campuses)
      .where(eq(campuses.isActive, true))
      .orderBy(asc(campuses.code));
  }

  async listMajors(): Promise<Major[]> {
    return this.db
      .select({
        id: majors.id,
        code: majors.code,
        name: majors.name,
      })
      .from(majors)
      .orderBy(asc(majors.name));
  }

  async listCurricula(majorId: string): Promise<Curriculum[]> {
    return this.db
      .select({
        id: curricula.id,
        majorId: curricula.majorId,
        code: curricula.code,
        name: curricula.name,
      })
      .from(curricula)
      .where(eq(curricula.majorId, majorId))
      .orderBy(desc(curricula.code));
  }

  async listTermCourses(curriculumId: string): Promise<TermCourse[]> {
    return this.db
      .select({
        courseId: courses.id,
        courseCode: courses.code,
        courseName: courses.name,
        termNumber: curriculumCourses.termNumber,
        isElective: curriculumCourses.isElective,
        examFormatStatus: courses.examFormatStatus,
      })
      .from(curriculumCourses)
      .innerJoin(courses, eq(curriculumCourses.courseId, courses.id))
      .where(eq(curriculumCourses.curriculumId, curriculumId))
      .orderBy(asc(curriculumCourses.termNumber), asc(courses.code));
  }
}

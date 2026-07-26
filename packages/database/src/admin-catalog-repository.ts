import type {
  AdminCatalog,
  AdminCourse,
  AdminCurriculum,
  CreateCourseInput,
  CreateCurriculumInput,
  CreateMajorInput,
  Major,
  UpsertCurriculumCourseInput,
} from "@onthilab/contracts";
import { asc, count, eq } from "drizzle-orm";
import type { OnThiLabDatabase } from "./index";
import { courses, curricula, curriculumCourses, majors } from "./schema";

export type AdminCatalogRepositoryErrorCode =
  | "COURSE_ALREADY_EXISTS"
  | "COURSE_NOT_FOUND"
  | "CURRICULUM_ALREADY_EXISTS"
  | "CURRICULUM_NOT_FOUND"
  | "MAJOR_ALREADY_EXISTS"
  | "MAJOR_NOT_FOUND";

export class AdminCatalogRepositoryError extends Error {
  constructor(
    readonly code: AdminCatalogRepositoryErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface AdminCatalogRepository {
  getAdminCatalog(): Promise<AdminCatalog>;
  createMajor(input: CreateMajorInput): Promise<Major>;
  createCurriculum(input: CreateCurriculumInput): Promise<AdminCurriculum>;
  createCourse(input: CreateCourseInput): Promise<AdminCourse>;
  upsertCurriculumCourse(input: UpsertCurriculumCourseInput): Promise<void>;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

export class PostgresAdminCatalogRepository implements AdminCatalogRepository {
  constructor(private readonly db: OnThiLabDatabase) {}

  async getAdminCatalog(): Promise<AdminCatalog> {
    const [majorRows, curriculumRows, courseRows] = await Promise.all([
      this.db
        .select({ id: majors.id, code: majors.code, name: majors.name })
        .from(majors)
        .orderBy(asc(majors.name)),
      this.db
        .select({
          id: curricula.id,
          majorId: curricula.majorId,
          code: curricula.code,
          name: curricula.name,
          majorCode: majors.code,
          majorName: majors.name,
          courseCount: count(curriculumCourses.courseId),
        })
        .from(curricula)
        .innerJoin(majors, eq(curricula.majorId, majors.id))
        .leftJoin(
          curriculumCourses,
          eq(curriculumCourses.curriculumId, curricula.id),
        )
        .groupBy(curricula.id, majors.code, majors.name)
        .orderBy(asc(majors.name), asc(curricula.code)),
      this.db
        .select({
          id: courses.id,
          code: courses.code,
          name: courses.name,
          description: courses.description,
          priorityWave: courses.priorityWave,
          examFormatStatus: courses.examFormatStatus,
          curriculumId: curricula.id,
          curriculumCode: curricula.code,
          curriculumName: curricula.name,
          majorCode: majors.code,
          majorName: majors.name,
          termNumber: curriculumCourses.termNumber,
          isElective: curriculumCourses.isElective,
        })
        .from(courses)
        .leftJoin(curriculumCourses, eq(curriculumCourses.courseId, courses.id))
        .leftJoin(curricula, eq(curriculumCourses.curriculumId, curricula.id))
        .leftJoin(majors, eq(curricula.majorId, majors.id))
        .orderBy(asc(courses.code)),
    ]);

    const courseMap = new Map<string, AdminCourse>();
    for (const row of courseRows) {
      const course =
        courseMap.get(row.id) ??
        ({
          id: row.id,
          code: row.code,
          name: row.name,
          description: row.description,
          priorityWave: row.priorityWave,
          examFormatStatus: row.examFormatStatus,
          placements: [],
        } satisfies AdminCourse);
      if (
        row.curriculumId &&
        row.curriculumCode &&
        row.curriculumName &&
        row.majorCode &&
        row.majorName &&
        row.termNumber !== null
      ) {
        course.placements.push({
          curriculumId: row.curriculumId,
          curriculumCode: row.curriculumCode,
          curriculumName: row.curriculumName,
          majorCode: row.majorCode,
          majorName: row.majorName,
          termNumber: row.termNumber,
          isElective: row.isElective ?? false,
        });
      }
      courseMap.set(row.id, course);
    }

    return {
      majors: majorRows,
      curricula: curriculumRows.map((row) => ({
        ...row,
        courseCount: Number(row.courseCount),
      })),
      courses: [...courseMap.values()],
    };
  }

  async createMajor(input: CreateMajorInput): Promise<Major> {
    try {
      const [major] = await this.db
        .insert(majors)
        .values(input)
        .returning({ id: majors.id, code: majors.code, name: majors.name });
      if (!major) throw new Error("Failed to create major");
      return major;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AdminCatalogRepositoryError(
          "MAJOR_ALREADY_EXISTS",
          `Mã ngành ${input.code} đã tồn tại.`,
        );
      }
      throw error;
    }
  }

  async createCurriculum(
    input: CreateCurriculumInput,
  ): Promise<AdminCurriculum> {
    const [major] = await this.db
      .select({ id: majors.id, code: majors.code, name: majors.name })
      .from(majors)
      .where(eq(majors.id, input.majorId))
      .limit(1);
    if (!major) {
      throw new AdminCatalogRepositoryError(
        "MAJOR_NOT_FOUND",
        "Ngành được chọn không tồn tại.",
      );
    }
    try {
      const [curriculum] = await this.db
        .insert(curricula)
        .values({
          ...input,
          effectiveFrom: input.effectiveFrom || null,
          effectiveTo: input.effectiveTo || null,
        })
        .returning({
          id: curricula.id,
          majorId: curricula.majorId,
          code: curricula.code,
          name: curricula.name,
        });
      if (!curriculum) throw new Error("Failed to create curriculum");
      return {
        ...curriculum,
        majorCode: major.code,
        majorName: major.name,
        courseCount: 0,
      };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AdminCatalogRepositoryError(
          "CURRICULUM_ALREADY_EXISTS",
          `Phiên bản chương trình ${input.code} đã tồn tại cho ngành này.`,
        );
      }
      throw error;
    }
  }

  async createCourse(input: CreateCourseInput): Promise<AdminCourse> {
    try {
      const [course] = await this.db
        .insert(courses)
        .values({ ...input, description: input.description || null })
        .returning({
          id: courses.id,
          code: courses.code,
          name: courses.name,
          description: courses.description,
          priorityWave: courses.priorityWave,
          examFormatStatus: courses.examFormatStatus,
        });
      if (!course) throw new Error("Failed to create course");
      return { ...course, placements: [] };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AdminCatalogRepositoryError(
          "COURSE_ALREADY_EXISTS",
          `Mã môn ${input.code} đã tồn tại.`,
        );
      }
      throw error;
    }
  }

  async upsertCurriculumCourse(
    input: UpsertCurriculumCourseInput,
  ): Promise<void> {
    const [[curriculum], [course]] = await Promise.all([
      this.db
        .select({ id: curricula.id })
        .from(curricula)
        .where(eq(curricula.id, input.curriculumId))
        .limit(1),
      this.db
        .select({ id: courses.id })
        .from(courses)
        .where(eq(courses.id, input.courseId))
        .limit(1),
    ]);
    if (!curriculum) {
      throw new AdminCatalogRepositoryError(
        "CURRICULUM_NOT_FOUND",
        "Chương trình được chọn không tồn tại.",
      );
    }
    if (!course) {
      throw new AdminCatalogRepositoryError(
        "COURSE_NOT_FOUND",
        "Môn học được chọn không tồn tại.",
      );
    }
    await this.db
      .insert(curriculumCourses)
      .values(input)
      .onConflictDoUpdate({
        target: [curriculumCourses.curriculumId, curriculumCourses.courseId],
        set: {
          termNumber: input.termNumber,
          isElective: input.isElective,
        },
      });
  }
}

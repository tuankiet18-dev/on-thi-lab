import type {
  ProfileOptions,
  StudentProfile,
  UpsertStudentProfileInput,
} from "@onthilab/contracts";
import { and, asc, eq, or, ilike, desc } from "drizzle-orm";
import type { OnThiLabDatabase } from "./index";
import { campuses, majors, users, curricula } from "./schema";

export interface ProfileIdentity {
  subject: string;
  email: string;
}

export type ProfileRepositoryErrorCode =
  | "CAMPUS_NOT_FOUND"
  | "MAJOR_NOT_FOUND"
  | "PROFILE_CONFLICT"
  | "PROFILE_DISABLED";

export class ProfileRepositoryError extends Error {
  constructor(
    readonly code: ProfileRepositoryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ProfileRepositoryError";
  }
}

export interface UserProfileRepository {
  findBySubject(subject: string): Promise<StudentProfile | null>;
  listOptions(): Promise<ProfileOptions>;
  upsert(
    identity: ProfileIdentity,
    input: UpsertStudentProfileInput,
  ): Promise<StudentProfile>;
  updateRole(
    userId: string,
    role: "user" | "contributor" | "admin",
  ): Promise<void>;
  searchUsers(query: string): Promise<StudentProfile[]>;
}

function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;

  for (let depth = 0; depth < 6; depth += 1) {
    if (typeof current !== "object" || current === null) return false;
    if ("code" in current && current.code === "23505") return true;
    current = "cause" in current ? current.cause : undefined;
  }

  return false;
}

export class PostgresUserProfileRepository implements UserProfileRepository {
  constructor(private readonly db: OnThiLabDatabase) {}

  async findBySubject(subject: string): Promise<StudentProfile | null> {
    const [row] = await this.db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        studentCode: users.studentCode,
        campusCode: campuses.code,
        campusName: campuses.name,
        majorCode: majors.code,
        majorName: majors.name,
        curriculumId: curricula.id,
        curriculumCode: curricula.code,
        curriculumName: curricula.name,
        role: users.role,
      })
      .from(users)
      .innerJoin(campuses, eq(users.campusId, campuses.id))
      .leftJoin(majors, eq(users.majorId, majors.id))
      .leftJoin(curricula, eq(users.curriculumId, curricula.id))
      .where(and(eq(users.cognitoSubject, subject), eq(users.isActive, true)))
      .limit(1);

    return row
      ? {
          id: row.id,
          email: row.email,
          fullName: row.fullName,
          studentCode: row.studentCode,
          campus: { code: row.campusCode, name: row.campusName },
          major:
            row.majorCode && row.majorName
              ? { code: row.majorCode, name: row.majorName }
              : null,
          curriculum: row.curriculumId
            ? {
                id: row.curriculumId,
                majorId: row.id, // Not exactly majorId but not used in frontend directly on curriculum object
                code: row.curriculumCode!,
                name: row.curriculumName!,
              }
            : null,
          role: row.role,
        }
      : null;
  }

  async listOptions(): Promise<ProfileOptions> {
    const [campusRows, majorRows, curriculumRows] = await Promise.all([
      this.db
        .select({ code: campuses.code, name: campuses.name })
        .from(campuses)
        .where(eq(campuses.isActive, true))
        .orderBy(asc(campuses.name)),
      this.db
        .select({ code: majors.code, name: majors.name })
        .from(majors)
        .orderBy(asc(majors.name)),
      this.db
        .select({
          id: curricula.id,
          majorId: curricula.majorId,
          code: curricula.code,
          name: curricula.name,
        })
        .from(curricula)
        .orderBy(desc(curricula.code)),
    ]);

    return {
      campuses: campusRows,
      majors: majorRows,
      curricula: curriculumRows,
    };
  }

  async upsert(
    identity: ProfileIdentity,
    input: UpsertStudentProfileInput,
  ): Promise<StudentProfile> {
    const [[campus], majorRows, [existingUser]] = await Promise.all([
      this.db
        .select({ id: campuses.id })
        .from(campuses)
        .where(
          and(eq(campuses.code, input.campusCode), eq(campuses.isActive, true)),
        )
        .limit(1),
      input.majorCode
        ? this.db
            .select({ id: majors.id })
            .from(majors)
            .where(eq(majors.code, input.majorCode))
            .limit(1)
        : Promise.resolve([]),
      this.db
        .select({ isActive: users.isActive })
        .from(users)
        .where(eq(users.cognitoSubject, identity.subject))
        .limit(1),
    ]);

    if (existingUser && !existingUser.isActive) {
      throw new ProfileRepositoryError(
        "PROFILE_DISABLED",
        "Profile is disabled",
      );
    }
    if (!campus) {
      throw new ProfileRepositoryError(
        "CAMPUS_NOT_FOUND",
        "Campus is not available",
      );
    }
    const major = majorRows[0];
    if (input.majorCode && !major) {
      throw new ProfileRepositoryError(
        "MAJOR_NOT_FOUND",
        "Major is not available",
      );
    }
    const curriculumId = major ? (input.curriculumId ?? null) : null;

    try {
      await this.db
        .insert(users)
        .values({
          cognitoSubject: identity.subject,
          email: identity.email,
          fullName: input.fullName,
          studentCode: input.studentCode ?? null,
          campusId: campus.id,
          majorId: major?.id ?? null,
          curriculumId,
        })
        .onConflictDoUpdate({
          target: users.cognitoSubject,
          set: {
            email: identity.email,
            fullName: input.fullName,
            studentCode: input.studentCode ?? null,
            campusId: campus.id,
            majorId: major?.id ?? null,
            curriculumId,
            updatedAt: new Date(),
          },
        });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ProfileRepositoryError(
          "PROFILE_CONFLICT",
          "Email or student code is already in use",
        );
      }
      throw error;
    }

    const saved = await this.findBySubject(identity.subject);
    if (!saved) {
      throw new Error("Profile was saved but could not be loaded");
    }
    return saved;
  }

  async updateRole(
    userId: string,
    role: "user" | "contributor" | "admin",
  ): Promise<void> {
    await this.db.update(users).set({ role }).where(eq(users.id, userId));
  }

  async searchUsers(query: string): Promise<StudentProfile[]> {
    const term = `%${query}%`;
    const rows = await this.db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        studentCode: users.studentCode,
        campusCode: campuses.code,
        campusName: campuses.name,
        majorCode: majors.code,
        majorName: majors.name,
        curriculumId: curricula.id,
        curriculumCode: curricula.code,
        curriculumName: curricula.name,
        role: users.role,
        isActive: users.isActive,
      })
      .from(users)
      .leftJoin(campuses, eq(users.campusId, campuses.id))
      .leftJoin(majors, eq(users.majorId, majors.id))
      .leftJoin(curricula, eq(users.curriculumId, curricula.id))
      .where(or(ilike(users.email, term), ilike(users.studentCode, term)))
      .limit(10);

    return rows.map((row) => {
      if (!row.campusCode || !row.campusName) {
        throw new Error("Missing related data");
      }
      return {
        id: row.id,
        email: row.email,
        fullName: row.fullName,
        studentCode: row.studentCode,
        campus: { code: row.campusCode, name: row.campusName },
        major:
          row.majorCode && row.majorName
            ? { code: row.majorCode, name: row.majorName }
            : null,
        curriculum:
          row.curriculumId && row.curriculumCode && row.curriculumName
            ? {
                id: row.curriculumId,
                majorId: "", // Not fully needed here or we can query it
                code: row.curriculumCode,
                name: row.curriculumName,
              }
            : null,
        role: row.role,
      };
    });
  }
}

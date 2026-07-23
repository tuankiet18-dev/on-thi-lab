import type {
  ProfileOptions,
  StudentProfile,
  UpsertStudentProfileInput,
} from "@onthilab/contracts";
import { and, asc, eq } from "drizzle-orm";
import type { OnThiLabDatabase } from "./index";
import { campuses, majors, users } from "./schema";

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
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
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
        role: users.role,
      })
      .from(users)
      .innerJoin(campuses, eq(users.campusId, campuses.id))
      .innerJoin(majors, eq(users.majorId, majors.id))
      .where(and(eq(users.cognitoSubject, subject), eq(users.isActive, true)))
      .limit(1);

    return row
      ? {
          id: row.id,
          email: row.email,
          fullName: row.fullName,
          studentCode: row.studentCode,
          campus: { code: row.campusCode, name: row.campusName },
          major: { code: row.majorCode, name: row.majorName },
          role: row.role,
        }
      : null;
  }

  async listOptions(): Promise<ProfileOptions> {
    const [campusRows, majorRows] = await Promise.all([
      this.db
        .select({ code: campuses.code, name: campuses.name })
        .from(campuses)
        .where(eq(campuses.isActive, true))
        .orderBy(asc(campuses.name)),
      this.db
        .select({ code: majors.code, name: majors.name })
        .from(majors)
        .orderBy(asc(majors.name)),
    ]);

    return { campuses: campusRows, majors: majorRows };
  }

  async upsert(
    identity: ProfileIdentity,
    input: UpsertStudentProfileInput,
  ): Promise<StudentProfile> {
    const [[campus], [major], [existingUser]] = await Promise.all([
      this.db
        .select({ id: campuses.id })
        .from(campuses)
        .where(
          and(eq(campuses.code, input.campusCode), eq(campuses.isActive, true)),
        )
        .limit(1),
      this.db
        .select({ id: majors.id })
        .from(majors)
        .where(eq(majors.code, input.majorCode))
        .limit(1),
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
    if (!major) {
      throw new ProfileRepositoryError(
        "MAJOR_NOT_FOUND",
        "Major is not available",
      );
    }

    try {
      await this.db
        .insert(users)
        .values({
          cognitoSubject: identity.subject,
          email: identity.email,
          fullName: input.fullName,
          studentCode: input.studentCode,
          campusId: campus.id,
          majorId: major.id,
        })
        .onConflictDoUpdate({
          target: users.cognitoSubject,
          set: {
            email: identity.email,
            fullName: input.fullName,
            studentCode: input.studentCode,
            campusId: campus.id,
            majorId: major.id,
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
}

import type {
  AdminUserFilter,
  AdminUserListResponse,
  AdminUserSummary,
  ProfileOptions,
  StudentProfile,
  UpsertStudentProfileInput,
  UserRole,
} from "@onthilab/contracts";
import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import type { OnThiLabDatabase } from "./index";
import { attempts, campuses, curricula, majors, users } from "./schema";

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
  findById(userId: string): Promise<StudentProfile | null>;
  listOptions(): Promise<ProfileOptions>;
  upsert(
    identity: ProfileIdentity,
    input: UpsertStudentProfileInput,
  ): Promise<StudentProfile>;
  updateRole(userId: string, role: UserRole): Promise<void>;
  updateStatus(userId: string, isActive: boolean): Promise<void>;
  listUsersForAdmin(filter: AdminUserFilter): Promise<AdminUserListResponse>;
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
        curriculumMajorId: curricula.majorId,
        curriculumCode: curricula.code,
        curriculumName: curricula.name,
        role: users.role,
        isActive: users.isActive,
      })
      .from(users)
      .innerJoin(campuses, eq(users.campusId, campuses.id))
      .leftJoin(majors, eq(users.majorId, majors.id))
      .leftJoin(curricula, eq(users.curriculumId, curricula.id))
      .where(eq(users.cognitoSubject, subject))
      .limit(1);

    if (!row) {
      return null;
    }

    if (!row.isActive) {
      throw new ProfileRepositoryError(
        "PROFILE_DISABLED",
        "Tài khoản của bạn đã bị khóa bởi quản trị viên.",
      );
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
      curriculum: row.curriculumId
        ? {
            id: row.curriculumId,
            majorId: row.curriculumMajorId!,
            code: row.curriculumCode!,
            name: row.curriculumName!,
          }
        : null,
      role: row.role,
    };
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

  async findById(userId: string): Promise<StudentProfile | null> {
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
        curriculumMajorId: curricula.majorId,
        curriculumCode: curricula.code,
        curriculumName: curricula.name,
        role: users.role,
      })
      .from(users)
      .leftJoin(campuses, eq(users.campusId, campuses.id))
      .leftJoin(majors, eq(users.majorId, majors.id))
      .leftJoin(curricula, eq(users.curriculumId, curricula.id))
      .where(eq(users.id, userId))
      .limit(1);

    return row && row.campusCode && row.campusName
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
          curriculum:
            row.curriculumId &&
            row.curriculumMajorId &&
            row.curriculumCode &&
            row.curriculumName
              ? {
                  id: row.curriculumId,
                  majorId: row.curriculumMajorId,
                  code: row.curriculumCode,
                  name: row.curriculumName,
                }
              : null,
          role: row.role,
        }
      : null;
  }

  async updateRole(userId: string, role: UserRole): Promise<void> {
    await this.db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async updateStatus(userId: string, isActive: boolean): Promise<void> {
    await this.db
      .update(users)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async listUsersForAdmin(
    filter: AdminUserFilter,
  ): Promise<AdminUserListResponse> {
    const conditions = [];

    if (filter.search && filter.search.trim().length > 0) {
      const term = `%${filter.search.trim()}%`;
      conditions.push(
        or(
          ilike(users.fullName, term),
          ilike(users.email, term),
          ilike(users.studentCode, term),
        ),
      );
    }

    if (filter.role && filter.role !== "all") {
      conditions.push(eq(users.role, filter.role));
    }

    if (filter.campusCode && filter.campusCode !== "all") {
      conditions.push(eq(campuses.code, filter.campusCode));
    }

    if (filter.status === "active") {
      conditions.push(eq(users.isActive, true));
    } else if (filter.status === "disabled") {
      conditions.push(eq(users.isActive, false));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const page = Math.max(1, filter.page ?? 1);
    const limit = Math.min(100, Math.max(1, filter.limit ?? 20));
    const offset = (page - 1) * limit;

    const [statsRow, totalRow, rows] = await Promise.all([
      this.db
        .select({
          totalUsers: count(sql`CASE WHEN ${users.role} = 'user' THEN 1 END`),
          totalContributors: count(
            sql`CASE WHEN ${users.role} = 'contributor' THEN 1 END`,
          ),
          totalAdmins: count(sql`CASE WHEN ${users.role} = 'admin' THEN 1 END`),
          totalDisabled: count(
            sql`CASE WHEN ${users.isActive} = false THEN 1 END`,
          ),
        })
        .from(users)
        .then(([r]) => r),
      this.db
        .select({ total: count(users.id) })
        .from(users)
        .leftJoin(campuses, eq(users.campusId, campuses.id))
        .where(whereClause)
        .then(([r]) => r),
      this.db
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
          curriculumMajorId: curricula.majorId,
          curriculumCode: curricula.code,
          curriculumName: curricula.name,
          role: users.role,
          isActive: users.isActive,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
          attemptsCount: sql<number>`cast(count(${attempts.id}) as integer)`,
        })
        .from(users)
        .leftJoin(campuses, eq(users.campusId, campuses.id))
        .leftJoin(majors, eq(users.majorId, majors.id))
        .leftJoin(curricula, eq(users.curriculumId, curricula.id))
        .leftJoin(attempts, eq(attempts.userId, users.id))
        .where(whereClause)
        .groupBy(
          users.id,
          campuses.code,
          campuses.name,
          majors.code,
          majors.name,
          curricula.id,
          curricula.majorId,
          curricula.code,
          curricula.name,
        )
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset(offset),
    ]);

    const total = totalRow?.total ?? 0;

    const items: AdminUserSummary[] = rows.map((row) => ({
      id: row.id,
      email: row.email,
      fullName: row.fullName,
      studentCode: row.studentCode,
      campus:
        row.campusCode && row.campusName
          ? { code: row.campusCode, name: row.campusName }
          : null,
      major:
        row.majorCode && row.majorName
          ? { code: row.majorCode, name: row.majorName }
          : null,
      curriculum:
        row.curriculumId &&
        row.curriculumMajorId &&
        row.curriculumCode &&
        row.curriculumName
          ? {
              id: row.curriculumId,
              majorId: row.curriculumMajorId,
              code: row.curriculumCode,
              name: row.curriculumName,
            }
          : null,
      role: row.role,
      isActive: row.isActive,
      attemptsCount: Number(row.attemptsCount || 0),
      createdAt: row.createdAt
        ? new Date(row.createdAt).toISOString()
        : new Date().toISOString(),
      updatedAt: row.updatedAt
        ? new Date(row.updatedAt).toISOString()
        : new Date().toISOString(),
    }));

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
      stats: {
        totalUsers: Number(statsRow?.totalUsers ?? 0),
        totalContributors: Number(statsRow?.totalContributors ?? 0),
        totalAdmins: Number(statsRow?.totalAdmins ?? 0),
        totalDisabled: Number(statsRow?.totalDisabled ?? 0),
      },
    };
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
        curriculumMajorId: curricula.majorId,
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
          row.curriculumId &&
          row.curriculumMajorId &&
          row.curriculumCode &&
          row.curriculumName
            ? {
                id: row.curriculumId,
                majorId: row.curriculumMajorId,
                code: row.curriculumCode,
                name: row.curriculumName,
              }
            : null,
        role: row.role,
      };
    });
  }
}

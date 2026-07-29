import type {
  CreateDraftImportInput,
  BookmarkCollection,
  ProfileOptions,
  StudentProfile,
  UpsertStudentProfileInput,
  Feedback,
} from "@onthilab/contracts";
import type {
  ProfileIdentity,
  UserProfileRepository,
} from "@onthilab/database";
import {
  AdminCatalogRepositoryError,
  type AdminCatalogRepository,
  type BookmarkRepository,
} from "@onthilab/database";
import { describe, expect, it } from "vitest";
import type { AuthIdentity, TokenVerifier } from "./auth";
import { app, createApp } from "./app";
import { demoExam } from "./fixtures";

const identity: AuthIdentity = {
  subject: "cognito-user-1",
  email: "student@example.com",
  emailVerified: true,
  name: "Lương Tuấn Kiệt",
  groups: [],
};

const auth: TokenVerifier = {
  verify: async (token) => {
    if (token !== "valid-id-token") throw new Error("Invalid token");
    return identity;
  },
};

const authorization = { Authorization: "Bearer valid-id-token" };

class MemoryProfileRepository implements UserProfileRepository {
  profile: StudentProfile | null = null;
  readonly options: ProfileOptions = {
    campuses: [{ code: "HL", name: "Hòa Lạc" }],
    majors: [{ code: "SE", name: "Software Engineering" }],
    curricula: [{ id: "cr1", majorId: "m1", code: "SE_2024", name: "SE 2024" }],
  };

  async findBySubject(subject: string) {
    return subject === identity.subject ? this.profile : null;
  }

  async listOptions() {
    return this.options;
  }

  async upsert(
    profileIdentity: ProfileIdentity,
    input: UpsertStudentProfileInput,
  ) {
    this.profile = {
      id: "10000000-0000-4000-8000-000000000001",
      email: profileIdentity.email,
      fullName: input.fullName,
      studentCode: input.studentCode ?? null,
      campus: this.options.campuses[0]!,
      major: input.majorCode ? this.options.majors[0]! : null,
      curriculum: null,
      role: "user",
    };
    return this.profile;
  }

  async updateRole(
    userId: string,
    role: "user" | "contributor" | "admin",
  ): Promise<void> {
    if (this.profile && this.profile.id === userId) {
      this.profile = { ...this.profile, role };
    }
  }

  async searchUsers(query: string): Promise<StudentProfile[]> {
    if (!this.profile) return [];
    if (
      this.profile.email.includes(query) ||
      this.profile.studentCode?.includes(query)
    ) {
      return [this.profile];
    }
    return [];
  }
}

class MemoryBookmarkRepository implements BookmarkRepository {
  readonly savedExamIds = new Set<string>();
  readonly savedQuestionIds = new Set<string>();
  lastUserId: string | null = null;

  async listForUser(userId: string): Promise<BookmarkCollection> {
    this.lastUserId = userId;
    return { exams: [], questions: [] };
  }

  async saveExam(userId: string, examId: string): Promise<void> {
    this.lastUserId = userId;
    this.savedExamIds.add(examId);
  }

  async removeExam(userId: string, examId: string): Promise<void> {
    this.lastUserId = userId;
    this.savedExamIds.delete(examId);
  }

  async saveQuestion(userId: string, questionId: string): Promise<void> {
    this.lastUserId = userId;
    this.savedQuestionIds.add(questionId);
  }

  async removeQuestion(userId: string, questionId: string): Promise<void> {
    this.lastUserId = userId;
    this.savedQuestionIds.delete(questionId);
  }
}

function createOnboardedProfiles(
  role: StudentProfile["role"] = "user",
): MemoryProfileRepository {
  const profiles = new MemoryProfileRepository();
  profiles.profile = {
    id: "10000000-0000-4000-8000-000000000001",
    email: identity.email,
    fullName: identity.name,
    studentCode: "HE170001",
    campus: profiles.options.campuses[0]!,
    major: profiles.options.majors[0]!,
    curriculum: null,
    role,
  };
  return profiles;
}

describe("attempt API", () => {
  it("creates feedback for onboarded users and lets only admins resolve it", async () => {
    const feedbackId = "70000000-0000-4000-8000-000000000001";
    let item: Feedback | null = null;
    const feedback = {
      create: async (
        userId: string,
        input: { title: string; detail: string },
      ) => {
        item = {
          id: feedbackId,
          userId,
          title: input.title,
          detail: input.detail,
          status: "new" as const,
          createdAt: "2026-07-29T05:00:00.000Z",
          updatedAt: "2026-07-29T05:00:00.000Z",
        };
        return item;
      },
      listNew: async () => (item ? [item] : []),
      resolve: async (id: string) => {
        if (!item || id !== feedbackId) return null;
        item = { ...item, status: "resolved" as const };
        return item;
      },
    };

    const userApp = createApp({
      auth,
      profiles: createOnboardedProfiles(),
      feedback,
    });
    const created = await userApp.request("/v1/feedback", {
      method: "POST",
      headers: { ...authorization, "content-type": "application/json" },
      body: JSON.stringify({
        title: "Góp ý tính năng",
        detail: "Mong muốn có thêm chế độ ôn nhanh.",
      }),
    });
    expect(created.status).toBe(201);
    await expect(created.json()).resolves.toMatchObject({
      data: { id: feedbackId, status: "new" },
    });

    const forbidden = await userApp.request("/v1/admin/feedback", {
      headers: authorization,
    });
    expect(forbidden.status).toBe(403);

    const adminApp = createApp({
      auth,
      profiles: createOnboardedProfiles("admin"),
      feedback,
    });
    const listed = await adminApp.request("/v1/admin/feedback", {
      headers: authorization,
    });
    expect(listed.status).toBe(200);
    await expect(listed.json()).resolves.toMatchObject({
      data: [{ id: feedbackId }],
    });

    const resolved = await adminApp.request(
      `/v1/admin/feedback/${feedbackId}/resolve`,
      { method: "POST", headers: authorization },
    );
    expect(resolved.status).toBe(200);
    await expect(resolved.json()).resolves.toMatchObject({
      data: { status: "resolved" },
    });

    const invalidId = await adminApp.request(
      "/v1/admin/feedback/not-a-uuid/resolve",
      { method: "POST", headers: authorization },
    );
    expect(invalidId.status).toBe(400);
  });

  it("rejects short feedback content", async () => {
    const isolatedApp = createApp({
      auth,
      profiles: createOnboardedProfiles(),
    });
    const response = await isolatedApp.request("/v1/feedback", {
      method: "POST",
      headers: { ...authorization, "content-type": "application/json" },
      body: JSON.stringify({ title: "Lỗi", detail: "ngắn" }),
    });
    expect(response.status).toBe(400);
  });

  it("rejects protected routes without a bearer token", async () => {
    const response = await app.request("/v1/catalog");
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "UNAUTHORIZED" });
  });

  it("requires an onboarded contributor before issuing an upload URL", async () => {
    const imports = {
      createPresignedUploadUrl: async () => ({
        uploadUrl: "https://example.test/upload",
        key: "uploads/10000000-0000-4000-8000-000000000001/questions.zip",
      }),
      createDraft: async () => {
        throw new Error("not used");
      },
    };
    const isolatedApp = createApp({ auth, imports: imports as any });

    expect(
      (await isolatedApp.request("/v1/admin/imports/presign")).status,
    ).toBe(401);

    const contributorApp = createApp({
      auth,
      imports: imports as any,
      profiles: createOnboardedProfiles("contributor"),
    });
    const response = await contributorApp.request("/v1/admin/imports/presign", {
      headers: authorization,
    });
    expect(response.status).toBe(200);
  });

  it("requires onboarding before catalog and exam routes", async () => {
    const isolatedApp = createApp({
      auth,
      profiles: new MemoryProfileRepository(),
    });
    const response = await isolatedApp.request("/v1/catalog", {
      headers: authorization,
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "PROFILE_REQUIRED",
    });
  });

  it("stores bookmarks against the authenticated profile only", async () => {
    const bookmarks = new MemoryBookmarkRepository();
    const profiles = createOnboardedProfiles();
    const isolatedApp = createApp({ auth, profiles, bookmarks });
    const examId = "10000000-0000-4000-8000-000000000099";

    const unauthorized = await isolatedApp.request(
      `/v1/bookmarks/exams/${examId}`,
      {
        method: "PUT",
      },
    );
    expect(unauthorized.status).toBe(401);

    const saved = await isolatedApp.request(`/v1/bookmarks/exams/${examId}`, {
      method: "PUT",
      headers: authorization,
    });
    expect(saved.status).toBe(200);
    await expect(saved.json()).resolves.toEqual({ data: { bookmarked: true } });
    expect(bookmarks.savedExamIds).toEqual(new Set([examId]));
    expect(bookmarks.lastUserId).toBe(profiles.profile?.id);

    const removed = await isolatedApp.request(`/v1/bookmarks/exams/${examId}`, {
      method: "DELETE",
      headers: authorization,
    });
    expect(removed.status).toBe(200);
    expect(bookmarks.savedExamIds.size).toBe(0);
  });

  it("blocks non-admin users from accessing admin routes", async () => {
    const isolatedApp = createApp({
      auth,
      profiles: createOnboardedProfiles("contributor"),
      catalog: {
        listCampuses: async () => [],
        listMajors: async () => [],
        listCurricula: async () => [],
        listTermCourses: async () => [],
        listPublished: async () => [],
        findPublishedByIdOrCode: async () => null,
      },
      imports: {
        createDraft: async () => {
          throw new Error("Not implemented");
        },
      } as any,
    } as any);

    const response = await isolatedApp.request("/v1/admin/users/123/role", {
      method: "POST",
      headers: authorization,
      body: JSON.stringify({ role: "admin" }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "FORBIDDEN",
    });
  });

  it("returns published exams from the catalog", async () => {
    const isolatedApp = createApp({
      auth,
      profiles: createOnboardedProfiles(),
      catalog: {
        listCampuses: async () => [],
        listMajors: async () => [],
        listCurricula: async () => [],
        listTermCourses: async () => [],
        listPublished: async () => [],
        findPublishedByIdOrCode: async () => null,
      },
    });

    const response = await isolatedApp.request("/v1/catalog", {
      headers: authorization,
    });
    const body = (await response.json()) as { data: unknown[] };

    expect(response.status).toBe(200);
    expect(body.data).toEqual([]);
  });

  it("keeps published question image paths relative to the API base URL", async () => {
    const isolatedApp = createApp({
      auth,
      profiles: createOnboardedProfiles(),
      catalog: {
        listCampuses: async () => [],
        listMajors: async () => [],
        listCurricula: async () => [],
        listTermCourses: async () => [],
        listPublished: async () => [],
        findPublishedByIdOrCode: async () => ({
          ...demoExam,
          questions: [
            {
              ...demoExam.questions[0]!,
              imageUrl: "/question-images/drafts/example/Q1.jpg",
            },
          ],
        }),
      },
    });

    const response = await isolatedApp.request(
      "/v1/exams/demo-swd392-sp26-fe",
      { headers: authorization },
    );

    await expect(response.json()).resolves.toMatchObject({
      data: {
        questions: [{ imageUrl: "/question-images/drafts/example/Q1.jpg" }],
      },
    });
  });

  it("publishes an OpenAPI document", async () => {
    const response = await app.request("/openapi.json");
    const document = (await response.json()) as {
      openapi: string;
      paths: Record<string, unknown>;
    };

    expect(response.status).toBe(200);
    expect(document.openapi).toBe("3.1.0");
    expect(document.paths["/v1/attempts"]).toBeDefined();
    expect(document.paths["/v1/bookmarks"]).toBeDefined();
    expect(document.paths["/v1/admin/exams/{examId}/publish"]).toBeDefined();
    expect(
      document.paths["/v1/admin/exams/{examId}/ai-suggestions"],
    ).toBeDefined();
  });

  it("loads profile options and persists onboarding by Cognito subject", async () => {
    const profiles = new MemoryProfileRepository();
    const isolatedApp = createApp({ auth, profiles });

    const emptyResponse = await isolatedApp.request("/v1/me", {
      headers: authorization,
    });
    expect(emptyResponse.status).toBe(200);
    await expect(emptyResponse.json()).resolves.toEqual({ data: null });

    const optionsResponse = await isolatedApp.request("/v1/profile-options", {
      headers: authorization,
    });
    expect(optionsResponse.status).toBe(200);
    await expect(optionsResponse.json()).resolves.toEqual({
      data: profiles.options,
    });

    const saveResponse = await isolatedApp.request("/v1/me", {
      method: "PUT",
      headers: {
        ...authorization,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        fullName: "  Lương Tuấn Kiệt  ",
        studentCode: "he170001",
        campusCode: "HL",
        majorCode: "SE",
      }),
    });
    expect(saveResponse.status).toBe(200);
    const saved = (await saveResponse.json()) as {
      data: StudentProfile;
    };
    expect(saved.data).toMatchObject({
      email: identity.email,
      fullName: "Lương Tuấn Kiệt",
      studentCode: "HE170001",
      role: "user",
    });

    const loadedResponse = await isolatedApp.request("/v1/me", {
      headers: authorization,
    });
    await expect(loadedResponse.json()).resolves.toEqual(saved);
  });

  it("allows onboarding with only the required campus", async () => {
    const profiles = new MemoryProfileRepository();
    const isolatedApp = createApp({ auth, profiles });

    const response = await isolatedApp.request("/v1/me", {
      method: "PUT",
      headers: {
        ...authorization,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        fullName: "Lương Tuấn Kiệt",
        campusCode: "HL",
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { studentCode: null, major: null, curriculum: null },
    });
  });

  it("rejects malformed onboarding payloads", async () => {
    const isolatedApp = createApp({
      auth,
      profiles: new MemoryProfileRepository(),
    });
    const response = await isolatedApp.request("/v1/me", {
      method: "PUT",
      headers: {
        ...authorization,
        "content-type": "application/json",
      },
      body: "{",
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "INVALID_INPUT" });
  });

  it("allows contributors to validate imports but reserves publishing for admins", async () => {
    const contributorApp = createApp({
      auth,
      profiles: createOnboardedProfiles("contributor"),
    });
    const contributorResponse = await contributorApp.request(
      "/v1/admin/imports/config",
      { headers: authorization },
    );

    expect(contributorResponse.status).toBe(200);
    await expect(contributorResponse.json()).resolves.toMatchObject({
      data: {
        examType: "FE",
        minQuestionCount: 1,
        maxQuestionCount: 120,
        canPublish: false,
      },
    });

    const adminApp = createApp({
      auth,
      profiles: createOnboardedProfiles("admin"),
    });
    const adminResponse = await adminApp.request("/v1/admin/imports/config", {
      headers: authorization,
    });
    await expect(adminResponse.json()).resolves.toMatchObject({
      data: { canPublish: true },
    });
  });

  it("lets only admins update or delete catalog courses with validated IDs", async () => {
    const courseId = "20000000-0000-4000-8000-000000000001";
    const inUseCourseId = "20000000-0000-4000-8000-000000000002";
    let updated:
      | {
          id: string;
          input: { code: string; name: string; examFormatStatus: string };
        }
      | undefined;
    let deletedId: string | undefined;
    const adminCatalog: AdminCatalogRepository = {
      getAdminCatalog: async () => ({ majors: [], curricula: [], courses: [] }),
      createMajor: async () => {
        throw new Error("not used");
      },
      createCurriculum: async () => {
        throw new Error("not used");
      },
      createCourse: async () => {
        throw new Error("not used");
      },
      updateCourse: async (id, input) => {
        updated = { id, input };
        return {
          id,
          ...input,
          description: null,
          priorityWave: 1,
          placements: [],
        };
      },
      deleteCourse: async (id) => {
        if (id === inUseCourseId) {
          throw new AdminCatalogRepositoryError(
            "COURSE_IN_USE",
            "Môn học này đã có đề thi, không thể xóa.",
          );
        }
        deletedId = id;
      },
      upsertCurriculumCourse: async () => {},
    };
    const contributorApp = createApp({
      auth,
      profiles: createOnboardedProfiles("contributor"),
      adminCatalog,
    });
    const forbidden = await contributorApp.request(
      `/v1/admin/catalog-management/courses/${courseId}`,
      { method: "DELETE", headers: authorization },
    );
    expect(forbidden.status).toBe(403);

    const adminApp = createApp({
      auth,
      profiles: createOnboardedProfiles("admin"),
      adminCatalog,
    });
    const invalidId = await adminApp.request(
      "/v1/admin/catalog-management/courses/not-a-uuid",
      { method: "DELETE", headers: authorization },
    );
    expect(invalidId.status).toBe(400);

    const update = await adminApp.request(
      `/v1/admin/catalog-management/courses/${courseId}`,
      {
        method: "PUT",
        headers: { ...authorization, "content-type": "application/json" },
        body: JSON.stringify({
          code: "csd201",
          name: "  Data Structures and Algorithms  ",
          examFormatStatus: "requires_review",
        }),
      },
    );
    expect(update.status).toBe(200);
    expect(updated).toEqual({
      id: courseId,
      input: {
        code: "CSD201",
        name: "Data Structures and Algorithms",
        examFormatStatus: "requires_review",
      },
    });

    const inUse = await adminApp.request(
      `/v1/admin/catalog-management/courses/${inUseCourseId}`,
      { method: "DELETE", headers: authorization },
    );
    expect(inUse.status).toBe(409);
    await expect(inUse.json()).resolves.toMatchObject({
      error: "COURSE_IN_USE",
    });

    const deleted = await adminApp.request(
      `/v1/admin/catalog-management/courses/${courseId}`,
      { method: "DELETE", headers: authorization },
    );
    expect(deleted.status).toBe(200);
    expect(deletedId).toBe(courseId);
  });

  it("forbids regular users from import administration", async () => {
    const isolatedApp = createApp({
      auth,
      profiles: createOnboardedProfiles("user"),
    });
    const response = await isolatedApp.request("/v1/admin/imports/config", {
      headers: authorization,
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "FORBIDDEN" });
  });

  it("creates a draft using the actual question count from an admin ZIP upload", async () => {
    let receivedMetadata: CreateDraftImportInput | undefined;
    const isolatedApp = createApp({
      auth,
      profiles: createOnboardedProfiles("admin"),
      imports: {
        createDraft: async (input) => {
          receivedMetadata = input.metadata;
          expect(input.archive?.name).toBe("questions.zip");
          expect(input.creator.role).toBe("admin");
          return {
            examId: "20000000-0000-4000-8000-000000000001",
            revisionId: "30000000-0000-4000-8000-000000000001",
            examCode: "SWD392-SP26-FE",
            questionCount: 60,
            status: "draft",
          };
        },
      },
    });
    const form = new FormData();
    form.set(
      "metadata",
      JSON.stringify({
        courseCode: "swd392",
        semester: "sp26",
        campusCode: "HL",
        examType: "FE",
        isRetake: false,
        durationMinutes: 60,
      }),
    );
    form.set(
      "archive",
      new File([new Uint8Array([80, 75])], "questions.zip", {
        type: "application/zip",
      }),
    );

    const response = await isolatedApp.request("/v1/admin/imports", {
      method: "POST",
      headers: authorization,
      body: form,
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        examCode: "SWD392-SP26-FE",
        questionCount: 60,
        status: "draft",
      },
    });
    expect(receivedMetadata).toMatchObject({
      courseCode: "SWD392",
      semester: "SP26",
    });
  });

  it("loads a draft, audits answer edits and marks a complete review ready", async () => {
    const examId = "20000000-0000-4000-8000-000000000001";
    const questionId = "40000000-0000-4000-8000-000000000001";
    let changedBy = "";
    const isolatedApp = createApp({
      auth,
      profiles: createOnboardedProfiles("contributor"),
      reviews: {
        findDrafts: async () => [],
        findAllExams: async () => [],
        deleteExam: async () => {},
        findReview: async () => ({
          examId,
          revisionId: "30000000-0000-4000-8000-000000000001",
          examCode: "SWD392-SP26-FE",
          courseCode: "SWD392",
          courseName: "Software Architecture and Design",
          semester: "SP26",
          campus: { code: "HL", name: "Hòa Lạc" },
          durationMinutes: 60,
          isRetake: false,
          status: "draft",
          publishedAt: null,
          answeredCount: 0,
          questionCount: 1,
          questions: [
            {
              id: questionId,
              order: 1,
              imageKey: "drafts/example/Q1.jpg",
              type: "single",
              options: ["A", "B", "C", "D"],
              correctOptions: [],
              aiSuggestion: null,
            },
          ],
        }),
        saveAnswer: async (input) => {
          changedBy = input.changedBy;
          return {
            id: questionId,
            order: 1,
            imageKey: "drafts/example/Q1.jpg",
            type: input.answer.type,
            options: ["A", "B", "C", "D"],
            correctOptions: input.answer.correctOptions,
            aiSuggestion: null,
          };
        },
        markReady: async () => ({
          examId,
          status: "review",
          answeredCount: 1,
          questionCount: 1,
        }),
        publish: async () => ({
          examId,
          revisionId: "30000000-0000-4000-8000-000000000001",
          status: "published",
          publishedAt: "2026-07-24T06:00:00.000Z",
        }),
      },
    });

    const reviewResponse = await isolatedApp.request(
      `/v1/admin/exams/${examId}/review`,
      { headers: authorization },
    );
    expect(reviewResponse.status).toBe(200);
    await expect(reviewResponse.json()).resolves.toMatchObject({
      data: {
        examCode: "SWD392-SP26-FE",
        questions: [
          {
            id: questionId,
            imageUrl: "/question-images/drafts/example/Q1.jpg",
          },
        ],
      },
    });

    const saveResponse = await isolatedApp.request(
      `/v1/admin/exams/${examId}/questions/${questionId}/answer`,
      {
        method: "PUT",
        headers: {
          ...authorization,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          type: "single",
          optionCount: 4,
          correctOptions: [1],
        }),
      },
    );
    expect(saveResponse.status).toBe(200);
    expect(changedBy).toBe("10000000-0000-4000-8000-000000000001");

    const readyResponse = await isolatedApp.request(
      `/v1/admin/exams/${examId}/ready`,
      { method: "POST", headers: authorization },
    );
    await expect(readyResponse.json()).resolves.toMatchObject({
      data: { status: "review", answeredCount: 1 },
    });
  });

  it("allows only admins to publish a reviewed exam", async () => {
    const examId = "20000000-0000-4000-8000-000000000001";
    const reviews = {
      findDrafts: async () => [],
      findAllExams: async () => [],
      deleteExam: async () => {},
      findReview: async () => null,
      saveAnswer: async () => {
        throw new Error("not used");
      },
      markReady: async () => {
        throw new Error("not used");
      },
      publish: async (_examId: string, approvedBy: string) => ({
        examId,
        revisionId: "30000000-0000-4000-8000-000000000001",
        status: "published" as const,
        publishedAt: "2026-07-24T06:00:00.000Z",
        approvedBy,
      }),
    };
    const contributorApp = createApp({
      auth,
      profiles: createOnboardedProfiles("contributor"),
      reviews,
    });
    const forbidden = await contributorApp.request(
      `/v1/admin/exams/${examId}/publish`,
      { method: "POST", headers: authorization },
    );
    expect(forbidden.status).toBe(403);

    const deleteForbidden = await contributorApp.request(
      `/v1/admin/exams/${examId}`,
      { method: "DELETE", headers: authorization },
    );
    expect(deleteForbidden.status).toBe(403);

    const adminApp = createApp({
      auth,
      profiles: createOnboardedProfiles("admin"),
      reviews,
    });
    const published = await adminApp.request(
      `/v1/admin/exams/${examId}/publish`,
      { method: "POST", headers: authorization },
    );
    expect(published.status).toBe(200);
    await expect(published.json()).resolves.toMatchObject({
      data: { status: "published" },
    });
  });

  it("allows only admins to queue cost-bearing AI suggestions", async () => {
    const examId = "20000000-0000-4000-8000-000000000001";
    let queuedExamId = "";
    const suggestions = {
      queueExam: async (inputExamId: string) => {
        queuedExamId = inputExamId;
        return { examId: inputExamId, queuedCount: 58, skippedCount: 2 };
      },
    };
    const contributorApp = createApp({
      auth,
      profiles: createOnboardedProfiles("contributor"),
      suggestions,
    });
    const forbidden = await contributorApp.request(
      `/v1/admin/exams/${examId}/ai-suggestions`,
      { method: "POST", headers: authorization },
    );
    expect(forbidden.status).toBe(403);

    const adminApp = createApp({
      auth,
      profiles: createOnboardedProfiles("admin"),
      suggestions,
    });
    const queued = await adminApp.request(
      `/v1/admin/exams/${examId}/ai-suggestions`,
      { method: "POST", headers: authorization },
    );
    expect(queued.status).toBe(202);
    expect(queuedExamId).toBe(examId);
    await expect(queued.json()).resolves.toEqual({
      data: { examId, queuedCount: 58, skippedCount: 2 },
    });
  });

  it("serves local question images with a safe content type", async () => {
    const isolatedApp = createApp({
      images: {
        read: async (key) =>
          key === "drafts/example/Q1.jpg"
            ? {
                bytes: new Uint8Array([255, 216, 255]),
                contentType: "image/jpeg",
              }
            : null,
      },
    });

    const response = await isolatedApp.request(
      "/question-images/drafts/example/Q1.jpg",
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("cross-origin-resource-policy")).toBe(
      "cross-origin",
    );
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("creates, saves and submits an attempt idempotently", async () => {
    const isolatedApp = createApp({
      auth,
      profiles: createOnboardedProfiles(),
    });
    const createResponse = await isolatedApp.request("/v1/attempts", {
      method: "POST",
      headers: {
        ...authorization,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        examId: "demo-swd392-sp26-fe",
        deviceId: "test-device-0001",
      }),
    });
    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()) as {
      data: { attempt: { id: string } };
    };
    const activeResponse = await isolatedApp.request(
      `/v1/attempts/${created.data.attempt.id}`,
      { headers: authorization },
    );
    const activeBody = (await activeResponse.json()) as {
      data: { correctAnswers?: unknown };
    };
    expect(activeBody.data.correctAnswers).toBeUndefined();

    const activeSessionResponse = await isolatedApp.request(
      `/v1/attempts/${created.data.attempt.id}/session`,
      { headers: authorization },
    );
    expect(activeSessionResponse.status).toBe(200);
    expect(activeSessionResponse.headers.get("cache-control")).toBe(
      "private, no-store",
    );
    await expect(activeSessionResponse.json()).resolves.toMatchObject({
      data: {
        attempt: { id: created.data.attempt.id },
        exam: {
          id: "demo-swd392-sp26-fe",
          questions: expect.arrayContaining([
            expect.objectContaining({ id: "q1" }),
          ]),
        },
      },
    });

    const answerResponse = await isolatedApp.request(
      `/v1/attempts/${created.data.attempt.id}/answers`,
      {
        method: "PUT",
        headers: {
          ...authorization,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          questionId: "q1",
          selectedOptions: [1],
          sequence: 1,
        }),
      },
    );
    expect(answerResponse.status).toBe(200);

    const submitResponse = await isolatedApp.request(
      `/v1/attempts/${created.data.attempt.id}/submit`,
      {
        method: "POST",
        headers: {
          ...authorization,
          "content-type": "application/json",
        },
        body: JSON.stringify({ reason: "user" }),
      },
    );
    expect(submitResponse.status).toBe(200);

    const secondSubmitResponse = await isolatedApp.request(
      `/v1/attempts/${created.data.attempt.id}/submit`,
      {
        method: "POST",
        headers: {
          ...authorization,
          "content-type": "application/json",
        },
        body: JSON.stringify({ reason: "user" }),
      },
    );
    const secondBody = (await secondSubmitResponse.json()) as {
      idempotent: boolean;
    };
    expect(secondBody.idempotent).toBe(true);

    const submittedResponse = await isolatedApp.request(
      `/v1/attempts/${created.data.attempt.id}`,
      { headers: authorization },
    );
    await expect(submittedResponse.json()).resolves.toMatchObject({
      data: {
        status: "submitted",
        correctAnswers: { q1: [1] },
      },
    });
  });

  it("allows a student to start more than two practice attempts", async () => {
    const isolatedApp = createApp({
      auth,
      profiles: createOnboardedProfiles(),
    });

    const responses = await Promise.all(
      ["unlimited-device-1", "unlimited-device-2", "unlimited-device-3"].map(
        (deviceId) =>
          isolatedApp.request("/v1/attempts", {
            method: "POST",
            headers: {
              ...authorization,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              examId: "demo-swd392-sp26-fe",
              deviceId,
            }),
          }),
      ),
    );

    expect(responses.map((response) => response.status)).toEqual([
      201, 201, 201,
    ]);
  });
});

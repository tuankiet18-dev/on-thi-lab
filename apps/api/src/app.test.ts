import type {
  CreateDraftImportInput,
  ProfileOptions,
  StudentProfile,
  UpsertStudentProfileInput,
} from "@onthilab/contracts";
import type {
  ProfileIdentity,
  UserProfileRepository,
} from "@onthilab/database";
import { AttemptRepositoryError } from "@onthilab/database";
import { describe, expect, it } from "vitest";
import type { AuthIdentity, TokenVerifier } from "./auth";
import { app, createApp } from "./app";

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
      studentCode: input.studentCode,
      campus: this.options.campuses[0]!,
      major: this.options.majors[0]!,
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
      this.profile.studentCode.includes(query)
    ) {
      return [this.profile];
    }
    return [];
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

  it("returns the authenticated student's remaining free attempts", async () => {
    const isolatedApp = createApp({
      auth,
      profiles: createOnboardedProfiles(),
    });

    const response = await isolatedApp.request("/v1/me/usage", {
      headers: authorization,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: { attemptsStarted: 0, limit: 2, remainingAttempts: 2 },
    });
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

  it("publishes an OpenAPI document", async () => {
    const response = await app.request("/openapi.json");
    const document = (await response.json()) as {
      openapi: string;
      paths: Record<string, unknown>;
    };

    expect(response.status).toBe(200);
    expect(document.openapi).toBe("3.1.0");
    expect(document.paths["/v1/attempts"]).toBeDefined();
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
        expectedQuestionCount: 60,
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

  it("creates a 60-question draft from an admin ZIP upload", async () => {
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
            imageUrl: "http://localhost/question-images/drafts/example/Q1.jpg",
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

  it("returns a clear limit response after two free attempts", async () => {
    const isolatedApp = createApp({
      auth,
      profiles: createOnboardedProfiles(),
      attempts: {
        createOrResume: async () => {
          throw new AttemptRepositoryError(
            "DAILY_LIMIT_REACHED",
            "Bạn đã dùng hết 2 lượt thi miễn phí hôm nay.",
          );
        },
        findForUser: async () => null,
        listUserAttempts: async () => [],
        saveAnswer: async () => {
          throw new Error("not used");
        },
        submit: async () => {
          throw new Error("not used");
        },
        getStatistics: async () => {
          throw new Error("not used");
        },
        getDailyUsage: async () => {
          throw new Error("not used");
        },
      },
    });
    const response = await isolatedApp.request("/v1/attempts", {
      method: "POST",
      headers: {
        ...authorization,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        examId: "20000000-0000-4000-8000-000000000001",
        deviceId: "test-device-0001",
      }),
    });

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({
      error: "DAILY_LIMIT_REACHED",
    });
  });
});

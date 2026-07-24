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
import { describe, expect, it } from "vitest";
import type { AuthIdentity, TokenVerifier } from "./auth";
import { app, createApp } from "./app";

const identity: AuthIdentity = {
  subject: "cognito-user-1",
  email: "student@example.com",
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
      role: "user",
    };
    return this.profile;
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

  it("uses the injected catalog repository", async () => {
    const isolatedApp = createApp({
      auth,
      profiles: createOnboardedProfiles(),
      catalog: {
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
          expect(input.archive.name).toBe("questions.zip");
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
      data: { id: string };
    };

    const answerResponse = await isolatedApp.request(
      `/v1/attempts/${created.data.id}/answers`,
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
      `/v1/attempts/${created.data.id}/submit`,
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
      `/v1/attempts/${created.data.id}/submit`,
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
  });
});

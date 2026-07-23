import type {
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

function createOnboardedProfiles(): MemoryProfileRepository {
  const profiles = new MemoryProfileRepository();
  profiles.profile = {
    id: "10000000-0000-4000-8000-000000000001",
    email: identity.email,
    fullName: identity.name,
    studentCode: "HE170001",
    campus: profiles.options.campuses[0]!,
    major: profiles.options.majors[0]!,
    role: "user",
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

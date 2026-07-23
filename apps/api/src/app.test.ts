import { describe, expect, it } from "vitest";
import { app, createApp } from "./app";

describe("attempt API", () => {
  it("uses the injected catalog repository", async () => {
    const isolatedApp = createApp({
      catalog: {
        listPublished: async () => [],
        findPublishedByIdOrCode: async () => null,
      },
    });

    const response = await isolatedApp.request("/v1/catalog");
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

  it("creates, saves and submits an attempt idempotently", async () => {
    const createResponse = await app.request("/v1/attempts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        examId: "demo-swd392-sp26-fe",
        deviceId: "test-device-0001",
      }),
    });
    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()) as {
      data: { id: string };
    };

    const answerResponse = await app.request(
      `/v1/attempts/${created.data.id}/answers`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          questionId: "q1",
          selectedOptions: [1],
          sequence: 1,
        }),
      },
    );
    expect(answerResponse.status).toBe(200);

    const submitResponse = await app.request(
      `/v1/attempts/${created.data.id}/submit`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "user" }),
      },
    );
    expect(submitResponse.status).toBe(200);

    const secondSubmitResponse = await app.request(
      `/v1/attempts/${created.data.id}/submit`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "user" }),
      },
    );
    const secondBody = (await secondSubmitResponse.json()) as {
      idempotent: boolean;
    };
    expect(secondBody.idempotent).toBe(true);
  });
});

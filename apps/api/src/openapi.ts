export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "OnThiLab API",
    version: "0.1.0",
    description: "Internal API contract for the OnThiLab FE practice platform.",
  },
  servers: [{ url: "http://localhost:8787", description: "Local development" }],
  paths: {
    "/health": {
      get: {
        operationId: "getHealth",
        tags: ["System"],
        responses: {
          "200": {
            description: "Service health",
          },
        },
      },
    },
    "/v1/catalog": {
      get: {
        operationId: "listPublishedExams",
        tags: ["Catalog"],
        responses: {
          "200": {
            description: "Published exams visible to the current user",
          },
        },
      },
    },
    "/v1/exams/{examId}": {
      get: {
        operationId: "getExam",
        tags: ["Catalog"],
        parameters: [
          {
            in: "path",
            name: "examId",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": { description: "Exam details" },
          "404": { description: "Exam not found" },
        },
      },
    },
    "/v1/attempts": {
      post: {
        operationId: "createOrResumeAttempt",
        tags: ["Attempts"],
        responses: {
          "201": { description: "Attempt created" },
          "200": { description: "Active attempt resumed" },
          "409": { description: "Attempt conflict" },
        },
      },
    },
    "/v1/attempts/{attemptId}/answers": {
      put: {
        operationId: "saveAttemptAnswer",
        tags: ["Attempts"],
        parameters: [
          {
            in: "path",
            name: "attemptId",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": { description: "Answer saved" },
          "409": { description: "Attempt is closed or expired" },
        },
      },
    },
    "/v1/attempts/{attemptId}/submit": {
      post: {
        operationId: "submitAttempt",
        tags: ["Attempts"],
        parameters: [
          {
            in: "path",
            name: "attemptId",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": { description: "Idempotent submission result" },
          "404": { description: "Attempt not found" },
        },
      },
    },
  },
} as const;

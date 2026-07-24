export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "OnThiLab API",
    version: "0.2.0",
    description: "Internal API contract for the OnThiLab FE practice platform.",
  },
  servers: [{ url: "http://localhost:8787", description: "Local development" }],
  components: {
    securitySchemes: {
      cognitoIdToken: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "A verified Cognito ID token.",
      },
    },
  },
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
    "/v1/me": {
      get: {
        operationId: "getCurrentStudentProfile",
        tags: ["Profile"],
        security: [{ cognitoIdToken: [] }],
        responses: {
          "200": { description: "Current profile or null before onboarding" },
          "401": { description: "Missing, invalid or expired token" },
        },
      },
      put: {
        operationId: "upsertCurrentStudentProfile",
        tags: ["Profile"],
        security: [{ cognitoIdToken: [] }],
        responses: {
          "200": { description: "Profile saved" },
          "400": { description: "Invalid profile, campus or major" },
          "409": { description: "Email or student code already exists" },
        },
      },
    },
    "/v1/profile-options": {
      get: {
        operationId: "listProfileOptions",
        tags: ["Profile"],
        security: [{ cognitoIdToken: [] }],
        responses: {
          "200": { description: "Active campuses and majors" },
          "401": { description: "Missing, invalid or expired token" },
        },
      },
    },
    "/v1/admin/imports/config": {
      get: {
        operationId: "getImportConstraints",
        tags: ["Admin imports"],
        security: [{ cognitoIdToken: [] }],
        responses: {
          "200": {
            description: "FE ZIP constraints and publishing capability",
          },
          "403": { description: "Contributor or admin role required" },
        },
      },
    },
    "/v1/admin/imports": {
      post: {
        operationId: "createDraftExamImport",
        tags: ["Admin imports"],
        security: [{ cognitoIdToken: [] }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["metadata", "archive"],
                properties: {
                  metadata: {
                    type: "string",
                    description: "JSON-encoded FE exam metadata",
                  },
                  archive: {
                    type: "string",
                    format: "binary",
                    description: "ZIP containing exactly Q1–Q60 images",
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Draft exam and revision created" },
          "400": { description: "Invalid metadata, ZIP or catalog reference" },
          "403": { description: "Contributor or admin role required" },
          "409": { description: "Exam identifier already exists" },
          "413": { description: "Archive exceeds the configured limit" },
        },
      },
    },
    "/v1/catalog": {
      get: {
        operationId: "listPublishedExams",
        tags: ["Catalog"],
        security: [{ cognitoIdToken: [] }],
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
        security: [{ cognitoIdToken: [] }],
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
        security: [{ cognitoIdToken: [] }],
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
        security: [{ cognitoIdToken: [] }],
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
        security: [{ cognitoIdToken: [] }],
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

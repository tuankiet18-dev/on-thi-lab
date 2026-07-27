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
    "/v1/me/usage": {
      get: {
        operationId: "getDailyUsage",
        tags: ["Attempts"],
        security: [{ cognitoIdToken: [] }],
        responses: {
          "200": {
            description:
              "Number of attempts started today and the user's current limit",
          },
          "401": { description: "Missing, invalid or expired token" },
          "403": { description: "Profile onboarding is required" },
        },
      },
    },
    "/v1/bookmarks": {
      get: {
        operationId: "listBookmarks",
        tags: ["Bookmarks"],
        security: [{ cognitoIdToken: [] }],
        responses: {
          "200": { description: "Saved published exams and questions" },
          "401": { description: "Missing, invalid or expired token" },
          "403": { description: "Profile onboarding is required" },
        },
      },
    },
    "/v1/bookmarks/exams/{examId}": {
      put: {
        operationId: "saveExamBookmark",
        tags: ["Bookmarks"],
        security: [{ cognitoIdToken: [] }],
        responses: {
          "200": { description: "Exam saved" },
          "404": { description: "Published exam not found" },
        },
      },
      delete: {
        operationId: "removeExamBookmark",
        tags: ["Bookmarks"],
        security: [{ cognitoIdToken: [] }],
        responses: { "200": { description: "Exam bookmark removed" } },
      },
    },
    "/v1/bookmarks/questions/{questionId}": {
      put: {
        operationId: "saveQuestionBookmark",
        tags: ["Bookmarks"],
        security: [{ cognitoIdToken: [] }],
        responses: {
          "200": { description: "Question saved" },
          "404": { description: "Published question not found" },
        },
      },
      delete: {
        operationId: "removeQuestionBookmark",
        tags: ["Bookmarks"],
        security: [{ cognitoIdToken: [] }],
        responses: { "200": { description: "Question bookmark removed" } },
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
    "/v1/admin/drafts": {
      get: {
        operationId: "listDraftExams",
        tags: ["Admin imports"],
        security: [{ cognitoIdToken: [] }],
        responses: {
          "200": {
            description: "List of drafted exams",
          },
          "403": { description: "Contributor or admin role required" },
        },
      },
    },
    "/v1/admin/exams": {
      get: {
        operationId: "listAllExams",
        tags: ["Admin exams"],
        security: [{ cognitoIdToken: [] }],
        responses: {
          "200": {
            description: "List of all exams",
          },
          "403": { description: "Contributor or admin role required" },
        },
      },
    },
    "/v1/admin/exams/{examId}": {
      delete: {
        operationId: "deleteExam",
        tags: ["Admin exams"],
        security: [{ cognitoIdToken: [] }],
        parameters: [
          {
            name: "examId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "Exam deleted or cancelled",
          },
          "403": { description: "Contributor or admin role required" },
          "404": { description: "Exam not found" },
        },
      },
    },
    "/v1/admin/catalog-management/courses/{courseId}": {
      put: {
        operationId: "updateCatalogCourse",
        tags: ["Admin catalog"],
        security: [{ cognitoIdToken: [] }],
        parameters: [
          {
            name: "courseId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": { description: "Course updated" },
          "400": { description: "Invalid course ID or input" },
          "403": { description: "Admin role required" },
          "404": { description: "Course not found" },
          "409": { description: "Course code already exists" },
        },
      },
      delete: {
        operationId: "deleteCatalogCourse",
        tags: ["Admin catalog"],
        security: [{ cognitoIdToken: [] }],
        parameters: [
          {
            name: "courseId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": { description: "Course and curriculum placements deleted" },
          "400": { description: "Invalid course ID" },
          "403": { description: "Admin role required" },
          "404": { description: "Course not found" },
          "409": { description: "Course is referenced by an exam" },
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
    "/v1/admin/exams/{examId}/review": {
      get: {
        operationId: "getDraftExamReview",
        tags: ["Admin review"],
        security: [{ cognitoIdToken: [] }],
        parameters: [
          {
            in: "path",
            name: "examId",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": { description: "Draft metadata, progress and 60 questions" },
          "403": { description: "Contributor or admin role required" },
          "404": { description: "Draft or review exam not found" },
        },
      },
    },
    "/v1/admin/exams/{examId}/questions/{questionId}/answer": {
      put: {
        operationId: "saveReviewedAnswer",
        tags: ["Admin review"],
        security: [{ cognitoIdToken: [] }],
        parameters: [
          {
            in: "path",
            name: "examId",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
          {
            in: "path",
            name: "questionId",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": { description: "Answer saved and audit record appended" },
          "400": { description: "Invalid question type or answer selection" },
          "403": { description: "Contributor or admin role required" },
          "404": { description: "Question not found in the exam" },
          "409": { description: "Exam is no longer editable" },
        },
      },
    },
    "/v1/admin/exams/{examId}/ready": {
      post: {
        operationId: "markExamReviewReady",
        tags: ["Admin review"],
        security: [{ cognitoIdToken: [] }],
        parameters: [
          {
            in: "path",
            name: "examId",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": { description: "Exam moved from draft to review" },
          "403": { description: "Contributor or admin role required" },
          "409": { description: "One or more answers are incomplete" },
        },
      },
    },
    "/v1/admin/exams/{examId}/publish": {
      post: {
        operationId: "publishReviewedExam",
        tags: ["Admin review"],
        security: [{ cognitoIdToken: [] }],
        parameters: [
          {
            in: "path",
            name: "examId",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": { description: "Reviewed revision approved and published" },
          "403": { description: "Admin role required" },
          "404": { description: "Exam not found" },
          "409": { description: "Review or answers are incomplete" },
        },
      },
    },
    "/v1/admin/exams/{examId}/ai-suggestions": {
      post: {
        operationId: "queueAiAnswerSuggestions",
        tags: ["Admin review"],
        security: [{ cognitoIdToken: [] }],
        parameters: [
          {
            in: "path",
            name: "examId",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "202": {
            description:
              "Unanswered questions queued for AI answer suggestions",
          },
          "403": { description: "Admin role required" },
          "404": { description: "Exam not found" },
          "409": { description: "Exam is no longer editable" },
          "502": { description: "Queue provider failed" },
          "503": { description: "AI suggestions are not configured" },
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
      get: {
        summary: "List user attempts",
        operationId: "listAttempts",
        tags: ["Attempts"],
        security: [{ cognitoIdToken: [] }],
        responses: {
          "200": {
            description: "A list of attempts",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["data"],
                  properties: {
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/AttemptSummary" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        operationId: "createOrResumeAttempt",
        tags: ["Attempts"],
        security: [{ cognitoIdToken: [] }],
        responses: {
          "201": { description: "Attempt created" },
          "200": { description: "Active attempt resumed" },
          "429": { description: "Daily free attempt limit reached" },
          "409": { description: "Attempt conflict" },
        },
      },
    },
    "/v1/attempts/{attemptId}": {
      get: {
        operationId: "getAttempt",
        tags: ["Attempts"],
        security: [{ cognitoIdToken: [] }],
        parameters: [
          {
            in: "path",
            name: "attemptId",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": { description: "Attempt state and submitted review data" },
          "404": { description: "Attempt not found" },
        },
      },
    },
    "/v1/attempts/{attemptId}/session": {
      get: {
        operationId: "getAttemptSession",
        tags: ["Attempts"],
        security: [{ cognitoIdToken: [] }],
        parameters: [
          {
            in: "path",
            name: "attemptId",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description:
              "The attempt and immutable exam revision assigned to its owner",
          },
          "404": { description: "Attempt not found or not owned by caller" },
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

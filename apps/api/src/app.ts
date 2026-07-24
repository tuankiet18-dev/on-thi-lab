import {
  createAttemptSchema,
  createDraftImportSchema,
  feZipImportConstraints,
  saveAnswerSchema,
  submitAttemptSchema,
  updateQuestionAnswerSchema,
  upsertStudentProfileSchema,
  type StudentProfile,
  type UserRole,
} from "@onthilab/contracts";
import {
  AttemptRepositoryError,
  DraftImportRepositoryError,
  ProfileRepositoryError,
  type AttemptRepository,
  type CatalogRepository,
  type ExamReviewRepository,
  type UserProfileRepository,
} from "@onthilab/database";
import { Hono, type MiddlewareHandler } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import {
  AuthenticationError,
  type AuthIdentity,
  type TokenVerifier,
  UnconfiguredTokenVerifier,
} from "./auth";
import { demoExam } from "./fixtures";
import {
  ExamImportError,
  type ExamImportService,
  type UploadedArchive,
  UnconfiguredExamImportService,
} from "./import-service";
import { MemoryAttemptRepository } from "./memory-attempt-repository";
import { openApiDocument } from "./openapi";
import {
  type QuestionImageReader,
  UnconfiguredQuestionImageReader,
} from "./question-image-reader";

interface AppDependencies {
  catalog: CatalogRepository;
  auth: TokenVerifier;
  profiles: UserProfileRepository;
  imports: ExamImportService;
  reviews: ExamReviewRepository;
  images: QuestionImageReader;
  attempts: AttemptRepository;
}

const demoCatalogRepository: CatalogRepository = {
  listPublished: async () => [demoExam],
  findPublishedByIdOrCode: async (idOrCode) =>
    idOrCode === demoExam.id || idOrCode === demoExam.code ? demoExam : null,
};

const unavailableProfileRepository: UserProfileRepository = {
  findBySubject: async () => {
    throw new Error("Profile storage is not configured");
  },
  listOptions: async () => {
    throw new Error("Profile storage is not configured");
  },
  upsert: async () => {
    throw new Error("Profile storage is not configured");
  },
};

const unavailableReviewRepository: ExamReviewRepository = {
  findReview: async () => null,
  saveAnswer: async () => {
    throw new Error("Review storage is not configured");
  },
  markReady: async () => {
    throw new Error("Review storage is not configured");
  },
  publish: async () => {
    throw new Error("Review storage is not configured");
  },
};

type AppEnvironment = {
  Variables: {
    identity: AuthIdentity;
    profile: StudentProfile;
  };
};

function isUploadedArchive(value: unknown): value is UploadedArchive {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    typeof value.name === "string" &&
    "size" in value &&
    typeof value.size === "number" &&
    "arrayBuffer" in value &&
    typeof value.arrayBuffer === "function"
  );
}

function authenticationMiddleware(
  verifier: TokenVerifier,
): MiddlewareHandler<AppEnvironment> {
  return async (context, next) => {
    const authorization = context.req.header("Authorization");
    const match = authorization?.match(/^Bearer\s+(.+)$/i);
    if (!match?.[1]) {
      return context.json({ error: "UNAUTHORIZED" }, 401);
    }

    let identity: AuthIdentity;
    try {
      identity = await verifier.verify(match[1]);
    } catch (error) {
      if (
        error instanceof AuthenticationError &&
        error.code === "AUTH_NOT_CONFIGURED"
      ) {
        return context.json({ error: error.code }, 503);
      }
      return context.json({ error: "UNAUTHORIZED" }, 401);
    }

    context.set("identity", identity);
    await next();
  };
}

function profileRequiredMiddleware(
  profiles: UserProfileRepository,
): MiddlewareHandler<AppEnvironment> {
  return async (context, next) => {
    const profile = await profiles.findBySubject(
      context.get("identity").subject,
    );
    if (!profile) {
      return context.json({ error: "PROFILE_REQUIRED" }, 403);
    }

    context.set("profile", profile);
    await next();
  };
}

function roleRequiredMiddleware(
  ...allowedRoles: readonly UserRole[]
): MiddlewareHandler<AppEnvironment> {
  return async (context, next) => {
    if (!allowedRoles.includes(context.get("profile").role)) {
      return context.json({ error: "FORBIDDEN" }, 403);
    }

    await next();
  };
}

export function createApp(overrides: Partial<AppDependencies> = {}) {
  const dependencies: AppDependencies = {
    catalog: demoCatalogRepository,
    auth: new UnconfiguredTokenVerifier(),
    profiles: unavailableProfileRepository,
    imports: new UnconfiguredExamImportService(),
    reviews: unavailableReviewRepository,
    images: new UnconfiguredQuestionImageReader(),
    attempts: new MemoryAttemptRepository(),
    ...overrides,
  };
  const app = new Hono<AppEnvironment>();

  app.use("*", requestId());
  app.use("*", secureHeaders({ crossOriginResourcePolicy: false }));
  app.use(
    "*",
    cors({
      origin: ["http://localhost:5173"],
      allowHeaders: ["Content-Type", "Authorization", "X-Device-Id"],
      allowMethods: ["GET", "POST", "PUT", "OPTIONS"],
    }),
  );

  app.get("/openapi.json", (context) => context.json(openApiDocument));

  app.get("/question-images/*", async (context) => {
    let imageKey: string;
    try {
      imageKey = decodeURIComponent(
        context.req.path.slice("/question-images/".length),
      );
    } catch {
      return context.json({ error: "IMAGE_NOT_FOUND" }, 404);
    }
    const asset = await dependencies.images.read(imageKey);
    if (!asset) return context.json({ error: "IMAGE_NOT_FOUND" }, 404);

    const responseBytes = Uint8Array.from(asset.bytes);
    return new Response(responseBytes.buffer, {
      status: 200,
      headers: {
        "Content-Type": asset.contentType,
        "Cache-Control": "private, max-age=300",
        "Cross-Origin-Resource-Policy": "cross-origin",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });

  app.get("/health", (context) =>
    context.json({
      status: "ok",
      service: "onthilab-api",
      timestamp: new Date().toISOString(),
    }),
  );

  app.use("/v1/*", authenticationMiddleware(dependencies.auth));

  app.get("/v1/me", async (context) =>
    context.json({
      data: await dependencies.profiles.findBySubject(
        context.get("identity").subject,
      ),
    }),
  );

  app.put("/v1/me", async (context) => {
    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: "INVALID_INPUT" }, 400);
    }

    const parsed = upsertStudentProfileSchema.safeParse(body);
    if (!parsed.success) {
      return context.json(
        { error: "INVALID_INPUT", details: parsed.error.flatten() },
        400,
      );
    }

    const identity = context.get("identity");
    try {
      const profile = await dependencies.profiles.upsert(
        { subject: identity.subject, email: identity.email },
        parsed.data,
      );
      return context.json({ data: profile });
    } catch (error) {
      if (error instanceof ProfileRepositoryError) {
        const status =
          error.code === "PROFILE_CONFLICT"
            ? 409
            : error.code === "PROFILE_DISABLED"
              ? 403
              : 400;
        return context.json({ error: error.code }, status);
      }
      throw error;
    }
  });

  app.get("/v1/profile-options", async (context) =>
    context.json({ data: await dependencies.profiles.listOptions() }),
  );

  const requireProfile = profileRequiredMiddleware(dependencies.profiles);
  const requireContributor = roleRequiredMiddleware("contributor", "admin");
  const requireAdmin = roleRequiredMiddleware("admin");
  app.use("/v1/catalog", requireProfile);
  app.use("/v1/exams/*", requireProfile);
  app.use("/v1/attempts", requireProfile);
  app.use("/v1/attempts/*", requireProfile);
  app.use("/v1/admin/*", requireProfile);
  app.use("/v1/admin/*", requireContributor);

  app.get("/v1/admin/imports/config", (context) =>
    context.json({
      data: {
        examType: "FE",
        ...feZipImportConstraints,
        canPublish: context.get("profile").role === "admin",
      },
    }),
  );

  app.use(
    "/v1/admin/imports",
    bodyLimit({
      maxSize: feZipImportConstraints.maxArchiveBytes + 1024 * 1024,
      onError: (context) => context.json({ error: "ARCHIVE_TOO_LARGE" }, 413),
    }),
  );

  app.post("/v1/admin/imports", async (context) => {
    let form: Record<string, string | File>;
    try {
      form = await context.req.parseBody();
    } catch {
      return context.json({ error: "INVALID_INPUT" }, 400);
    }

    const metadataValue = form.metadata;
    const archive = form.archive;
    if (typeof metadataValue !== "string" || !isUploadedArchive(archive)) {
      return context.json({ error: "INVALID_INPUT" }, 400);
    }

    let metadata: unknown;
    try {
      metadata = JSON.parse(metadataValue);
    } catch {
      return context.json({ error: "INVALID_INPUT" }, 400);
    }
    const parsed = createDraftImportSchema.safeParse(metadata);
    if (!parsed.success) {
      return context.json(
        { error: "INVALID_INPUT", details: parsed.error.flatten() },
        400,
      );
    }

    try {
      const result = await dependencies.imports.createDraft({
        metadata: parsed.data,
        archive,
        creator: context.get("profile"),
      });
      return context.json({ data: result }, 201);
    } catch (error) {
      if (error instanceof DraftImportRepositoryError) {
        const status = error.code === "EXAM_ALREADY_EXISTS" ? 409 : 400;
        return context.json(
          { error: error.code, message: error.message },
          status,
        );
      }
      if (error instanceof ExamImportError) {
        const status =
          error.code === "IMPORT_NOT_CONFIGURED"
            ? 503
            : error.code === "ARCHIVE_TOO_LARGE"
              ? 413
              : 400;
        return context.json(
          { error: error.code, message: error.message },
          status,
        );
      }
      throw error;
    }
  });

  app.get("/v1/admin/exams/:examId/review", async (context) => {
    const review = await dependencies.reviews.findReview(
      context.req.param("examId"),
    );
    if (!review) {
      return context.json({ error: "EXAM_NOT_FOUND" }, 404);
    }

    const imageOrigin = new URL(context.req.url).origin;
    return context.json({
      data: {
        ...review,
        questions: review.questions.map(({ imageKey, ...question }) => ({
          ...question,
          imageUrl: `${imageOrigin}/question-images/${imageKey
            .split("/")
            .map(encodeURIComponent)
            .join("/")}`,
        })),
      },
    });
  });

  app.put(
    "/v1/admin/exams/:examId/questions/:questionId/answer",
    async (context) => {
      let body: unknown;
      try {
        body = await context.req.json();
      } catch {
        return context.json({ error: "INVALID_INPUT" }, 400);
      }
      const parsed = updateQuestionAnswerSchema.safeParse(body);
      if (!parsed.success) {
        return context.json(
          { error: "INVALID_INPUT", details: parsed.error.flatten() },
          400,
        );
      }

      try {
        const saved = await dependencies.reviews.saveAnswer({
          examId: context.req.param("examId"),
          questionId: context.req.param("questionId"),
          changedBy: context.get("profile").id,
          answer: parsed.data,
        });
        const { imageKey: _imageKey, ...question } = saved;
        return context.json({ data: question });
      } catch (error) {
        if (error instanceof DraftImportRepositoryError) {
          const status =
            error.code === "QUESTION_NOT_FOUND" ||
            error.code === "EXAM_NOT_FOUND"
              ? 404
              : 409;
          return context.json(
            { error: error.code, message: error.message },
            status,
          );
        }
        throw error;
      }
    },
  );

  app.post("/v1/admin/exams/:examId/ready", async (context) => {
    try {
      const result = await dependencies.reviews.markReady(
        context.req.param("examId"),
        context.get("profile").id,
      );
      return context.json({ data: result });
    } catch (error) {
      if (error instanceof DraftImportRepositoryError) {
        const status = error.code === "EXAM_NOT_FOUND" ? 404 : 409;
        return context.json(
          { error: error.code, message: error.message },
          status,
        );
      }
      throw error;
    }
  });

  app.post("/v1/admin/exams/:examId/publish", requireAdmin, async (context) => {
    try {
      const result = await dependencies.reviews.publish(
        context.req.param("examId"),
        context.get("profile").id,
      );
      return context.json({ data: result });
    } catch (error) {
      if (error instanceof DraftImportRepositoryError) {
        const status = error.code === "EXAM_NOT_FOUND" ? 404 : 409;
        return context.json(
          { error: error.code, message: error.message },
          status,
        );
      }
      throw error;
    }
  });

  app.get("/v1/catalog", async (context) =>
    context.json({
      data: await dependencies.catalog.listPublished({
        campus: context.req.query("campus"),
        courseCode: context.req.query("courseCode"),
        semester: context.req.query("semester"),
      }),
      meta: { source: "repository" },
    }),
  );

  app.get("/v1/exams/:examId", async (context) => {
    const exam = await dependencies.catalog.findPublishedByIdOrCode(
      context.req.param("examId"),
    );
    if (!exam) {
      return context.json({ error: "EXAM_NOT_FOUND" }, 404);
    }

    const apiOrigin = new URL(context.req.url).origin;
    return context.json({
      data: {
        ...exam,
        questions: exam.questions.map((question) => ({
          ...question,
          imageUrl: question.imageUrl.startsWith("/")
            ? `${apiOrigin}${question.imageUrl}`
            : question.imageUrl,
        })),
      },
    });
  });

  app.post("/v1/attempts", async (context) => {
    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: "INVALID_INPUT" }, 400);
    }
    const parsed = createAttemptSchema.safeParse(body);

    if (!parsed.success) {
      return context.json(
        { error: "INVALID_INPUT", details: parsed.error.flatten() },
        400,
      );
    }

    try {
      const launch = await dependencies.attempts.createOrResume({
        userId: context.get("profile").id,
        ...parsed.data,
      });
      return context.json({ data: launch }, launch.resumed ? 200 : 201);
    } catch (error) {
      if (error instanceof AttemptRepositoryError) {
        const status =
          error.code === "EXAM_NOT_FOUND"
            ? 404
            : error.code === "DAILY_LIMIT_REACHED"
              ? 429
              : 409;
        return context.json(
          { error: error.code, message: error.message },
          status,
        );
      }
      throw error;
    }
  });

  app.put("/v1/attempts/:attemptId/answers", async (context) => {
    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: "INVALID_INPUT" }, 400);
    }
    const parsed = saveAnswerSchema.safeParse(body);
    if (!parsed.success) {
      return context.json(
        { error: "INVALID_INPUT", details: parsed.error.flatten() },
        400,
      );
    }

    try {
      const saved = await dependencies.attempts.saveAnswer({
        attemptId: context.req.param("attemptId"),
        userId: context.get("profile").id,
        answer: parsed.data,
      });
      return context.json({ data: saved });
    } catch (error) {
      if (error instanceof AttemptRepositoryError) {
        const status =
          error.code === "ATTEMPT_NOT_FOUND" ||
          error.code === "QUESTION_NOT_FOUND"
            ? 404
            : 409;
        return context.json(
          { error: error.code, message: error.message },
          status,
        );
      }
      throw error;
    }
  });

  app.post("/v1/attempts/:attemptId/submit", async (context) => {
    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: "INVALID_INPUT" }, 400);
    }
    const parsed = submitAttemptSchema.safeParse(body);
    if (!parsed.success) {
      return context.json(
        { error: "INVALID_INPUT", details: parsed.error.flatten() },
        400,
      );
    }

    try {
      const submission = await dependencies.attempts.submit({
        attemptId: context.req.param("attemptId"),
        userId: context.get("profile").id,
        reason: parsed.data.reason,
      });
      return context.json({
        data: submission.result,
        idempotent: submission.idempotent,
      });
    } catch (error) {
      if (error instanceof AttemptRepositoryError) {
        const status = error.code === "ATTEMPT_NOT_FOUND" ? 404 : 409;
        return context.json(
          { error: error.code, message: error.message },
          status,
        );
      }
      throw error;
    }
  });

  app.get("/v1/attempts/:attemptId", async (context) => {
    const attempt = await dependencies.attempts.findForUser(
      context.req.param("attemptId"),
      context.get("profile").id,
    );
    if (!attempt) {
      return context.json({ error: "ATTEMPT_NOT_FOUND" }, 404);
    }

    return context.json({ data: attempt });
  });

  app.notFound((context) =>
    context.json(
      {
        error: "NOT_FOUND",
        requestId: context.get("requestId"),
      },
      404,
    ),
  );

  app.onError((error, context) => {
    console.error("Unhandled API error", {
      requestId: context.get("requestId"),
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return context.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        requestId: context.get("requestId"),
      },
      500,
    );
  });

  return app;
}

export const app = createApp();

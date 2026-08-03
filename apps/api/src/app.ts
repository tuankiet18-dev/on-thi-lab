import {
  createCourseSchema,
  updateCourseSchema,
  createCurriculumSchema,
  createMajorSchema,
  createAttemptSchema,
  createDraftImportSchema,
  feZipImportConstraints,
  saveAnswerSchema,
  submitAttemptSchema,
  updateQuestionAnswerSchema,
  updateOcrQuestionSchema,
  updateExamPresentationModeSchema,
  upsertStudentProfileSchema,
  createReportSchema,
  createFeedbackSchema,
  resolveReportSchema,
  upsertCurriculumCourseSchema,
  type StudentProfile,
  type UserRole,
} from "@onthilab/contracts";
import {
  AttemptRepositoryError,
  DraftImportRepositoryError,
  ProfileRepositoryError,
  type AttemptRepository,
  type AdminCatalogRepository,
  AdminCatalogRepositoryError,
  type CatalogRepository,
  type ExamReviewRepository,
  type UserProfileRepository,
  type ReportRepository,
  ReportRepositoryError,
  type BookmarkRepository,
  BookmarkRepositoryError,
  type FeedbackRepository,
  type PostgresOcrRepository,
} from "@onthilab/database";
import { Hono, type MiddlewareHandler } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { z } from "zod";
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
import {
  AnswerSuggestionServiceError,
  type AnswerSuggestionService,
  UnconfiguredAnswerSuggestionService,
} from "./answer-suggestion-service";
import { MemoryAttemptRepository } from "./memory-attempt-repository";
import { openApiDocument } from "./openapi";
import type { OcrService } from "./ocr-service.js";
import { UnconfiguredOcrService } from "./ocr-service.js";
import {
  type QuestionImageReader,
  UnconfiguredQuestionImageReader,
} from "./question-image-reader";

interface AppDependencies {
  catalog: CatalogRepository;
  adminCatalog: AdminCatalogRepository;
  auth: TokenVerifier;
  profiles: UserProfileRepository;
  imports: ExamImportService;
  reviews: ExamReviewRepository;
  images: QuestionImageReader;
  attempts: AttemptRepository;
  suggestions: AnswerSuggestionService;
  reports: ReportRepository;
  bookmarks: BookmarkRepository;
  feedback: FeedbackRepository;
  ocrRepository?: PostgresOcrRepository;
  ocrService: OcrService;
  /**
   * Public base URL for question images, including `/question-images` when
   * configured. This is useful for an external image CDN.
   */
  questionImageBaseUrl?: string;
  /** Allowed CORS origins. Defaults to localhost:5173 when not set. */
  corsOrigins: string[];
}

function publicQuestionImageUrl(
  imageKey: string,
  configuredBaseUrl?: string,
): string {
  if (/^(?:https?:|data:|blob:)/i.test(imageKey)) return imageKey;

  const encodedKey = imageKey
    .replace(/^\/+/, "")
    .split("/")
    .map(encodeURIComponent)
    .join("/");
  const baseUrl = configuredBaseUrl ?? "/question-images";
  return `${baseUrl.replace(/\/$/, "")}/${encodedKey}`;
}

class UnconfiguredReportRepository implements ReportRepository {
  async createReport(): Promise<never> {
    throw new Error("Report repository not configured");
  }
  async listPendingReports(): Promise<never[]> {
    throw new Error("Report repository not configured");
  }
  async resolveReport(): Promise<never> {
    throw new Error("Report repository not configured");
  }
}

class UnconfiguredBookmarkRepository implements BookmarkRepository {
  async listForUser(): Promise<never> {
    throw new Error("Bookmark repository not configured");
  }
  async saveExam(): Promise<never> {
    throw new Error("Bookmark repository not configured");
  }
  async removeExam(): Promise<never> {
    throw new Error("Bookmark repository not configured");
  }
  async saveQuestion(): Promise<never> {
    throw new Error("Bookmark repository not configured");
  }
  async removeQuestion(): Promise<never> {
    throw new Error("Bookmark repository not configured");
  }
}

class UnconfiguredFeedbackRepository implements FeedbackRepository {
  async create(): Promise<never> {
    throw new Error("Feedback repository not configured");
  }
  async listNew(): Promise<never[]> {
    throw new Error("Feedback repository not configured");
  }
  async resolve(): Promise<null> {
    throw new Error("Feedback repository not configured");
  }
}

const demoCatalogRepository: CatalogRepository = {
  listCampuses: async () => [],
  listMajors: async () => [],
  listCurricula: async () => [],
  listTermCourses: async () => [],
  listPublished: async () => [demoExam],
  findPublishedByIdOrCode: async (idOrCode) =>
    idOrCode === demoExam.id || idOrCode === demoExam.code ? demoExam : null,
};

const unavailableAdminCatalogRepository: AdminCatalogRepository = {
  getAdminCatalog: async () => ({ majors: [], curricula: [], courses: [] }),
  createMajor: async () => {
    throw new Error("Admin catalog storage is not configured");
  },
  createCurriculum: async () => {
    throw new Error("Admin catalog storage is not configured");
  },
  createCourse: async () => {
    throw new Error("Admin catalog storage is not configured");
  },
  updateCourse: async () => {
    throw new Error("Admin catalog storage is not configured");
  },
  deleteCourse: async () => {
    throw new Error("Admin catalog storage is not configured");
  },
  upsertCurriculumCourse: async () => {
    throw new Error("Admin catalog storage is not configured");
  },
};

const uuidSchema = z.string().uuid();

function studentQuestionImageUrl(imageUrl: string): string {
  if (/^(?:https?:|data:|blob:)/i.test(imageUrl)) return imageUrl;
  if (imageUrl.startsWith("/")) return imageUrl;

  return `/question-images/${imageUrl
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

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
  updateRole: async () => {
    throw new Error("Profile storage is not configured");
  },
  searchUsers: async () => {
    throw new Error("Profile storage is not configured");
  },
};

const unavailableReviewRepository: ExamReviewRepository = {
  findDrafts: async () => [],
  findAllExams: async () => [],
  deleteExam: async () => {},
  findReview: async () => null,
  saveAnswer: async () => {
    throw new Error("Review storage is not configured");
  },
  confirmTrustedSuggestions: async () => {
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
    adminCatalog: unavailableAdminCatalogRepository,
    auth: new UnconfiguredTokenVerifier(),
    profiles: unavailableProfileRepository,
    imports: new UnconfiguredExamImportService(),
    reviews: unavailableReviewRepository,
    images: new UnconfiguredQuestionImageReader(),
    attempts: new MemoryAttemptRepository(),
    suggestions: new UnconfiguredAnswerSuggestionService(),
    reports: new UnconfiguredReportRepository(),
    bookmarks: new UnconfiguredBookmarkRepository(),
    feedback: new UnconfiguredFeedbackRepository(),
    ocrService: new UnconfiguredOcrService(),
    corsOrigins: ["http://localhost:5173"],
    ...overrides,
  };
  const app = new Hono<AppEnvironment>();

  app.use("*", requestId());
  app.use("*", secureHeaders({ crossOriginResourcePolicy: false }));
  app.use(
    "*",
    cors({
      origin: dependencies.corsOrigins,
      allowHeaders: ["Content-Type", "Authorization", "X-Device-Id"],
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
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
    if (!identity.emailVerified) {
      return context.json(
        {
          error: "EMAIL_NOT_VERIFIED",
          message: "Vui lòng xác thực email trước khi tạo hồ sơ.",
        },
        403,
      );
    }
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
  app.use("/v1/me/statistics", requireProfile);
  app.use("/v1/attempts", requireProfile);
  app.use("/v1/attempts/*", requireProfile);
  app.use("/v1/bookmarks", requireProfile);
  app.use("/v1/bookmarks/*", requireProfile);
  app.use("/v1/admin/*", requireProfile);
  app.use("/v1/admin/*", requireContributor);

  app.post("/v1/admin/users/:id/role", requireAdmin, async (context) => {
    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: "INVALID_INPUT" }, 400);
    }

    const { role } = body as { role?: string };
    if (role !== "user" && role !== "contributor" && role !== "admin") {
      return context.json(
        { error: "INVALID_INPUT", message: "Quyền không hợp lệ" },
        400,
      );
    }

    await dependencies.profiles.updateRole(context.req.param("id"), role);
    return context.json({ data: { success: true } });
  });

  app.get("/v1/admin/users/search", requireAdmin, async (context) => {
    const query = context.req.query("q") || "";
    if (query.trim().length < 3) {
      return context.json({ data: [] });
    }
    return context.json({
      data: await dependencies.profiles.searchUsers(query.trim()),
    });
  });

  app.get("/v1/admin/imports/config", (context) =>
    context.json({
      data: {
        examType: "FE",
        ...feZipImportConstraints,
        canPublish: context.get("profile").role === "admin",
      },
    }),
  );

  app.get("/v1/admin/catalog-management", async (context) =>
    context.json({ data: await dependencies.adminCatalog.getAdminCatalog() }),
  );

  app.post(
    "/v1/admin/catalog-management/majors",
    requireAdmin,
    async (context) => {
      let body: unknown;
      try {
        body = await context.req.json();
      } catch {
        return context.json({ error: "INVALID_INPUT" }, 400);
      }
      const parsed = createMajorSchema.safeParse(body);
      if (!parsed.success) {
        return context.json(
          { error: "INVALID_INPUT", details: parsed.error.flatten() },
          400,
        );
      }
      try {
        return context.json(
          { data: await dependencies.adminCatalog.createMajor(parsed.data) },
          201,
        );
      } catch (error) {
        if (error instanceof AdminCatalogRepositoryError) {
          return context.json(
            { error: error.code, message: error.message },
            409,
          );
        }
        throw error;
      }
    },
  );

  app.post(
    "/v1/admin/catalog-management/curricula",
    requireAdmin,
    async (context) => {
      let body: unknown;
      try {
        body = await context.req.json();
      } catch {
        return context.json({ error: "INVALID_INPUT" }, 400);
      }
      const parsed = createCurriculumSchema.safeParse(body);
      if (!parsed.success) {
        return context.json(
          { error: "INVALID_INPUT", details: parsed.error.flatten() },
          400,
        );
      }
      try {
        return context.json(
          {
            data: await dependencies.adminCatalog.createCurriculum(parsed.data),
          },
          201,
        );
      } catch (error) {
        if (error instanceof AdminCatalogRepositoryError) {
          const status = error.code === "MAJOR_NOT_FOUND" ? 404 : 409;
          return context.json(
            { error: error.code, message: error.message },
            status,
          );
        }
        throw error;
      }
    },
  );

  app.post(
    "/v1/admin/catalog-management/courses",
    requireAdmin,
    async (context) => {
      let body: unknown;
      try {
        body = await context.req.json();
      } catch {
        return context.json({ error: "INVALID_INPUT" }, 400);
      }
      const parsed = createCourseSchema.safeParse(body);
      if (!parsed.success) {
        return context.json(
          { error: "INVALID_INPUT", details: parsed.error.flatten() },
          400,
        );
      }
      try {
        return context.json(
          { data: await dependencies.adminCatalog.createCourse(parsed.data) },
          201,
        );
      } catch (error) {
        if (error instanceof AdminCatalogRepositoryError) {
          return context.json(
            { error: error.code, message: error.message },
            409,
          );
        }
        throw error;
      }
    },
  );

  app.put(
    "/v1/admin/catalog-management/courses/:id",
    requireAdmin,
    async (context) => {
      const parsedId = uuidSchema.safeParse(context.req.param("id"));
      if (!parsedId.success) {
        return context.json({ error: "INVALID_INPUT" }, 400);
      }
      const id = parsedId.data;
      let body: unknown;
      try {
        body = await context.req.json();
      } catch {
        return context.json({ error: "INVALID_INPUT" }, 400);
      }
      const parsed = updateCourseSchema.safeParse(body);
      if (!parsed.success) {
        return context.json(
          { error: "INVALID_INPUT", details: parsed.error.flatten() },
          400,
        );
      }
      try {
        return context.json(
          {
            data: await dependencies.adminCatalog.updateCourse(id, parsed.data),
          },
          200,
        );
      } catch (error) {
        if (error instanceof AdminCatalogRepositoryError) {
          const status = error.code === "COURSE_NOT_FOUND" ? 404 : 409;
          return context.json(
            { error: error.code, message: error.message },
            status,
          );
        }
        throw error;
      }
    },
  );

  app.delete(
    "/v1/admin/catalog-management/courses/:id",
    requireAdmin,
    async (context) => {
      const parsedId = uuidSchema.safeParse(context.req.param("id"));
      if (!parsedId.success) {
        return context.json({ error: "INVALID_INPUT" }, 400);
      }
      const id = parsedId.data;
      try {
        await dependencies.adminCatalog.deleteCourse(id);
        return context.json({ success: true }, 200);
      } catch (error) {
        if (error instanceof AdminCatalogRepositoryError) {
          const status = error.code === "COURSE_NOT_FOUND" ? 404 : 409;
          return context.json(
            { error: error.code, message: error.message },
            status,
          );
        }
        throw error;
      }
    },
  );

  app.put(
    "/v1/admin/catalog-management/curriculum-courses",
    requireAdmin,
    async (context) => {
      let body: unknown;
      try {
        body = await context.req.json();
      } catch {
        return context.json({ error: "INVALID_INPUT" }, 400);
      }
      const parsed = upsertCurriculumCourseSchema.safeParse(body);
      if (!parsed.success) {
        return context.json(
          { error: "INVALID_INPUT", details: parsed.error.flatten() },
          400,
        );
      }
      try {
        await dependencies.adminCatalog.upsertCurriculumCourse(parsed.data);
        return context.json({ data: { success: true } });
      } catch (error) {
        if (error instanceof AdminCatalogRepositoryError) {
          return context.json(
            { error: error.code, message: error.message },
            404,
          );
        }
        throw error;
      }
    },
  );

  app.get("/v1/admin/imports/presign", async (context) => {
    if (!dependencies.imports.createPresignedUploadUrl) {
      return context.json({ error: "IMPORT_NOT_CONFIGURED" }, 503);
    }
    try {
      return context.json({
        data: await dependencies.imports.createPresignedUploadUrl(),
      });
    } catch {
      return context.json({ error: "INTERNAL_SERVER_ERROR" }, 500);
    }
  });

  app.get("/v1/admin/drafts", async (context) => {
    const drafts = await dependencies.reviews.findDrafts();
    return context.json({ data: drafts });
  });

  app.get("/v1/admin/exams", async (context) => {
    const exams = await dependencies.reviews.findAllExams();
    return context.json({ data: exams });
  });

  app.delete("/v1/admin/exams/:examId", requireAdmin, async (context) => {
    const examId = context.req.param("examId");
    await dependencies.reviews.deleteExam(examId);
    return context.json({ success: true });
  });

  app.use(
    "/v1/admin/imports",
    bodyLimit({
      maxSize: feZipImportConstraints.maxArchiveBytes + 1024 * 1024,
      onError: (context) => context.json({ error: "ARCHIVE_TOO_LARGE" }, 413),
    }),
  );

  app.post("/v1/admin/imports", async (context) => {
    let metadata: unknown;
    let archiveKey: string | undefined;
    let archive: File | undefined;

    const contentType = context.req.header("content-type") || "";
    if (contentType.includes("application/json")) {
      try {
        const body = await context.req.json();
        metadata = body.metadata;
        archiveKey = body.archiveKey;
      } catch {
        return context.json({ error: "INVALID_INPUT" }, 400);
      }
    } else {
      let form: Record<string, string | File>;
      try {
        form = await context.req.parseBody();
      } catch {
        return context.json({ error: "INVALID_INPUT" }, 400);
      }
      const metadataValue = form.metadata;
      archive = form.archive instanceof File ? form.archive : undefined;

      if (typeof metadataValue !== "string" || !isUploadedArchive(archive)) {
        return context.json({ error: "INVALID_INPUT" }, 400);
      }
      try {
        metadata = JSON.parse(metadataValue);
      } catch {
        return context.json({ error: "INVALID_INPUT" }, 400);
      }
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
        archiveKey,
        creator: context.get("profile"),
      });

      let ocrQueueWarning: string | undefined;
      if (parsed.data.extractText) {
        try {
          await dependencies.ocrService.enqueueRevisionOcrJobs(
            result.revisionId,
          );
        } catch (error) {
          // The draft was committed atomically before jobs are queued. Return
          // it to the admin instead of turning a retry into a duplicate exam;
          // they can retry from the OCR tab or switch the revision to images.
          console.error("Unable to queue OCR jobs", error);
          ocrQueueWarning =
            "Đề đã được tạo nhưng chưa thể đưa vào hàng đợi OCR. Hãy thử OCR lại từ trang duyệt.";
        }
      }

      return context.json(
        {
          data: {
            ...result,
            ...(ocrQueueWarning ? { ocrQueueWarning } : {}),
          },
        },
        201,
      );
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

    return context.json({
      data: {
        ...review,
        questions: review.questions.map(({ imageKey, ...question }) => ({
          ...question,
          // Use a relative path by default. The web client resolves it against
          // VITE_API_URL, preserving API Gateway's `/staging` prefix.
          imageUrl: publicQuestionImageUrl(
            imageKey,
            dependencies.questionImageBaseUrl,
          ),
        })),
      },
    });
  });

  app.get("/v1/admin/revisions/:revisionId/ocr", async (context) => {
    if (!dependencies.ocrRepository) {
      return context.json({ error: "OCR_NOT_CONFIGURED" }, 503);
    }
    const status = await dependencies.ocrRepository.getExamOcrStatus(
      context.req.param("revisionId"),
    );
    return context.json({
      data: {
        ...status,
        questions: status.questions.map((question) => ({
          ...question,
          imageUrl: publicQuestionImageUrl(
            question.imageUrl,
            dependencies.questionImageBaseUrl,
          ),
        })),
      },
    });
  });

  app.patch("/v1/admin/questions/:questionId/ocr", async (context) => {
    if (!dependencies.ocrRepository) {
      return context.json({ error: "OCR_NOT_CONFIGURED" }, 503);
    }
    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: "INVALID_INPUT" }, 400);
    }
    const parsed = updateOcrQuestionSchema.safeParse(body);
    if (!parsed.success) {
      return context.json(
        { error: "INVALID_INPUT", details: parsed.error.flatten() },
        400,
      );
    }
    await dependencies.ocrRepository.approveOcrQuestion(
      context.req.param("questionId"),
      parsed.data,
      context.get("profile").id,
    );
    return context.json({ success: true });
  });

  app.delete("/v1/admin/questions/:questionId/ocr", async (context) => {
    if (!dependencies.ocrRepository) {
      return context.json({ error: "OCR_NOT_CONFIGURED" }, 503);
    }
    await dependencies.ocrRepository.rejectOcrQuestion(
      context.req.param("questionId"),
      context.get("profile").id,
    );
    return context.json({ success: true });
  });

  app.post("/v1/admin/revisions/:revisionId/ocr/retry", async (context) => {
    if (!dependencies.ocrRepository) {
      return context.json({ error: "OCR_NOT_CONFIGURED" }, 503);
    }
    await dependencies.ocrService.retryRevisionOcrJobs(
      context.req.param("revisionId"),
    );
    return context.json({ success: true });
  });

  app.post("/v1/admin/questions/:questionId/ocr/retry", async (context) => {
    if (!dependencies.ocrRepository) {
      return context.json({ error: "OCR_NOT_CONFIGURED" }, 503);
    }
    await dependencies.ocrService.enqueueQuestionOcrJob(
      context.req.param("questionId"),
    );
    return context.json({ success: true });
  });

  app.patch("/v1/admin/revisions/:revisionId/presentation", async (context) => {
    if (!dependencies.ocrRepository) {
      return context.json({ error: "OCR_NOT_CONFIGURED" }, 503);
    }
    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: "INVALID_INPUT" }, 400);
    }
    const parsed = updateExamPresentationModeSchema.safeParse(body);
    if (!parsed.success) {
      return context.json(
        { error: "INVALID_INPUT", details: parsed.error.flatten() },
        400,
      );
    }

    await dependencies.ocrRepository.setExamPresentationMode(
      context.req.param("revisionId"),
      parsed.data.mode,
    );
    // Queue only after a text-capable mode is persisted. Stale messages are
    // ignored by the worker whenever this revision is switched back to image.
    if (parsed.data.mode === "text" || parsed.data.mode === "hybrid") {
      await dependencies.ocrService.enqueueRevisionOcrJobs(
        context.req.param("revisionId"),
      );
    }
    return context.json({ success: true });
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

  app.post(
    "/v1/admin/exams/:examId/community-suggestions/confirm",
    async (context) => {
      try {
        const result = await dependencies.reviews.confirmTrustedSuggestions(
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
    },
  );

  app.post("/v1/admin/exams/:examId/ready", async (context) => {
    try {
      if (dependencies.ocrRepository) {
        const review = await dependencies.reviews.findReview(
          context.req.param("examId"),
        );
        if (review) {
          const ocrStatus = await dependencies.ocrRepository.getExamOcrStatus(
            review.revisionId,
          );
          if (!ocrStatus.canPublish) {
            return context.json(
              {
                error: "OCR_NOT_COMPLETED",
                message:
                  "Vui lòng duyệt hết các nội dung OCR trước khi hoàn tất đề.",
              },
              409,
            );
          }
        }
      }
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
      if (dependencies.ocrRepository) {
        const review = await dependencies.reviews.findReview(
          context.req.param("examId"),
        );
        if (review) {
          const status = await dependencies.ocrRepository.getExamOcrStatus(
            review.revisionId,
          );
          if (!status.canPublish) {
            return context.json(
              {
                error: "OCR_NOT_COMPLETED",
                message:
                  "Vui lòng duyệt hết các kết quả OCR trước khi xuất bản.",
              },
              409,
            );
          }
        }
      }

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

  app.post(
    "/v1/admin/exams/:examId/questions/:questionId/ai-suggestion",
    requireAdmin,
    async (context) => {
      try {
        const result = await dependencies.suggestions.queueQuestion(
          context.req.param("examId"),
          context.req.param("questionId"),
        );
        return context.json({ data: result }, 202);
      } catch (error) {
        if (error instanceof DraftImportRepositoryError) {
          const status =
            error.code === "EXAM_NOT_FOUND" ||
            error.code === "QUESTION_NOT_FOUND"
              ? 404
              : 409;
          return context.json(
            { error: error.code, message: error.message },
            status,
          );
        }
        if (error instanceof AnswerSuggestionServiceError) {
          const status = error.code === "AI_NOT_CONFIGURED" ? 503 : 502;
          return context.json(
            { error: error.code, message: error.message },
            status,
          );
        }
        throw error;
      }
    },
  );

  app.get("/v1/catalog", async (context) => {
    const limitQuery = context.req.query("limit");
    const limit = limitQuery ? parseInt(limitQuery, 10) : undefined;

    return context.json({
      data: await dependencies.catalog.listPublished({
        campus: context.req.query("campus"),
        courseCode: context.req.query("courseCode"),
        semester: context.req.query("semester"),
        cursor: context.req.query("cursor"),
        limit: isNaN(limit!) ? undefined : limit,
      }),
      meta: { source: "repository" },
    });
  });

  app.get("/v1/catalog/campuses", async (context) =>
    context.json({ data: await dependencies.catalog.listCampuses() }),
  );

  app.get("/v1/catalog/majors", async (context) =>
    context.json({ data: await dependencies.catalog.listMajors() }),
  );

  app.get("/v1/catalog/curricula", async (context) => {
    const majorId = context.req.query("majorId");
    if (!majorId) return context.json({ error: "majorId is required" }, 400);
    return context.json({
      data: await dependencies.catalog.listCurricula(majorId),
    });
  });

  app.get("/v1/catalog/term-courses", async (context) => {
    const curriculumId = context.req.query("curriculumId");
    if (!curriculumId)
      return context.json({ error: "curriculumId is required" }, 400);
    return context.json({
      data: await dependencies.catalog.listTermCourses(curriculumId),
    });
  });

  app.get("/v1/exams/:examId", async (context) => {
    const exam = await dependencies.catalog.findPublishedByIdOrCode(
      context.req.param("examId"),
    );
    if (!exam) {
      return context.json({ error: "EXAM_NOT_FOUND" }, 404);
    }

    return context.json({
      data: {
        ...exam,
        questions: exam.questions.map((question) => ({
          ...question,
          imageUrl: studentQuestionImageUrl(question.imageUrl),
        })),
      },
    });
  });

  app.get("/v1/me/statistics", async (context) =>
    context.json({
      data: await dependencies.attempts.getStatistics(
        context.get("profile").id,
      ),
    }),
  );

  app.get("/v1/attempts", async (context) => {
    const attempts = await dependencies.attempts.listUserAttempts(
      context.get("profile").id,
    );
    return context.json({ data: attempts });
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
        const status = error.code === "EXAM_NOT_FOUND" ? 404 : 409;
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

  app.get("/v1/attempts/:attemptId/session", async (context) => {
    const session = await dependencies.attempts.findSessionForUser(
      context.req.param("attemptId"),
      context.get("profile").id,
    );
    if (!session) {
      return context.json({ error: "ATTEMPT_NOT_FOUND" }, 404);
    }

    return context.json(
      {
        data: {
          ...session,
          exam: {
            ...session.exam,
            questions: session.exam.questions.map((question) => ({
              ...question,
              imageUrl: studentQuestionImageUrl(question.imageUrl),
            })),
          },
        },
      },
      200,
      { "Cache-Control": "private, no-store" },
    );
  });

  app.get("/v1/bookmarks", async (context) => {
    const collection = await dependencies.bookmarks.listForUser(
      context.get("profile").id,
    );
    return context.json({
      data: {
        ...collection,
        questions: collection.questions.map((question) => ({
          ...question,
          imageUrl: studentQuestionImageUrl(question.imageUrl),
        })),
      },
    });
  });

  app.put("/v1/bookmarks/exams/:examId", async (context) => {
    try {
      await dependencies.bookmarks.saveExam(
        context.get("profile").id,
        context.req.param("examId"),
      );
      return context.json({ data: { bookmarked: true } });
    } catch (error) {
      if (error instanceof BookmarkRepositoryError) {
        return context.json({ error: error.code, message: error.message }, 404);
      }
      throw error;
    }
  });

  app.delete("/v1/bookmarks/exams/:examId", async (context) => {
    await dependencies.bookmarks.removeExam(
      context.get("profile").id,
      context.req.param("examId"),
    );
    return context.json({ data: { bookmarked: false } });
  });

  app.put("/v1/bookmarks/questions/:questionId", async (context) => {
    try {
      await dependencies.bookmarks.saveQuestion(
        context.get("profile").id,
        context.req.param("questionId"),
      );
      return context.json({ data: { bookmarked: true } });
    } catch (error) {
      if (error instanceof BookmarkRepositoryError) {
        return context.json({ error: error.code, message: error.message }, 404);
      }
      throw error;
    }
  });

  app.delete("/v1/bookmarks/questions/:questionId", async (context) => {
    await dependencies.bookmarks.removeQuestion(
      context.get("profile").id,
      context.req.param("questionId"),
    );
    return context.json({ data: { bookmarked: false } });
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
      cause:
        error instanceof Error && (error as any).cause
          ? (error as any).cause
          : undefined,
    });

    return context.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        requestId: context.get("requestId"),
      },
      500,
    );
  });

  app.post(
    "/v1/attempts/:attemptId/questions/:questionId/report",
    requireProfile,
    async (context) => {
      let body: unknown;
      try {
        body = await context.req.json();
      } catch {
        return context.json({ error: "INVALID_INPUT" }, 400);
      }
      const parsed = createReportSchema.safeParse(body);
      if (!parsed.success) {
        return context.json(
          { error: "INVALID_INPUT", details: parsed.error.flatten() },
          400,
        );
      }
      try {
        const report = await dependencies.reports.createReport({
          userId: context.get("profile").id,
          attemptId: context.req.param("attemptId"),
          questionId: context.req.param("questionId"),
          report: parsed.data,
        });
        return context.json({ data: report }, 201);
      } catch (error) {
        if (error instanceof ReportRepositoryError) {
          return context.json(
            { error: error.code, message: error.message },
            404,
          );
        }
        throw error;
      }
    },
  );

  app.post("/v1/feedback", requireProfile, async (context) => {
    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: "INVALID_INPUT" }, 400);
    }
    const parsed = createFeedbackSchema.safeParse(body);
    if (!parsed.success) {
      return context.json(
        { error: "INVALID_INPUT", details: parsed.error.flatten() },
        400,
      );
    }
    const created = await dependencies.feedback.create(
      context.get("profile").id,
      parsed.data,
    );
    return context.json({ data: created }, 201);
  });

  app.get(
    "/v1/admin/feedback",
    roleRequiredMiddleware("admin"),
    async (context) =>
      context.json({ data: await dependencies.feedback.listNew() }),
  );

  app.post(
    "/v1/admin/feedback/:id/resolve",
    roleRequiredMiddleware("admin"),
    async (context) => {
      const feedbackId = uuidSchema.safeParse(context.req.param("id"));
      if (!feedbackId.success) {
        return context.json({ error: "INVALID_FEEDBACK_ID" }, 400);
      }
      const resolved = await dependencies.feedback.resolve(feedbackId.data);
      return resolved
        ? context.json({ data: resolved })
        : context.json({ error: "FEEDBACK_NOT_FOUND" }, 404);
    },
  );

  app.get(
    "/v1/admin/reports",
    roleRequiredMiddleware("admin", "contributor"),
    async (context) => {
      const pending = await dependencies.reports.listPendingReports();
      return context.json({
        data: pending.map((report) => ({
          ...report,
          question: report.question
            ? {
                ...report.question,
                imageUrl: studentQuestionImageUrl(report.question.imageUrl),
              }
            : undefined,
        })),
      });
    },
  );

  app.post(
    "/v1/admin/reports/:id/resolve",
    roleRequiredMiddleware("admin", "contributor"),
    async (context) => {
      let body: unknown;
      try {
        body = await context.req.json();
      } catch {
        return context.json({ error: "INVALID_INPUT" }, 400);
      }
      const parsed = resolveReportSchema.safeParse(body);
      if (!parsed.success) {
        return context.json(
          { error: "INVALID_INPUT", details: parsed.error.flatten() },
          400,
        );
      }
      try {
        const report = await dependencies.reports.resolveReport({
          reportId: context.req.param("id"),
          resolvedBy: context.get("profile").id,
          resolution: parsed.data,
        });
        return context.json({ data: report });
      } catch (error) {
        if (error instanceof ReportRepositoryError) {
          return context.json(
            { error: error.code, message: error.message },
            404,
          );
        }
        throw error;
      }
    },
  );

  return app;
}

export const app = createApp();

import {
  calculateScore,
  createAttemptSchema,
  saveAnswerSchema,
  submitAttemptSchema,
  upsertStudentProfileSchema,
  type AttemptResult,
  type StudentProfile,
} from "@onthilab/contracts";
import {
  ProfileRepositoryError,
  type CatalogRepository,
  type UserProfileRepository,
} from "@onthilab/database";
import { Hono, type MiddlewareHandler } from "hono";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import {
  AuthenticationError,
  type AuthIdentity,
  type TokenVerifier,
  UnconfiguredTokenVerifier,
} from "./auth";
import { demoAnswerKey, demoExam } from "./fixtures";
import { openApiDocument } from "./openapi";

interface StoredAttempt {
  id: string;
  examId: string;
  deviceId: string;
  startedAt: string;
  expiresAt: string;
  answers: Record<string, number[]>;
  sequences: Record<string, number>;
  result?: AttemptResult;
}

interface AppDependencies {
  catalog: CatalogRepository;
  auth: TokenVerifier;
  profiles: UserProfileRepository;
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

type AppEnvironment = {
  Variables: {
    identity: AuthIdentity;
    profile: StudentProfile;
  };
};

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

export function createApp(overrides: Partial<AppDependencies> = {}) {
  const dependencies: AppDependencies = {
    catalog: demoCatalogRepository,
    auth: new UnconfiguredTokenVerifier(),
    profiles: unavailableProfileRepository,
    ...overrides,
  };
  const attempts = new Map<string, StoredAttempt>();
  const activeAttemptByDevice = new Map<string, string>();
  const app = new Hono<AppEnvironment>();

  app.use("*", requestId());
  app.use("*", secureHeaders());
  app.use(
    "*",
    cors({
      origin: ["http://localhost:5173"],
      allowHeaders: ["Content-Type", "Authorization", "X-Device-Id"],
      allowMethods: ["GET", "POST", "PUT", "OPTIONS"],
    }),
  );

  app.get("/openapi.json", (context) => context.json(openApiDocument));

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
  app.use("/v1/catalog", requireProfile);
  app.use("/v1/exams/*", requireProfile);
  app.use("/v1/attempts", requireProfile);
  app.use("/v1/attempts/*", requireProfile);

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

    return context.json({ data: exam });
  });

  app.post("/v1/attempts", async (context) => {
    const parsed = createAttemptSchema.safeParse(await context.req.json());

    if (!parsed.success) {
      return context.json(
        { error: "INVALID_INPUT", details: parsed.error.flatten() },
        400,
      );
    }

    if (parsed.data.examId !== demoExam.id) {
      return context.json({ error: "EXAM_NOT_FOUND" }, 404);
    }

    const activeAttemptId = activeAttemptByDevice.get(parsed.data.deviceId);
    if (activeAttemptId) {
      const activeAttempt = attempts.get(activeAttemptId);
      if (activeAttempt && !activeAttempt.result) {
        return context.json({ data: activeAttempt, resumed: true });
      }
    }

    const id = crypto.randomUUID();
    const startedAt = new Date();
    const attempt: StoredAttempt = {
      id,
      examId: parsed.data.examId,
      deviceId: parsed.data.deviceId,
      startedAt: startedAt.toISOString(),
      expiresAt: new Date(
        startedAt.getTime() + demoExam.durationMinutes * 60_000,
      ).toISOString(),
      answers: {},
      sequences: {},
    };
    attempts.set(id, attempt);
    activeAttemptByDevice.set(parsed.data.deviceId, id);

    return context.json({ data: attempt, resumed: false }, 201);
  });

  app.put("/v1/attempts/:attemptId/answers", async (context) => {
    const attempt = attempts.get(context.req.param("attemptId"));
    if (!attempt) {
      return context.json({ error: "ATTEMPT_NOT_FOUND" }, 404);
    }
    if (attempt.result) {
      return context.json({ error: "ATTEMPT_CLOSED" }, 409);
    }
    if (new Date(attempt.expiresAt).getTime() <= Date.now()) {
      return context.json({ error: "ATTEMPT_EXPIRED" }, 409);
    }

    const parsed = saveAnswerSchema.safeParse(await context.req.json());
    if (!parsed.success) {
      return context.json(
        { error: "INVALID_INPUT", details: parsed.error.flatten() },
        400,
      );
    }

    const currentSequence = attempt.sequences[parsed.data.questionId] ?? -1;
    if (parsed.data.sequence >= currentSequence) {
      attempt.answers[parsed.data.questionId] = parsed.data.selectedOptions;
      attempt.sequences[parsed.data.questionId] = parsed.data.sequence;
    }

    return context.json({
      data: {
        savedAt: new Date().toISOString(),
        sequence: attempt.sequences[parsed.data.questionId],
      },
    });
  });

  app.post("/v1/attempts/:attemptId/submit", async (context) => {
    const attempt = attempts.get(context.req.param("attemptId"));
    if (!attempt) {
      return context.json({ error: "ATTEMPT_NOT_FOUND" }, 404);
    }
    if (attempt.result) {
      return context.json({ data: attempt.result, idempotent: true });
    }

    const parsed = submitAttemptSchema.safeParse(await context.req.json());
    if (!parsed.success) {
      return context.json(
        { error: "INVALID_INPUT", details: parsed.error.flatten() },
        400,
      );
    }

    const score = calculateScore(attempt.answers, demoAnswerKey);
    const result: AttemptResult = {
      attemptId: attempt.id,
      status: parsed.data.reason === "timeout" ? "auto_submitted" : "submitted",
      ...score,
      submittedAt: new Date().toISOString(),
    };
    attempt.result = result;
    activeAttemptByDevice.delete(attempt.deviceId);

    return context.json({ data: result, idempotent: false });
  });

  app.get("/v1/attempts/:attemptId", (context) => {
    const attempt = attempts.get(context.req.param("attemptId"));
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

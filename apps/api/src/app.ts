import {
  calculateScore,
  createAttemptSchema,
  saveAnswerSchema,
  submitAttemptSchema,
  type AttemptResult,
} from "@onthilab/contracts";
import type { CatalogRepository } from "@onthilab/database";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
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
}

const demoCatalogRepository: CatalogRepository = {
  listPublished: async () => [demoExam],
  findPublishedByIdOrCode: async (idOrCode) =>
    idOrCode === demoExam.id || idOrCode === demoExam.code ? demoExam : null,
};

export function createApp(
  dependencies: AppDependencies = { catalog: demoCatalogRepository },
) {
  const attempts = new Map<string, StoredAttempt>();
  const activeAttemptByDevice = new Map<string, string>();
  const app = new Hono();

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

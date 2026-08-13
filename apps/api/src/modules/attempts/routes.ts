import {
  createAttemptSchema,
  saveAnswerSchema,
  submitAttemptSchema,
} from "@onthilab/contracts";
import { AttemptRepositoryError } from "@onthilab/database";
import type { Hono } from "hono";
import type { AppDependencies, AppEnvironment } from "../../app-context";
import { studentQuestionImageUrl } from "../../http/question-images";

export function registerAttemptRoutes(
  app: Hono<AppEnvironment>,
  dependencies: AppDependencies,
): void {
  app.get("/v1/me/statistics", async (context) =>
    context.json({
      data: await dependencies.attempts.getStatistics(
        context.get("profile").id,
      ),
    }),
  );

  app.get("/v1/attempts", async (context) =>
    context.json({
      data: await dependencies.attempts.listUserAttempts(
        context.get("profile").id,
      ),
    }),
  );

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
    return attempt
      ? context.json({ data: attempt })
      : context.json({ error: "ATTEMPT_NOT_FOUND" }, 404);
  });

  app.get("/v1/attempts/:attemptId/session", async (context) => {
    const session = await dependencies.attempts.findSessionForUser(
      context.req.param("attemptId"),
      context.get("profile").id,
    );
    if (!session) return context.json({ error: "ATTEMPT_NOT_FOUND" }, 404);

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
}

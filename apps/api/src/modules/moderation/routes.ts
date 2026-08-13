import {
  createFeedbackSchema,
  createReportSchema,
  resolveReportSchema,
} from "@onthilab/contracts";
import { ReportRepositoryError } from "@onthilab/database";
import type { Hono, MiddlewareHandler } from "hono";
import { z } from "zod";
import type { AppDependencies, AppEnvironment } from "../../app-context";
import { studentQuestionImageUrl } from "../../http/question-images";

const uuidSchema = z.string().uuid();

export function registerModerationRoutes(
  app: Hono<AppEnvironment>,
  dependencies: AppDependencies,
  requireProfile: MiddlewareHandler<AppEnvironment>,
  requireAdmin: MiddlewareHandler<AppEnvironment>,
  requireContributor: MiddlewareHandler<AppEnvironment>,
): void {
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

  app.get("/v1/admin/feedback", requireAdmin, async (context) =>
    context.json({ data: await dependencies.feedback.listNew() }),
  );
  app.post("/v1/admin/feedback/:id/resolve", requireAdmin, async (context) => {
    const feedbackId = uuidSchema.safeParse(context.req.param("id"));
    if (!feedbackId.success) {
      return context.json({ error: "INVALID_FEEDBACK_ID" }, 400);
    }
    const resolved = await dependencies.feedback.resolve(feedbackId.data);
    return resolved
      ? context.json({ data: resolved })
      : context.json({ error: "FEEDBACK_NOT_FOUND" }, 404);
  });

  app.get("/v1/admin/reports", requireContributor, async (context) => {
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
  });
  app.post(
    "/v1/admin/reports/:id/resolve",
    requireContributor,
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
}

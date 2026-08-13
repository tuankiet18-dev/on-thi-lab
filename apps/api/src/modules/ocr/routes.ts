import {
  updateExamPresentationModeSchema,
  updateOcrQuestionSchema,
} from "@onthilab/contracts";
import type { Hono } from "hono";
import type { AppDependencies, AppEnvironment } from "../../app-context";
import { publicQuestionImageUrl } from "../../http/question-images";

export function registerOcrRoutes(
  app: Hono<AppEnvironment>,
  dependencies: AppDependencies,
): void {
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

    const revisionId = context.req.param("revisionId");
    await dependencies.ocrRepository.setExamPresentationMode(
      revisionId,
      parsed.data.mode,
    );
    if (parsed.data.mode === "text" || parsed.data.mode === "hybrid") {
      await dependencies.ocrService.enqueueRevisionOcrJobs(revisionId);
    }
    return context.json({ success: true });
  });
}

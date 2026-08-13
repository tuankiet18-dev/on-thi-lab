import { updateQuestionAnswerSchema } from "@onthilab/contracts";
import { DraftImportRepositoryError } from "@onthilab/database";
import type { Hono, MiddlewareHandler } from "hono";
import type { AppDependencies, AppEnvironment } from "../../app-context";
import { AnswerSuggestionServiceError } from "../../answer-suggestion-service";
import { publicQuestionImageUrl } from "../../http/question-images";

export function registerExamReviewRoutes(
  app: Hono<AppEnvironment>,
  dependencies: AppDependencies,
  requireAdmin: MiddlewareHandler<AppEnvironment>,
): void {
  app.get("/v1/admin/drafts", async (context) =>
    context.json({ data: await dependencies.reviews.findDrafts() }),
  );
  app.get("/v1/admin/exams", async (context) =>
    context.json({ data: await dependencies.reviews.findAllExams() }),
  );
  app.delete("/v1/admin/exams/:examId", requireAdmin, async (context) => {
    await dependencies.reviews.deleteExam(context.req.param("examId"));
    return context.json({ success: true });
  });

  app.get("/v1/admin/exams/:examId/review", async (context) => {
    const review = await dependencies.reviews.findReview(
      context.req.param("examId"),
    );
    if (!review) return context.json({ error: "EXAM_NOT_FOUND" }, 404);
    return context.json({
      data: {
        ...review,
        questions: review.questions.map(({ imageKey, ...question }) => ({
          ...question,
          imageUrl: publicQuestionImageUrl(
            imageKey,
            dependencies.questionImageBaseUrl,
          ),
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
          const status = await dependencies.ocrRepository.getExamOcrStatus(
            review.revisionId,
          );
          if (!status.canPublish) {
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
}

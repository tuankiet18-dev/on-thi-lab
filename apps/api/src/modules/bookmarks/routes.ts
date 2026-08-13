import { BookmarkRepositoryError } from "@onthilab/database";
import type { Hono } from "hono";
import type { AppDependencies, AppEnvironment } from "../../app-context";
import { studentQuestionImageUrl } from "../../http/question-images";

export function registerBookmarkRoutes(
  app: Hono<AppEnvironment>,
  dependencies: AppDependencies,
): void {
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
}

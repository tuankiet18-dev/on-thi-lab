import type { Hono } from "hono";
import type { AppDependencies, AppEnvironment } from "../../app-context";
import { studentQuestionImageUrl } from "../../http/question-images";

export function registerCatalogRoutes(
  app: Hono<AppEnvironment>,
  dependencies: AppDependencies,
): void {
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
    if (!curriculumId) {
      return context.json({ error: "curriculumId is required" }, 400);
    }
    return context.json({
      data: await dependencies.catalog.listTermCourses(curriculumId),
    });
  });

  app.get("/v1/exams/:examId", async (context) => {
    const exam = await dependencies.catalog.findPublishedByIdOrCode(
      context.req.param("examId"),
    );
    if (!exam) return context.json({ error: "EXAM_NOT_FOUND" }, 404);

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
}

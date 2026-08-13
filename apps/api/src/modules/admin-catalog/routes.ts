import {
  createCourseSchema,
  createCurriculumSchema,
  createMajorSchema,
  updateCourseSchema,
  upsertCurriculumCourseSchema,
} from "@onthilab/contracts";
import { AdminCatalogRepositoryError } from "@onthilab/database";
import type { Hono, MiddlewareHandler } from "hono";
import { z } from "zod";
import type { AppDependencies, AppEnvironment } from "../../app-context";

const uuidSchema = z.string().uuid();

export function registerAdminCatalogRoutes(
  app: Hono<AppEnvironment>,
  dependencies: AppDependencies,
  requireAdmin: MiddlewareHandler<AppEnvironment>,
): void {
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
        return context.json({
          data: await dependencies.adminCatalog.updateCourse(
            parsedId.data,
            parsed.data,
          ),
        });
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
      try {
        await dependencies.adminCatalog.deleteCourse(parsedId.data);
        return context.json({ success: true });
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
}

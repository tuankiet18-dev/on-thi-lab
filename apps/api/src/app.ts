import { Hono } from "hono";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import type { AppDependencies, AppEnvironment } from "./app-context";
import { createDefaultDependencies } from "./default-dependencies";
import {
  authenticationMiddleware,
  profileRequiredMiddleware,
  roleRequiredMiddleware,
} from "./http/middleware";
import { openApiDocument } from "./openapi";
import { registerAdminCatalogRoutes } from "./modules/admin-catalog/routes";
import { registerAdminUserRoutes } from "./modules/admin-users/routes";
import { registerAttemptRoutes } from "./modules/attempts/routes";
import { registerBookmarkRoutes } from "./modules/bookmarks/routes";
import { registerCatalogRoutes } from "./modules/catalog/routes";
import { registerExamReviewRoutes } from "./modules/exam-review/routes";
import { registerImportRoutes } from "./modules/imports/routes";
import { registerModerationRoutes } from "./modules/moderation/routes";
import { registerOcrRoutes } from "./modules/ocr/routes";
import { registerProfileRoutes } from "./modules/profiles/routes";

function registerPublicRoutes(
  app: Hono<AppEnvironment>,
  dependencies: AppDependencies,
): void {
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
}

function registerErrorHandlers(app: Hono<AppEnvironment>): void {
  app.notFound((context) =>
    context.json(
      { error: "NOT_FOUND", requestId: context.get("requestId") },
      404,
    ),
  );
  app.onError((error, context) => {
    console.error("Unhandled API error", {
      requestId: context.get("requestId"),
      error: error instanceof Error ? error.message : "Unknown error",
      cause:
        error instanceof Error && (error as Error & { cause?: unknown }).cause
          ? (error as Error & { cause?: unknown }).cause
          : undefined,
    });
    return context.json(
      { error: "INTERNAL_SERVER_ERROR", requestId: context.get("requestId") },
      500,
    );
  });
}

/**
 * HTTP composition root. Business routes live under `modules/<domain>`; this
 * function only wires dependencies, cross-cutting middleware and modules.
 */
export function createApp(overrides: Partial<AppDependencies> = {}) {
  const dependencies: AppDependencies = {
    ...createDefaultDependencies(),
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

  registerPublicRoutes(app, dependencies);

  app.use("/v1/*", authenticationMiddleware(dependencies.auth));
  registerProfileRoutes(app, dependencies);

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

  registerAdminUserRoutes(app, dependencies, requireAdmin, requireContributor);
  registerAdminCatalogRoutes(app, dependencies, requireAdmin);
  registerImportRoutes(app, dependencies);
  registerExamReviewRoutes(app, dependencies, requireAdmin);
  registerOcrRoutes(app, dependencies);
  registerCatalogRoutes(app, dependencies);
  registerAttemptRoutes(app, dependencies);
  registerBookmarkRoutes(app, dependencies);
  registerModerationRoutes(
    app,
    dependencies,
    requireProfile,
    requireAdmin,
    requireContributor,
  );

  registerErrorHandlers(app);
  return app;
}

export const app = createApp();

import type { Hono, MiddlewareHandler } from "hono";
import type { AppDependencies, AppEnvironment } from "../../app-context";

export function registerAdminUserRoutes(
  app: Hono<AppEnvironment>,
  dependencies: AppDependencies,
  requireAdmin: MiddlewareHandler<AppEnvironment>,
  requireContributor: MiddlewareHandler<AppEnvironment>,
): void {
  app.post("/v1/admin/users/:id/role", requireAdmin, async (context) => {
    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: "INVALID_INPUT" }, 400);
    }
    const { role } = body as { role?: string };
    if (role !== "user" && role !== "contributor" && role !== "admin") {
      return context.json(
        { error: "INVALID_INPUT", message: "Quyền không hợp lệ" },
        400,
      );
    }
    await dependencies.profiles.updateRole(context.req.param("id"), role);
    return context.json({ data: { success: true } });
  });

  app.get(
    "/v1/admin/attention-summary",
    requireContributor,
    async (context) => {
      const summary = await dependencies.attention.getSummary();
      if (context.get("profile").role === "contributor") {
        return context.json({
          data: {
            drafts: summary.drafts,
            reports: summary.reports,
            feedback: 0,
            total: summary.drafts + summary.reports,
          },
        });
      }
      return context.json({ data: summary });
    },
  );

  app.get("/v1/admin/users/search", requireAdmin, async (context) => {
    const query = context.req.query("q") || "";
    if (query.trim().length < 3) return context.json({ data: [] });
    return context.json({
      data: await dependencies.profiles.searchUsers(query.trim()),
    });
  });
}

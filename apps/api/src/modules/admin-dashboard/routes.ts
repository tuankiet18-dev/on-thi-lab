import { adminDashboardDaysSchema } from "@onthilab/contracts";
import type { Hono, MiddlewareHandler } from "hono";
import type { AppDependencies, AppEnvironment } from "../../app-context";

export function registerAdminDashboardRoutes(
  app: Hono<AppEnvironment>,
  dependencies: AppDependencies,
  requireAdmin: MiddlewareHandler<AppEnvironment>,
): void {
  app.get("/v1/admin/dashboard", requireAdmin, async (context) => {
    const rawDays = context.req.query("days");
    const parseResult = adminDashboardDaysSchema.safeParse(
      rawDays === undefined || rawDays === "" ? undefined : rawDays,
    );
    if (!parseResult.success) {
      return context.json(
        {
          error: "INVALID_INPUT",
          message: "days phải là 7, 30 hoặc 90",
        },
        400,
      );
    }

    const data = await dependencies.adminDashboard.getDashboard(
      parseResult.data,
    );
    return context.json({ data });
  });
}

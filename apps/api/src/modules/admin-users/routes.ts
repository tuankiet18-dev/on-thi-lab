import {
  adminUserFilterSchema,
  updateUserRoleInputSchema,
  updateUserStatusInputSchema,
} from "@onthilab/contracts";
import type { Hono, MiddlewareHandler } from "hono";
import type { AppDependencies, AppEnvironment } from "../../app-context";

export function registerAdminUserRoutes(
  app: Hono<AppEnvironment>,
  dependencies: AppDependencies,
  requireAdmin: MiddlewareHandler<AppEnvironment>,
  requireContributor: MiddlewareHandler<AppEnvironment>,
): void {
  app.get("/v1/admin/users", requireAdmin, async (context) => {
    const parseResult = adminUserFilterSchema.safeParse(context.req.query());
    if (!parseResult.success) {
      return context.json(
        { error: "INVALID_INPUT", message: "Tham số tìm kiếm không hợp lệ" },
        400,
      );
    }

    const data = await dependencies.profiles.listUsersForAdmin(
      parseResult.data,
    );
    return context.json({ data });
  });

  app.post("/v1/admin/users/:id/role", requireAdmin, async (context) => {
    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: "INVALID_INPUT" }, 400);
    }

    const parseResult = updateUserRoleInputSchema.safeParse(body);
    if (!parseResult.success) {
      return context.json(
        { error: "INVALID_INPUT", message: "Quyền không hợp lệ" },
        400,
      );
    }

    const targetUserId = context.req.param("id");
    const currentAdminId = context.get("profile")?.id;

    if (
      currentAdminId &&
      targetUserId === currentAdminId &&
      parseResult.data.role !== "admin"
    ) {
      return context.json(
        {
          error: "FORBIDDEN_SELF_ACTION",
          message: "Quản trị viên không thể tự hạ quyền của chính mình",
        },
        400,
      );
    }

    await dependencies.profiles.updateRole(targetUserId, parseResult.data.role);
    return context.json({ data: { success: true } });
  });

  app.post("/v1/admin/users/:id/status", requireAdmin, async (context) => {
    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: "INVALID_INPUT" }, 400);
    }

    const parseResult = updateUserStatusInputSchema.safeParse(body);
    if (!parseResult.success) {
      return context.json(
        { error: "INVALID_INPUT", message: "Trạng thái không hợp lệ" },
        400,
      );
    }

    const targetUserId = context.req.param("id");
    const currentAdminId = context.get("profile")?.id;

    if (
      currentAdminId &&
      targetUserId === currentAdminId &&
      !parseResult.data.isActive
    ) {
      return context.json(
        {
          error: "FORBIDDEN_SELF_ACTION",
          message: "Quản trị viên không thể tự khóa tài khoản của chính mình",
        },
        400,
      );
    }

    await dependencies.profiles.updateStatus(
      targetUserId,
      parseResult.data.isActive,
    );
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

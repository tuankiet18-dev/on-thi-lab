import { upsertStudentProfileSchema } from "@onthilab/contracts";
import { ProfileRepositoryError } from "@onthilab/database";
import type { Hono } from "hono";
import type { AppDependencies, AppEnvironment } from "../../app-context";

export function registerProfileRoutes(
  app: Hono<AppEnvironment>,
  dependencies: AppDependencies,
): void {
  app.get("/v1/me", async (context) => {
    try {
      const profile = await dependencies.profiles.findBySubject(
        context.get("identity").subject,
      );
      return context.json({ data: profile });
    } catch (error) {
      if (
        error instanceof ProfileRepositoryError &&
        error.code === "PROFILE_DISABLED"
      ) {
        return context.json(
          {
            error: "PROFILE_DISABLED",
            message:
              "Tài khoản của bạn đã bị khóa bởi quản trị viên. Vui lòng liên hệ ban quản trị để được hỗ trợ.",
          },
          403,
        );
      }
      throw error;
    }
  });

  app.put("/v1/me", async (context) => {
    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: "INVALID_INPUT" }, 400);
    }

    const parsed = upsertStudentProfileSchema.safeParse(body);
    if (!parsed.success) {
      return context.json(
        { error: "INVALID_INPUT", details: parsed.error.flatten() },
        400,
      );
    }

    const identity = context.get("identity");
    if (!identity.emailVerified) {
      return context.json(
        {
          error: "EMAIL_NOT_VERIFIED",
          message: "Vui lòng xác thực email trước khi tạo hồ sơ.",
        },
        403,
      );
    }

    try {
      const profile = await dependencies.profiles.upsert(
        { subject: identity.subject, email: identity.email },
        parsed.data,
      );
      return context.json({ data: profile });
    } catch (error) {
      if (error instanceof ProfileRepositoryError) {
        const status =
          error.code === "PROFILE_CONFLICT"
            ? 409
            : error.code === "PROFILE_DISABLED"
              ? 403
              : 400;
        return context.json({ error: error.code }, status);
      }
      throw error;
    }
  });

  app.get("/v1/profile-options", async (context) =>
    context.json({ data: await dependencies.profiles.listOptions() }),
  );
}

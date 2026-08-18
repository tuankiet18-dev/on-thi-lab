import type { UserRole } from "@onthilab/contracts";
import type { UserProfileRepository } from "@onthilab/database";
import type { MiddlewareHandler } from "hono";
import {
  AuthenticationError,
  type AuthIdentity,
  type TokenVerifier,
} from "../auth";
import type { AppEnvironment } from "../app-context";

export function authenticationMiddleware(
  verifier: TokenVerifier,
): MiddlewareHandler<AppEnvironment> {
  return async (context, next) => {
    const match = context.req
      .header("Authorization")
      ?.match(/^Bearer\s+(.+)$/i);
    if (!match?.[1]) return context.json({ error: "UNAUTHORIZED" }, 401);

    let identity: AuthIdentity;
    try {
      identity = await verifier.verify(match[1]);
    } catch (error) {
      if (
        error instanceof AuthenticationError &&
        error.code === "AUTH_NOT_CONFIGURED"
      ) {
        return context.json({ error: error.code }, 503);
      }
      return context.json({ error: "UNAUTHORIZED" }, 401);
    }

    context.set("identity", identity);
    await next();
  };
}

import { ProfileRepositoryError } from "@onthilab/database";

export function profileRequiredMiddleware(
  profiles: UserProfileRepository,
): MiddlewareHandler<AppEnvironment> {
  return async (context, next) => {
    let profile;
    try {
      profile = await profiles.findBySubject(context.get("identity").subject);
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

    if (!profile) return context.json({ error: "PROFILE_REQUIRED" }, 403);

    context.set("profile", profile);
    await next();
  };
}

export function roleRequiredMiddleware(
  ...allowedRoles: readonly UserRole[]
): MiddlewareHandler<AppEnvironment> {
  return async (context, next) => {
    if (!allowedRoles.includes(context.get("profile").role)) {
      return context.json({ error: "FORBIDDEN" }, 403);
    }
    await next();
  };
}

import { CognitoJwtVerifier } from "aws-jwt-verify";

export interface AuthIdentity {
  subject: string;
  email: string;
  name: string;
  groups: string[];
}

export interface TokenVerifier {
  verify(token: string): Promise<AuthIdentity>;
}

export class AuthenticationError extends Error {
  constructor(
    readonly code: "AUTH_NOT_CONFIGURED" | "INVALID_TOKEN",
    message: string,
  ) {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class UnconfiguredTokenVerifier implements TokenVerifier {
  async verify(): Promise<AuthIdentity> {
    throw new AuthenticationError(
      "AUTH_NOT_CONFIGURED",
      "API authentication is not configured",
    );
  }
}

export class CognitoIdTokenVerifier implements TokenVerifier {
  private readonly verifier;

  constructor(userPoolId: string, clientId: string) {
    this.verifier = CognitoJwtVerifier.create({
      userPoolId,
      clientId,
      tokenUse: "id",
    });
  }

  async verify(token: string): Promise<AuthIdentity> {
    try {
      const payload = await this.verifier.verify(token);
      const email = typeof payload.email === "string" ? payload.email : "";
      if (!payload.sub || !email || payload.email_verified === false) {
        throw new Error("Required identity claims are missing");
      }

      const name =
        typeof payload.name === "string" && payload.name.trim()
          ? payload.name.trim()
          : email.split("@")[0] || "Sinh viên";
      const groups = Array.isArray(payload["cognito:groups"])
        ? payload["cognito:groups"].filter(
            (group): group is string => typeof group === "string",
          )
        : [];

      return { subject: payload.sub, email, name, groups };
    } catch {
      throw new AuthenticationError(
        "INVALID_TOKEN",
        "The bearer token is invalid or expired",
      );
    }
  }
}

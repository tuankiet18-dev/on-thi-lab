import { describe, expect, it } from "vitest";
import { readPublicWebConfig, readServerConfig } from "./index";

const baseServerEnvironment = {
  DATABASE_URL: "postgresql://onthilab:onthilab@localhost:5432/onthilab",
};

describe("runtime configuration", () => {
  it("uses safe feature flag defaults", () => {
    const config = readServerConfig(baseServerEnvironment);

    expect(config.appEnv).toBe("development");
    expect(config.flags).toEqual({
      googleAuthEnabled: false,
      aiImportEnabled: false,
      monetizationEnabled: false,
      registrationEnabled: true,
    });
  });

  it("requires payOS credentials before monetization can be enabled", () => {
    expect(() =>
      readServerConfig({
        ...baseServerEnvironment,
        FEATURE_MONETIZATION_ENABLED: "true",
      }),
    ).toThrow();
  });

  it("accepts a complete monetization configuration", () => {
    const config = readServerConfig({
      ...baseServerEnvironment,
      FEATURE_MONETIZATION_ENABLED: "true",
      PAYOS_CLIENT_ID: "client",
      PAYOS_API_KEY: "api",
      PAYOS_CHECKSUM_KEY: "checksum",
      PAYOS_WEBHOOK_URL: "https://api.onthilab.vn/v1/webhooks/payos",
    });

    expect(config.flags.monetizationEnabled).toBe(true);
  });

  it("requires a server-side model and key before AI suggestions are enabled", () => {
    expect(() =>
      readServerConfig({
        ...baseServerEnvironment,
        FEATURE_AI_IMPORT_ENABLED: "true",
        AI_PROVIDER: "groq",
      }),
    ).toThrow();

    const config = readServerConfig({
      ...baseServerEnvironment,
      FEATURE_AI_IMPORT_ENABLED: "true",
      AI_PROVIDER: "groq",
      AI_MODEL: "vision-test",
      AI_API_KEY: "server-only",
      AI_BASE_URL: "https://ai.example.test/v1",
      AI_LOCAL_CONCURRENCY: "3",
    });
    expect(config.flags.aiImportEnabled).toBe(true);
    expect(config.aiLocalConcurrency).toBe(3);
  });

  it("keeps browser configuration free of server secrets", () => {
    expect(
      readPublicWebConfig({
        VITE_API_URL: "http://localhost:8787",
      }),
    ).toEqual({
      apiUrl: "http://localhost:8787",
      cognitoDomain: undefined,
      cognitoClientId: undefined,
      cognitoRedirectUri: undefined,
      cognitoLogoutUri: undefined,
      flags: {
        googleAuthEnabled: false,
      },
    });
  });

  it("uses the local API fallback when the browser API variable is empty", () => {
    expect(readPublicWebConfig({ VITE_API_URL: "" }).apiUrl).toBe(
      "http://localhost:8787",
    );
  });
});

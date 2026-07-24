import { z } from "zod";

export const appEnvironments = [
  "development",
  "test",
  "staging",
  "production",
] as const;

const booleanFromEnvironment = z
  .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
  .transform((value) => value === true || value === "true" || value === "1");

const optionalUrl = z
  .union([z.literal(""), z.url()])
  .optional()
  .transform((value) => value || undefined);

export const featureFlagsSchema = z.object({
  googleAuthEnabled: booleanFromEnvironment.default(false),
  aiImportEnabled: booleanFromEnvironment.default(false),
  monetizationEnabled: booleanFromEnvironment.default(false),
  registrationEnabled: booleanFromEnvironment.default(true),
});

export type FeatureFlags = z.infer<typeof featureFlagsSchema>;

export const serverConfigSchema = z
  .object({
    appEnv: z.enum(appEnvironments).default("development"),
    logLevel: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace"])
      .default("info"),
    databaseUrl: z.string().min(1),
    awsRegion: z.string().default("ap-southeast-1"),
    cognitoUserPoolId: z.string().optional(),
    cognitoClientId: z.string().optional(),
    aiProvider: z
      .enum([
        "disabled",
        "openai-compatible",
        "groq",
        "gemini",
        "openai",
        "bedrock",
      ])
      .default("disabled"),
    aiModel: z.string().optional(),
    aiApiKey: z.string().optional(),
    aiBaseUrl: optionalUrl,
    aiSuggestionQueueUrl: optionalUrl,
    aiLocalConcurrency: z.coerce.number().int().min(1).max(5).default(2),
    payosClientId: z.string().optional(),
    payosApiKey: z.string().optional(),
    payosChecksumKey: z.string().optional(),
    payosWebhookUrl: optionalUrl,
    flags: featureFlagsSchema,
  })
  .superRefine((config, context) => {
    if (config.flags.googleAuthEnabled) {
      if (!config.cognitoUserPoolId) {
        context.addIssue({
          code: "custom",
          path: ["cognitoUserPoolId"],
          message: "Required when Google authentication is enabled",
        });
      }
      if (!config.cognitoClientId) {
        context.addIssue({
          code: "custom",
          path: ["cognitoClientId"],
          message: "Required when Google authentication is enabled",
        });
      }
    }

    if (config.flags.aiImportEnabled) {
      if (config.aiProvider === "disabled") {
        context.addIssue({
          code: "custom",
          path: ["aiProvider"],
          message: "An AI provider is required when AI import is enabled",
        });
      }
      if (config.aiProvider !== "bedrock" && !config.aiApiKey) {
        context.addIssue({
          code: "custom",
          path: ["aiApiKey"],
          message: "Required for external AI providers",
        });
      }
      if (!config.aiModel) {
        context.addIssue({
          code: "custom",
          path: ["aiModel"],
          message: "An AI model is required when AI import is enabled",
        });
      }
    }

    if (config.flags.monetizationEnabled) {
      const requiredPayosValues = [
        ["payosClientId", config.payosClientId],
        ["payosApiKey", config.payosApiKey],
        ["payosChecksumKey", config.payosChecksumKey],
        ["payosWebhookUrl", config.payosWebhookUrl],
      ] as const;

      for (const [field, value] of requiredPayosValues) {
        if (!value) {
          context.addIssue({
            code: "custom",
            path: [field],
            message: "Required when monetization is enabled",
          });
        }
      }
    }
  });

export type ServerConfig = z.infer<typeof serverConfigSchema>;

export function readServerConfig(
  environment: Record<string, string | undefined>,
): ServerConfig {
  return serverConfigSchema.parse({
    appEnv: environment.APP_ENV,
    logLevel: environment.LOG_LEVEL,
    databaseUrl: environment.DATABASE_URL,
    awsRegion: environment.AWS_REGION,
    cognitoUserPoolId: environment.COGNITO_USER_POOL_ID,
    cognitoClientId: environment.COGNITO_CLIENT_ID,
    aiProvider: environment.AI_PROVIDER,
    aiModel: environment.AI_MODEL,
    aiApiKey: environment.AI_API_KEY,
    aiBaseUrl: environment.AI_BASE_URL,
    aiSuggestionQueueUrl: environment.AI_SUGGESTION_QUEUE_URL,
    aiLocalConcurrency: environment.AI_LOCAL_CONCURRENCY,
    payosClientId: environment.PAYOS_CLIENT_ID,
    payosApiKey: environment.PAYOS_API_KEY,
    payosChecksumKey: environment.PAYOS_CHECKSUM_KEY,
    payosWebhookUrl: environment.PAYOS_WEBHOOK_URL,
    flags: {
      googleAuthEnabled: environment.FEATURE_GOOGLE_AUTH_ENABLED,
      aiImportEnabled: environment.FEATURE_AI_IMPORT_ENABLED,
      monetizationEnabled: environment.FEATURE_MONETIZATION_ENABLED,
      registrationEnabled: environment.FEATURE_REGISTRATION_ENABLED,
    },
  });
}

export const publicWebConfigSchema = z.object({
  apiUrl: z.url(),
  cognitoDomain: optionalUrl,
  cognitoClientId: z.string().optional(),
  cognitoRedirectUri: optionalUrl,
  cognitoLogoutUri: optionalUrl,
  flags: z.object({
    googleAuthEnabled: booleanFromEnvironment.default(false),
  }),
});

export type PublicWebConfig = z.infer<typeof publicWebConfigSchema>;

export function readPublicWebConfig(
  environment: Record<string, string | undefined>,
): PublicWebConfig {
  return publicWebConfigSchema.parse({
    apiUrl: environment.VITE_API_URL ?? "http://localhost:8787",
    cognitoDomain: environment.VITE_COGNITO_DOMAIN,
    cognitoClientId: environment.VITE_COGNITO_CLIENT_ID,
    cognitoRedirectUri: environment.VITE_COGNITO_REDIRECT_URI,
    cognitoLogoutUri: environment.VITE_COGNITO_LOGOUT_URI,
    flags: {
      googleAuthEnabled: environment.VITE_FEATURE_GOOGLE_AUTH_ENABLED,
    },
  });
}

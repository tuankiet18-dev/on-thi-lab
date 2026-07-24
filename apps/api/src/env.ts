/**
 * Server-side environment variable validation.
 * Call parseEnv() once at startup; it throws with a clear message if any
 * required variable is missing or malformed so the process exits immediately
 * rather than failing silently at runtime.
 *
 * Never import this module in browser/client code.
 */

import { z } from "zod";

const boolFlag = z
  .enum(["true", "false", "1", "0"])
  .transform((v) => v === "true" || v === "1")
  .default(false as any); // Type assertion required in zod for transformed defaults

const envSchema = z.object({
  // ── Runtime ──────────────────────────────────────────────────────────────
  APP_ENV: z
    .enum(["development", "staging", "production"])
    .default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // ── Database ─────────────────────────────────────────────────────────────
  DATABASE_URL: z.string().url().optional(),

  // ── Cognito ──────────────────────────────────────────────────────────────
  COGNITO_USER_POOL_ID: z.string().optional(),
  COGNITO_CLIENT_ID: z.string().optional(),

  // ── Storage ──────────────────────────────────────────────────────────────
  QUESTION_IMAGE_BASE_URL: z.string().url().optional(),
  QUESTION_IMAGE_STORAGE_PATH: z.string().optional(),

  // ── CORS ─────────────────────────────────────────────────────────────────
  /**
   * Comma-separated list of allowed origins.
   * Defaults to localhost:5173 for development.
   * Example: "https://app.onthilab.vn,https://staging.onthilab.vn"
   */
  CORS_ORIGINS: z.string().optional(),

  // ── AI ───────────────────────────────────────────────────────────────────
  AI_PROVIDER: z.enum(["disabled", "openai", "groq"]).default("disabled"),
  AI_MODEL: z.string().optional(),
  AI_API_KEY: z.string().optional(),
  AI_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
  AI_SUGGESTION_QUEUE_URL: z.string().url().optional(),
  AI_LOCAL_CONCURRENCY: z.coerce.number().int().min(1).max(10).default(2),

  // ── payOS ────────────────────────────────────────────────────────────────
  PAYOS_CLIENT_ID: z.string().optional(),
  PAYOS_API_KEY: z.string().optional(),
  PAYOS_CHECKSUM_KEY: z.string().optional(),
  PAYOS_WEBHOOK_URL: z.string().url().optional(),

  // ── Feature flags ─────────────────────────────────────────────────────────
  FEATURE_GOOGLE_AUTH_ENABLED: boolFlag,
  FEATURE_AI_IMPORT_ENABLED: boolFlag,
  FEATURE_MONETIZATION_ENABLED: boolFlag,
  FEATURE_REGISTRATION_ENABLED: boolFlag.default(true as any),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parse and validate `process.env` (or a custom record for testing).
 * Throws a `ZodError`-derived Error with a human-readable list of issues
 * if validation fails so the process exits before serving requests.
 */
export function parseEnv(
  raw: Record<string, string | undefined> = process.env,
): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  • ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `[OnThiLab] Environment variable validation failed:\n${issues}`,
    );
  }
  return result.data;
}

/**
 * Parse CORS_ORIGINS env variable into an array of allowed origins.
 * Falls back to localhost for development.
 */
export function parseCorsOrigins(raw?: string): string[] {
  if (!raw) return ["http://localhost:5173"];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

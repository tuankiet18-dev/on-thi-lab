import {
  createDatabase,
  PostgresAttemptRepository,
  PostgresAdminCatalogRepository,
  PostgresCatalogRepository,
  PostgresDraftImportRepository,
  PostgresReportRepository,
  PostgresBookmarkRepository,
  PostgresUserProfileRepository,
  PostgresFeedbackRepository,
} from "@onthilab/database";
import { OpenAiCompatibleVisionProvider } from "@onthilab/worker";
import { resolve } from "node:path";
import { createApp } from "./app";
import {
  LocalAsyncAnswerSuggestionService,
  SqsAnswerSuggestionService,
} from "./answer-suggestion-service";
import { CognitoIdTokenVerifier } from "./auth";
import { parseEnv, parseCorsOrigins } from "./env";
import { LocalExamImportService, S3ExamImportService } from "./import-service";
import { S3Client } from "@aws-sdk/client-s3";
import {
  LocalQuestionImageReader,
  S3QuestionImageReader,
} from "./question-image-reader";

export function createRuntimeApp(
  environment: Record<string, string | undefined> = process.env,
) {
  // Validate all env vars up-front; throws with a clear message if invalid.
  const env = parseEnv(environment);

  const corsOrigins = parseCorsOrigins(env.CORS_ORIGINS);
  const authDependencies =
    env.COGNITO_USER_POOL_ID && env.COGNITO_CLIENT_ID
      ? {
          auth: new CognitoIdTokenVerifier(
            env.COGNITO_USER_POOL_ID,
            env.COGNITO_CLIENT_ID,
          ),
        }
      : {};

  if (!env.DATABASE_URL) {
    return createApp({ ...authDependencies, corsOrigins });
  }

  const database = createDatabase(env.DATABASE_URL);
  const imageBaseUrl = env.QUESTION_IMAGE_BASE_URL?.replace(/\/$/, "");
  const imageStorageRoot = resolve(
    env.QUESTION_IMAGE_STORAGE_PATH ??
      resolve(process.cwd(), ".local-storage/question-images"),
  );

  const draftRepository = new PostgresDraftImportRepository(database);
  const s3Client = env.QUESTION_IMAGE_BUCKET ? new S3Client({}) : undefined;
  const imageReader = s3Client
    ? new S3QuestionImageReader(s3Client, env.QUESTION_IMAGE_BUCKET!)
    : new LocalQuestionImageReader(imageStorageRoot);

  const providerName =
    env.AI_PROVIDER !== "disabled" ? env.AI_PROVIDER : undefined;

  const suggestions =
    env.FEATURE_AI_IMPORT_ENABLED && providerName && env.AI_SUGGESTION_QUEUE_URL
      ? new SqsAnswerSuggestionService(
          draftRepository,
          env.AI_SUGGESTION_QUEUE_URL,
        )
      : env.FEATURE_AI_IMPORT_ENABLED &&
          providerName &&
          env.AI_API_KEY &&
          env.AI_MODEL
        ? new LocalAsyncAnswerSuggestionService(
            draftRepository,
            imageReader,
            new OpenAiCompatibleVisionProvider({
              apiKey: env.AI_API_KEY,
              model: env.AI_MODEL,
              baseUrl: env.AI_BASE_URL,
              providerName,
              ...(env.APP_ENV === "production"
                ? { timeoutMs: 20_000, maxRetries: 0 }
                : {}),
              reasoningEffort:
                providerName === "groq" && env.AI_MODEL === "qwen/qwen3.6-27b"
                  ? "none"
                  : undefined,
            }),
            Math.min(5, Math.max(1, env.AI_LOCAL_CONCURRENCY)),
          )
        : undefined;

  const catalogRepository = new PostgresCatalogRepository(database, {
    imageUrlForKey: imageBaseUrl
      ? (key) => `${imageBaseUrl}/${key}`
      : undefined,
  });

  return createApp({
    ...authDependencies,
    corsOrigins,
    catalog: catalogRepository,
    adminCatalog: new PostgresAdminCatalogRepository(database),
    profiles: new PostgresUserProfileRepository(database),
    reviews: draftRepository,
    ...(imageBaseUrl ? { questionImageBaseUrl: imageBaseUrl } : {}),
    ...(suggestions ? { suggestions } : {}),
    attempts: new PostgresAttemptRepository(database, {
      imageUrlForKey: imageBaseUrl
        ? (key) => `${imageBaseUrl}/${key}`
        : undefined,
    }),
    reports: new PostgresReportRepository(database, {
      imageUrlForKey: imageBaseUrl
        ? (key) => `${imageBaseUrl}/${key}`
        : undefined,
    }),
    bookmarks: new PostgresBookmarkRepository(database, {
      imageUrlForKey: imageBaseUrl
        ? (key) => `${imageBaseUrl}/${key}`
        : undefined,
    }),
    feedback: new PostgresFeedbackRepository(database),
    imports: s3Client
      ? new S3ExamImportService(
          draftRepository,
          s3Client,
          env.QUESTION_IMAGE_BUCKET!,
        )
      : new LocalExamImportService(draftRepository, imageStorageRoot),
    images: imageReader,
  });
}

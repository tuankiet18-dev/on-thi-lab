import {
  createDatabase,
  PostgresAttemptRepository,
  PostgresCatalogRepository,
  PostgresDraftImportRepository,
  PostgresUserProfileRepository,
} from "@onthilab/database";
import { OpenAiCompatibleVisionProvider } from "@onthilab/worker";
import { resolve } from "node:path";
import { createApp } from "./app";
import {
  LocalAsyncAnswerSuggestionService,
  SqsAnswerSuggestionService,
} from "./answer-suggestion-service";
import { CognitoIdTokenVerifier } from "./auth";
import { LocalExamImportService } from "./import-service";
import { LocalQuestionImageReader } from "./question-image-reader";

export function createRuntimeApp(
  environment: Record<string, string | undefined> = process.env,
) {
  const databaseUrl = environment.DATABASE_URL;
  const userPoolId = environment.COGNITO_USER_POOL_ID;
  const clientId = environment.COGNITO_CLIENT_ID;
  const auth =
    userPoolId && clientId
      ? new CognitoIdTokenVerifier(userPoolId, clientId)
      : undefined;
  const authDependencies = auth ? { auth } : {};
  if (!databaseUrl) return createApp(authDependencies);

  const database = createDatabase(databaseUrl);
  const imageBaseUrl = environment.QUESTION_IMAGE_BASE_URL?.replace(/\/$/, "");
  const imageStorageRoot = resolve(
    environment.QUESTION_IMAGE_STORAGE_PATH ??
      resolve(process.cwd(), ".local-storage/question-images"),
  );

  const draftRepository = new PostgresDraftImportRepository(database);
  const imageReader = new LocalQuestionImageReader(imageStorageRoot);
  const aiEnabled = environment.FEATURE_AI_IMPORT_ENABLED === "true";
  const providerName =
    environment.AI_PROVIDER && environment.AI_PROVIDER !== "disabled"
      ? environment.AI_PROVIDER
      : undefined;
  const queueUrl = environment.AI_SUGGESTION_QUEUE_URL;
  const apiKey = environment.AI_API_KEY;
  const model = environment.AI_MODEL;
  const suggestions =
    aiEnabled && providerName && queueUrl
      ? new SqsAnswerSuggestionService(draftRepository, queueUrl)
      : aiEnabled && providerName && apiKey && model
        ? new LocalAsyncAnswerSuggestionService(
            draftRepository,
            imageReader,
            new OpenAiCompatibleVisionProvider({
              apiKey,
              model,
              baseUrl: environment.AI_BASE_URL,
              providerName,
            }),
            Math.min(
              5,
              Math.max(1, Number(environment.AI_LOCAL_CONCURRENCY) || 2),
            ),
          )
        : undefined;

  return createApp({
    ...authDependencies,
    catalog: new PostgresCatalogRepository(database, {
      imageUrlForKey: imageBaseUrl
        ? (key) => `${imageBaseUrl}/${key}`
        : undefined,
    }),
    profiles: new PostgresUserProfileRepository(database),
    reviews: draftRepository,
    ...(suggestions ? { suggestions } : {}),
    attempts: new PostgresAttemptRepository(database),
    imports: new LocalExamImportService(draftRepository, imageStorageRoot),
    images: imageReader,
  });
}

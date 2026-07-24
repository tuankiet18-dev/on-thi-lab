import {
  createDatabase,
  PostgresCatalogRepository,
  PostgresDraftImportRepository,
  PostgresUserProfileRepository,
} from "@onthilab/database";
import { resolve } from "node:path";
import { createApp } from "./app";
import { CognitoIdTokenVerifier } from "./auth";
import { LocalExamImportService } from "./import-service";

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

  return createApp({
    ...authDependencies,
    catalog: new PostgresCatalogRepository(database, {
      imageUrlForKey: imageBaseUrl
        ? (key) => `${imageBaseUrl}/${key}`
        : undefined,
    }),
    profiles: new PostgresUserProfileRepository(database),
    imports: new LocalExamImportService(
      new PostgresDraftImportRepository(database),
      imageStorageRoot,
    ),
  });
}

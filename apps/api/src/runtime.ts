import {
  createDatabase,
  PostgresCatalogRepository,
  PostgresUserProfileRepository,
} from "@onthilab/database";
import { createApp } from "./app";
import { CognitoIdTokenVerifier } from "./auth";

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

  return createApp({
    ...authDependencies,
    catalog: new PostgresCatalogRepository(database, {
      imageUrlForKey: imageBaseUrl
        ? (key) => `${imageBaseUrl}/${key}`
        : undefined,
    }),
    profiles: new PostgresUserProfileRepository(database),
  });
}

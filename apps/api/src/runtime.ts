import { createDatabase, PostgresCatalogRepository } from "@onthilab/database";
import { createApp } from "./app";

export function createRuntimeApp(
  environment: Record<string, string | undefined> = process.env,
) {
  const databaseUrl = environment.DATABASE_URL;
  if (!databaseUrl) return createApp();

  const database = createDatabase(databaseUrl);
  const imageBaseUrl = environment.QUESTION_IMAGE_BASE_URL?.replace(/\/$/, "");

  return createApp({
    catalog: new PostgresCatalogRepository(database, {
      imageUrlForKey: imageBaseUrl
        ? (key) => `${imageBaseUrl}/${key}`
        : undefined,
    }),
  });
}

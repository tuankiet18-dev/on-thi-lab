import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import {
  buildPostgresClientOptions,
  type DatabaseConnectionOptions,
} from "./connection-config";

function createPostgresClient(
  connectionString: string,
  options: DatabaseConnectionOptions = {},
) {
  return postgres(
    connectionString,
    buildPostgresClientOptions(connectionString, options),
  );
}

export function createDatabase(
  connectionString: string,
  options: DatabaseConnectionOptions = {},
) {
  const client = createPostgresClient(connectionString, options);
  return drizzle(client, { schema });
}

export type OnThiLabDatabase = ReturnType<typeof createDatabase>;

export function createDatabaseConnection(
  connectionString: string,
  options: DatabaseConnectionOptions = {},
) {
  const client = createPostgresClient(connectionString, options);

  return {
    db: drizzle(client, { schema }),
    close: () => client.end(),
  };
}

export * from "./schema";
export * from "./connection-config";
export * from "./attempt-repository";
export * from "./catalog-repository";
export * from "./admin-catalog-repository";
export * from "./draft-import-repository";
export * from "./user-profile-repository";
export * from "./report-repository";
export * from "./bookmark-repository";
export * from "./feedback-repository";
export * from "./ocr-repository";
export * from "./admin-attention-repository";

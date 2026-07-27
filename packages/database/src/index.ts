import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function createPostgresClient(connectionString: string) {
  let requiresTls = false;
  try {
    requiresTls = new URL(connectionString).hostname.endsWith(".supabase.com");
  } catch {
    // The postgres client will raise the configuration error with its own
    // validation when it is instantiated.
  }

  return postgres(connectionString, {
    prepare: false,
    ...(requiresTls ? { ssl: "require" as const } : {}),
  });
}

export function createDatabase(connectionString: string) {
  const client = createPostgresClient(connectionString);
  return drizzle(client, { schema });
}

export type OnThiLabDatabase = ReturnType<typeof createDatabase>;

export function createDatabaseConnection(connectionString: string) {
  const client = createPostgresClient(connectionString);

  return {
    db: drizzle(client, { schema }),
    close: () => client.end(),
  };
}

export * from "./schema";
export * from "./attempt-repository";
export * from "./catalog-repository";
export * from "./admin-catalog-repository";
export * from "./draft-import-repository";
export * from "./user-profile-repository";
export * from "./report-repository";
export * from "./bookmark-repository";

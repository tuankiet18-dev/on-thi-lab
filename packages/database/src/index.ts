import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export function createDatabase(connectionString: string) {
  const client = postgres(connectionString, { prepare: false });
  return drizzle(client, { schema });
}

export type OnThiLabDatabase = ReturnType<typeof createDatabase>;

export function createDatabaseConnection(connectionString: string) {
  const client = postgres(connectionString, { prepare: false });

  return {
    db: drizzle(client, { schema }),
    close: () => client.end(),
  };
}

export * from "./schema";
export * from "./catalog-repository";

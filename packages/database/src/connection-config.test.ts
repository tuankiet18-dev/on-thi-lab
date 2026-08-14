import { describe, expect, it } from "vitest";
import {
  buildPostgresClientOptions,
  isSupabaseTransactionPoolerUrl,
} from "./connection-config";

describe("database connection configuration", () => {
  it("uses a single short-lived connection by default", () => {
    expect(
      buildPostgresClientOptions(
        "postgresql://postgres.example:secret@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres",
      ),
    ).toMatchObject({
      prepare: false,
      max: 1,
      connect_timeout: 10,
      idle_timeout: 20,
      max_lifetime: 600,
      ssl: "require",
    });
  });

  it("allows bounded overrides for non-Lambda tools", () => {
    expect(
      buildPostgresClientOptions("postgresql://localhost:5432/onthilab", {
        maxConnections: 4,
        idleTimeoutSeconds: 30,
      }),
    ).toMatchObject({ max: 4, idle_timeout: 30 });
  });

  it("recognizes only the Supabase transaction pooler endpoint", () => {
    expect(
      isSupabaseTransactionPoolerUrl(
        "postgresql://user:secret@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres",
      ),
    ).toBe(true);
    expect(
      isSupabaseTransactionPoolerUrl(
        "postgresql://user:secret@db.example.supabase.com:5432/postgres",
      ),
    ).toBe(false);
  });
});

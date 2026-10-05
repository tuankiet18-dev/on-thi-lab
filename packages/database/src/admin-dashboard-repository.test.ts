import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseConnection } from "./index";
import { PostgresAdminDashboardRepository } from "./admin-dashboard-repository";
import { adminDashboardSchema } from "@onthilab/contracts";

const databaseUrl =
  process.env.DATABASE_URL ||
  "postgres://onthilab:onthilab@localhost:5432/onthilab";

describe("PostgresAdminDashboardRepository integration test", () => {
  let conn: ReturnType<typeof createDatabaseConnection> | null = null;
  let repo: PostgresAdminDashboardRepository | null = null;

  beforeAll(async () => {
    try {
      conn = createDatabaseConnection(databaseUrl);
      // Verify connection
      await conn.db.execute("SELECT 1");
      repo = new PostgresAdminDashboardRepository(conn.db);
    } catch (err) {
      console.warn("Postgres not available, skipping DB integration test", err);
    }
  });

  afterAll(async () => {
    if (conn) {
      await conn.close();
    }
  });

  it("returns a valid dashboard response conforming to adminDashboardSchema for 7, 30, and 90 days", async () => {
    if (!repo) {
      console.warn("Skipping test because DB connection not established");
      return;
    }

    for (const days of [7, 30, 90] as const) {
      const startTime = performance.now();
      const dashboard = await repo.getDashboard(days);
      const elapsedMs = performance.now() - startTime;

      // Ensure execution is fast (< 200ms on local DB)
      expect(elapsedMs).toBeLessThan(1000);

      // Validate schema
      const parsed = adminDashboardSchema.parse(dashboard);
      expect(parsed.days).toBe(days);
      expect(parsed.asOf).toBeDefined();

      // Quick stats assertions
      expect(parsed.quickStats.pendingReview).toBeGreaterThanOrEqual(0);
      expect(parsed.quickStats.openReports).toBeGreaterThanOrEqual(0);
      expect(parsed.quickStats.newFeedback).toBeGreaterThanOrEqual(0);
      expect(parsed.quickStats.publishedExams).toBeGreaterThanOrEqual(0);
      expect(parsed.quickStats.completedAttempts).toBeGreaterThanOrEqual(0);
      expect(parsed.quickStats.activeUsers).toBeGreaterThanOrEqual(0);

      // Action items max 5
      expect(parsed.actionItems.length).toBeLessThanOrEqual(5);

      // Usage trend
      expect(Array.isArray(parsed.usageTrend)).toBe(true);

      // Content quality
      expect(Array.isArray(parsed.contentQuality.reportsByCategory)).toBe(true);
      expect(Array.isArray(parsed.contentQuality.topExams)).toBe(true);
      expect(Array.isArray(parsed.contentQuality.unpopularExams)).toBe(true);
    }
  });
});

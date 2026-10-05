import { describe, expect, it, vi } from "vitest";
import { getAdminDashboard } from "./api";

describe("admin dashboard API client", () => {
  it("fetches admin dashboard with specified days and validates response", async () => {
    const mockData = {
      asOf: "2026-10-05T09:00:00.000Z",
      days: 7,
      quickStats: {
        pendingReview: 1,
        openReports: 2,
        newFeedback: 0,
        publishedExams: 15,
        completedAttempts: 50,
        activeUsers: 25,
      },
      actionItems: [
        {
          type: "pending_publish",
          examId: "10000000-0000-4000-8000-000000000001",
          examCode: "PRO192_FA24",
          detail: "Đề PRO192_FA24 đang chờ xuất bản",
        },
      ],
      usageTrend: [
        {
          date: "2026-10-04",
          started: 10,
          completed: 8,
          newUsers: 3,
        },
      ],
      contentQuality: {
        reportsByCategory: [{ category: "typo", count: 2 }],
        topExams: [
          {
            examId: "10000000-0000-4000-8000-000000000001",
            examCode: "PRO192_FA24",
            attempts: 30,
          },
        ],
        unpopularExams: [],
      },
    };

    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ data: mockData }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await getAdminDashboard("test-token", 7, fetcher);

    expect(result).toEqual(mockData);
    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:8787/v1/admin/dashboard?days=7",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
      }),
    );
  });
});

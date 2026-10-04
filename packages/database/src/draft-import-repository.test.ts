import { describe, expect, it } from "vitest";
import {
  AI_SUGGESTION_STALE_MS,
  PostgresDraftImportRepository,
  buildExamCode,
  isAiSuggestionInFlight,
  isUniqueViolation,
  trustedCommunitySuggestion,
} from "./draft-import-repository";
import type { OnThiLabDatabase } from "./index";

describe("buildExamCode", () => {
  it("builds the agreed FE identifiers", () => {
    expect(
      buildExamCode({
        courseCode: "swd392",
        semester: "sp26",
        examType: "FE",
        isRetake: false,
      }),
    ).toBe("SWD392-SP26-FE");

    expect(
      buildExamCode({
        courseCode: "swd392",
        semester: "sp26",
        examType: "FE",
        isRetake: true,
      }),
    ).toBe("SWD392-SP26-FE-RETAKE");
  });
});

describe("isUniqueViolation", () => {
  it("recognises PostgreSQL errors wrapped by Drizzle", () => {
    expect(
      isUniqueViolation({
        name: "DrizzleQueryError",
        cause: { code: "23505" },
      }),
    ).toBe(true);
    expect(isUniqueViolation({ cause: { code: "23503" } })).toBe(false);
  });
});

describe("trustedCommunitySuggestion", () => {
  it("accepts unambiguous community answers without relying on OCR", () => {
    expect(
      trustedCommunitySuggestion({
        status: "suggested",
        provider: "community-comments",
        proposedType: "multiple",
        optionCount: 6,
        optionCountConfidence: 0.96,
        optionCountSource: "ocr",
        proposedAnswers: [4, 1],
        confidence: 0.9,
        validVotes: 1,
        voteBreakdown: { be: 1 },
        requiresReview: false,
        updatedAt: "2026-07-29T00:00:00.000Z",
      }),
    ).toEqual({
      type: "multiple",
      optionCount: 6,
      correctOptions: [1, 4],
    });
  });

  it("keeps AI, disputed and malformed suggestions for manual review", () => {
    const base = {
      status: "suggested" as const,
      provider: "community-comments",
      proposedType: "single" as const,
      optionCount: 4,
      optionCountConfidence: 0.96,
      optionCountSource: "ocr",
      proposedAnswers: [1],
      confidence: 0.9,
      validVotes: 1,
      voteBreakdown: { b: 1 },
      requiresReview: false,
      updatedAt: "2026-07-29T00:00:00.000Z",
    };
    expect(
      trustedCommunitySuggestion({ ...base, provider: "groq" }),
    ).toBeNull();
    expect(
      trustedCommunitySuggestion({ ...base, requiresReview: true }),
    ).toEqual({
      type: "single",
      optionCount: 4,
      correctOptions: [1],
    });
    expect(
      trustedCommunitySuggestion({ ...base, optionCountConfidence: undefined }),
    ).not.toBeNull();
    expect(
      trustedCommunitySuggestion({ ...base, optionCountConfidence: 0.6 }),
    ).not.toBeNull();
    expect(
      trustedCommunitySuggestion({ ...base, voteBreakdown: { a: 1, b: 1 } }),
    ).toBeNull();
    expect(
      trustedCommunitySuggestion({ ...base, proposedAnswers: [4] }),
    ).toBeNull();
  });
});

describe("isAiSuggestionInFlight", () => {
  const now = new Date("2026-10-06T12:00:00.000Z");
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

  it("blocks a fresh queued or processing request", () => {
    for (const status of ["queued", "processing"]) {
      expect(
        isAiSuggestionInFlight({ status, updatedAt: ago(1_000) }, now),
      ).toBe(true);
    }
  });

  it("allows a retry once the request is older than the Lambda lifetime", () => {
    expect(
      isAiSuggestionInFlight(
        { status: "processing", updatedAt: ago(AI_SUGGESTION_STALE_MS) },
        now,
      ),
    ).toBe(false);
    expect(AI_SUGGESTION_STALE_MS).toBeGreaterThan(29_000);
  });

  it("does not treat finished or missing state as in flight", () => {
    for (const status of ["suggested", "confirmed", "failed"]) {
      expect(
        isAiSuggestionInFlight({ status, updatedAt: ago(1_000) }, now),
      ).toBe(false);
    }
    expect(isAiSuggestionInFlight(null, now)).toBe(false);
    expect(isAiSuggestionInFlight(undefined, now)).toBe(false);
  });

  it("treats an unreadable timestamp as abandoned", () => {
    expect(isAiSuggestionInFlight({ status: "queued" }, now)).toBe(false);
  });
});

describe("saveSuggestion", () => {
  it("stores the proposal without changing the question's options or type", async () => {
    let updated: Record<string, unknown> | undefined;
    const db = {
      update: () => ({
        set: (values: Record<string, unknown>) => {
          updated = values;
          return { where: async () => undefined };
        },
      }),
    } as unknown as OnThiLabDatabase;

    await new PostgresDraftImportRepository(db).saveSuggestion("question-id", {
      proposedType: "multiple",
      optionCount: 5,
      proposedAnswers: [1, 3],
      confidence: 0.9,
      provider: "groq",
      model: "qwen",
    });

    expect(updated).toBeDefined();
    expect(updated).not.toHaveProperty("options");
    expect(updated).not.toHaveProperty("type");
    expect(updated).not.toHaveProperty("correctOptions");
    expect(updated?.aiMetadata).toMatchObject({
      status: "suggested",
      proposedType: "multiple",
      optionCount: 5,
      proposedAnswers: [1, 3],
    });
  });
});

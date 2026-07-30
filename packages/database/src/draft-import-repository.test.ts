import { describe, expect, it } from "vitest";
import {
  buildExamCode,
  isUniqueViolation,
  trustedCommunitySuggestion,
} from "./draft-import-repository";

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
  it("accepts only unambiguous community answers with a trusted option count", () => {
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
      requiresReview: false,
      updatedAt: "2026-07-29T00:00:00.000Z",
    };
    expect(
      trustedCommunitySuggestion({ ...base, provider: "groq" }),
    ).toBeNull();
    expect(
      trustedCommunitySuggestion({ ...base, requiresReview: true }),
    ).toBeNull();
    expect(
      trustedCommunitySuggestion({
        ...base,
        optionCountConfidence: undefined,
      }),
    ).toBeNull();
    expect(
      trustedCommunitySuggestion({ ...base, optionCountConfidence: 0.6 }),
    ).toBeNull();
    expect(
      trustedCommunitySuggestion({ ...base, proposedAnswers: [4] }),
    ).toBeNull();
  });
});

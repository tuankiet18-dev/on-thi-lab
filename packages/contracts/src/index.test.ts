import { describe, expect, it } from "vitest";
import {
  calculateScore,
  aiAnswerSuggestionSchema,
  createDraftImportSchema,
  isExactAnswer,
  publishExamResultSchema,
  updateCourseSchema,
  updateQuestionAnswerSchema,
  upsertStudentProfileSchema,
} from "./index";

describe("exact-match scoring", () => {
  it("ignores selection order but requires the complete answer", () => {
    expect(isExactAnswer([2, 0], [0, 2])).toBe(true);
    expect(isExactAnswer([0], [0, 2])).toBe(false);
    expect(isExactAnswer([0, 1, 2], [0, 2])).toBe(false);
  });

  it("returns a score on the 10-point scale", () => {
    expect(
      calculateScore(
        { q1: [1], q2: [0], q3: [2, 0] },
        { q1: [1], q2: [2], q3: [0, 2] },
      ),
    ).toEqual({ correctCount: 2, questionCount: 3, score: 6.67 });
  });
});

describe("student profile input", () => {
  it("trims profile fields and normalizes the student code", () => {
    expect(
      upsertStudentProfileSchema.parse({
        fullName: "  Lương Tuấn Kiệt  ",
        studentCode: "he170001",
        campusCode: "HL",
        majorCode: "SE",
      }),
    ).toEqual({
      fullName: "Lương Tuấn Kiệt",
      studentCode: "HE170001",
      campusCode: "HL",
      majorCode: "SE",
    });
  });

  it("accepts an onboarding profile without a student code", () => {
    expect(
      upsertStudentProfileSchema.parse({
        fullName: "Lương Tuấn Kiệt",
        campusCode: "HL",
        majorCode: "SE",
      }),
    ).toEqual({
      fullName: "Lương Tuấn Kiệt",
      campusCode: "HL",
      majorCode: "SE",
    });
  });
});

describe("draft import input", () => {
  it("normalizes identifiers and rejects unsupported exam types", () => {
    expect(
      createDraftImportSchema.parse({
        courseCode: "swd392",
        semester: "sp26",
        campusCode: "hl",
        examType: "FE",
        isRetake: false,
        durationMinutes: 60,
      }),
    ).toMatchObject({
      courseCode: "SWD392",
      semester: "SP26",
      campusCode: "HL",
    });

    expect(() =>
      createDraftImportSchema.parse({
        courseCode: "SWD392",
        semester: "SP26",
        campusCode: "HL",
        examType: "PE",
        isRetake: false,
        durationMinutes: 60,
      }),
    ).toThrow();
  });
});

describe("course update input", () => {
  it("only changes fields exposed by the catalog edit UI", () => {
    expect(
      updateCourseSchema.parse({
        code: "csd201",
        name: "  Data Structures and Algorithms  ",
        examFormatStatus: "requires_review",
      }),
    ).toEqual({
      code: "CSD201",
      name: "Data Structures and Algorithms",
      examFormatStatus: "requires_review",
    });
  });
});

describe("answer review input", () => {
  it("enforces exact single and valid multiple answer selections", () => {
    expect(
      updateQuestionAnswerSchema.parse({
        type: "multiple",
        optionCount: 4,
        correctOptions: [0, 2],
      }),
    ).toEqual({
      type: "multiple",
      optionCount: 4,
      correctOptions: [0, 2],
    });

    expect(() =>
      updateQuestionAnswerSchema.parse({
        type: "single",
        optionCount: 4,
        correctOptions: [0, 2],
      }),
    ).toThrow();
    expect(() =>
      updateQuestionAnswerSchema.parse({
        type: "multiple",
        optionCount: 4,
        correctOptions: [4],
      }),
    ).toThrow();
  });

  it("requires complete answer data for a finished AI suggestion", () => {
    expect(
      aiAnswerSuggestionSchema.parse({
        status: "suggested",
        proposedType: "single",
        optionCount: 4,
        proposedAnswers: [1],
        confidence: 0.82,
        provider: "test",
        model: "vision-test",
        updatedAt: "2026-07-24T06:00:00.000Z",
      }),
    ).toMatchObject({ status: "suggested", proposedAnswers: [1] });

    expect(() =>
      aiAnswerSuggestionSchema.parse({
        status: "suggested",
        updatedAt: "2026-07-24T06:00:00.000Z",
      }),
    ).toThrow();
  });

  it("exposes aggregate community evidence without raw comments", () => {
    const suggestion = aiAnswerSuggestionSchema.parse({
      status: "suggested",
      proposedType: "multiple",
      optionCount: 4,
      proposedAnswers: [0, 1],
      confidence: 0.8,
      provider: "community-comments",
      model: "exact-consensus-v1",
      validVotes: 8,
      totalComments: 10,
      voteBreakdown: { ab: 8, c: 2 },
      requiresReview: false,
      updatedAt: "2026-07-24T06:00:00.000Z",
      raw: { author: "must-not-be-exposed" },
    });

    expect(suggestion).toMatchObject({ validVotes: 8, totalComments: 10 });
    expect(suggestion).not.toHaveProperty("raw");
  });

  it("accepts a timestamped published result", () => {
    expect(
      publishExamResultSchema.parse({
        examId: "10000000-0000-4000-8000-000000000001",
        revisionId: "20000000-0000-4000-8000-000000000002",
        status: "published",
        publishedAt: "2026-07-24T06:00:00.000Z",
      }),
    ).toMatchObject({ status: "published" });
  });
});

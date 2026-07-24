import { describe, expect, it } from "vitest";
import {
  calculateScore,
  createDraftImportSchema,
  isExactAnswer,
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

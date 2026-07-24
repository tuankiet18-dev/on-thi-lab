import { describe, expect, it } from "vitest";
import { buildExamCode, isUniqueViolation } from "./draft-import-repository";

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

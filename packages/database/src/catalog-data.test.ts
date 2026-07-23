import { describe, expect, it } from "vitest";
import { priorityCourses } from "./catalog-data";

describe("priority course catalog", () => {
  it("contains all 41 supplied courses exactly once", () => {
    expect(priorityCourses).toHaveLength(41);
    expect(new Set(priorityCourses.map((course) => course.code)).size).toBe(41);
  });

  it("covers all nine academic terms", () => {
    expect(
      [...new Set(priorityCourses.map((course) => course.termNumber))].sort(),
    ).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("keeps practical or project-heavy courses behind format review", () => {
    const reviewCodes = priorityCourses
      .filter((course) => course.examFormatStatus === "requires_review")
      .map((course) => course.code);

    expect(reviewCodes).toContain("LAB211");
    expect(reviewCodes).toContain("SWP391");
    expect(reviewCodes).toContain("OJT202");
  });
});

import { describe, expect, it } from "vitest";
import type { ExamSummary } from "@onthilab/contracts";
import { popularCourseCodes, searchCourses } from "./catalog-search";

const exams: ExamSummary[] = [
  {
    id: "swd-hcm-new",
    code: "SWD392-SP26-FE",
    courseCode: "SWD392",
    courseName: "Software Architecture and Design",
    semester: "SP26",
    campus: "Hồ Chí Minh",
    examType: "FE",
    isRetake: false,
    durationMinutes: 60,
    questionCount: 60,
    publishedAt: "2026-04-10T00:00:00.000Z",
    answerConfidence: "reviewed",
  },
  {
    id: "swd-hl-old",
    code: "SWD392-SU25-FE",
    courseCode: "SWD392",
    courseName: "Software Architecture and Design",
    semester: "SU25",
    campus: "Hòa Lạc",
    examType: "FE",
    isRetake: false,
    durationMinutes: 60,
    questionCount: 60,
    publishedAt: "2025-08-10T00:00:00.000Z",
    answerConfidence: "reviewed",
  },
  {
    id: "swd-hl-retake",
    code: "SWD392-SU25-FE-RETAKE",
    courseCode: "SWD392",
    courseName: "Software Architecture and Design",
    semester: "SU25",
    campus: "Hòa Lạc",
    examType: "FE",
    isRetake: true,
    durationMinutes: 60,
    questionCount: 60,
    publishedAt: "2025-08-10T00:00:00.000Z",
    answerConfidence: "reviewed",
  },
  {
    id: "prf",
    code: "PRF192-SP26-FE",
    courseCode: "PRF192",
    courseName: "Programming Fundamentals",
    semester: "SP26",
    campus: "Hòa Lạc",
    examType: "FE",
    isRetake: false,
    durationMinutes: 60,
    questionCount: 60,
    publishedAt: "2026-02-10T00:00:00.000Z",
    answerConfidence: "reviewed",
  },
];

describe("searchCourses", () => {
  it("finds a course by its short code and groups all of its exams", () => {
    const results = searchCourses(exams, "swd", "Hòa Lạc");

    expect(results).toHaveLength(1);
    expect(results[0]?.courseCode).toBe("SWD392");
    expect(results[0]?.exams.map((exam) => exam.id)).toEqual([
      "swd-hl-old",
      "swd-hl-retake",
      "swd-hcm-new",
    ]);
  });

  it("finds a course by a Vietnamese-insensitive name", () => {
    expect(searchCourses(exams, "architecture")[0]?.courseCode).toBe("SWD392");
  });

  it("returns the most represented courses as quick search suggestions", () => {
    expect(popularCourseCodes(exams)).toEqual(["SWD392", "PRF192"]);
  });
});

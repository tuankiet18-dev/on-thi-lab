import type { ExamSummary } from "@onthilab/contracts";

export interface CourseSearchResult {
  courseCode: string;
  courseName: string;
  exams: ExamSummary[];
}

export type CatalogSort = "newest" | "oldest";

export interface CatalogExamFilters {
  query?: string;
  campus?: string;
  semester?: string;
  examType?: ExamSummary["examType"];
  sort?: CatalogSort;
}

function normalized(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLocaleLowerCase("vi-VN")
    .trim();
}

/**
 * Applies the filters supported by the catalog API response. Keeping this
 * client-side lets the page move to server-side filtering later without
 * changing its UI contract.
 */
export function filterCatalogExams(
  exams: ExamSummary[],
  filters: CatalogExamFilters,
): ExamSummary[] {
  const keyword = normalized(filters.query ?? "");
  const direction = filters.sort === "oldest" ? 1 : -1;

  return exams
    .filter((exam) => {
      const searchText = normalized(
        `${exam.courseCode} ${exam.courseName} ${exam.code}`,
      );
      return (
        (!keyword || searchText.includes(keyword)) &&
        (!filters.campus || exam.campus === filters.campus) &&
        (!filters.semester || exam.semester === filters.semester) &&
        (!filters.examType || exam.examType === filters.examType)
      );
    })
    .sort((left, right) => {
      const publishedDifference =
        new Date(left.publishedAt).getTime() -
        new Date(right.publishedAt).getTime();
      if (publishedDifference) return publishedDifference * direction;
      if (left.isRetake !== right.isRetake) return left.isRetake ? 1 : -1;
      return left.code.localeCompare(right.code, "vi-VN") * direction;
    });
}

function sortExams(exams: ExamSummary[], campusName?: string): ExamSummary[] {
  return [...exams].sort((left, right) => {
    const campusRank = (exam: ExamSummary) =>
      campusName && exam.campus === campusName ? 0 : 1;
    const campusDifference = campusRank(left) - campusRank(right);
    if (campusDifference) return campusDifference;

    const publishedDifference =
      new Date(right.publishedAt).getTime() -
      new Date(left.publishedAt).getTime();
    if (publishedDifference) return publishedDifference;

    if (left.isRetake !== right.isRetake) return left.isRetake ? 1 : -1;
    return right.code.localeCompare(left.code, "vi-VN");
  });
}

export function searchCourses(
  exams: ExamSummary[],
  query: string,
  campusName?: string,
): CourseSearchResult[] {
  const keyword = normalized(query);
  const grouped = new Map<string, ExamSummary[]>();

  for (const exam of exams) {
    const searchText = normalized(
      `${exam.courseCode} ${exam.courseName} ${exam.code}`,
    );
    if (keyword && !searchText.includes(keyword)) continue;

    const key = `${exam.courseCode}\u0000${exam.courseName}`;
    grouped.set(key, [...(grouped.get(key) ?? []), exam]);
  }

  return [...grouped.values()]
    .map((courseExams) => ({
      courseCode: courseExams[0]!.courseCode,
      courseName: courseExams[0]!.courseName,
      exams: sortExams(courseExams, campusName),
    }))
    .sort((left, right) => {
      const leftCode = normalized(left.courseCode);
      const rightCode = normalized(right.courseCode);
      const leftExact = keyword === leftCode ? 0 : 1;
      const rightExact = keyword === rightCode ? 0 : 1;
      if (leftExact !== rightExact) return leftExact - rightExact;

      const leftStarts = leftCode.startsWith(keyword) ? 0 : 1;
      const rightStarts = rightCode.startsWith(keyword) ? 0 : 1;
      if (leftStarts !== rightStarts) return leftStarts - rightStarts;

      const leftNewest = left.exams[0]?.publishedAt ?? "";
      const rightNewest = right.exams[0]?.publishedAt ?? "";
      return rightNewest.localeCompare(leftNewest);
    });
}

export function popularCourseCodes(exams: ExamSummary[], limit = 5): string[] {
  return searchCourses(exams, "")
    .sort((left, right) => {
      if (left.exams.length !== right.exams.length) {
        return right.exams.length - left.exams.length;
      }
      return (right.exams[0]?.publishedAt ?? "").localeCompare(
        left.exams[0]?.publishedAt ?? "",
      );
    })
    .slice(0, limit)
    .map((course) => course.courseCode);
}

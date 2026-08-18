import { describe, expect, it } from "vitest";
import { inferImportMetadataFromFileName } from "./model";

describe("inferImportMetadataFromFileName", () => {
  const sampleCourses = [
    { code: "FER202", name: "Front-End Web Development with React" },
    { code: "SWE201c", name: "Introduction to Software Engineering" },
    { code: "PRO192", name: "Object-Oriented Programming" },
    { code: "SSG104", name: "Communication and In-Group Skills" },
  ];

  const sampleCampuses = [
    { code: "HL", name: "Hòa Lạc" },
    { code: "HCM", name: "Hồ Chí Minh" },
    { code: "DN", name: "Đà Nẵng" },
  ];

  it("detects course, semester, default campus HCM and default 60min for regular FE exam", () => {
    const meta = inferImportMetadataFromFileName(
      "fer202-sp26-fe_cropped.zip",
      sampleCourses,
      sampleCampuses,
    );

    expect(meta.courseCode).toBe("FER202");
    expect(meta.semester).toBe("SP26");
    expect(meta.campusCode).toBe("HCM");
    expect(meta.durationMinutes).toBe(60);
    expect(meta.examType).toBe("FE");
    expect(meta.isRetake).toBe(false);
  });

  it("detects retake exams from filename with -re suffix", () => {
    const meta = inferImportMetadataFromFileName(
      "swe201c-sp26-re.zip",
      sampleCourses,
      sampleCampuses,
    );

    expect(meta.courseCode).toBe("SWE201c");
    expect(meta.semester).toBe("SP26");
    expect(meta.campusCode).toBe("HCM");
    expect(meta.durationMinutes).toBe(60);
    expect(meta.isRetake).toBe(true);
  });

  it("detects block exams like pro192-sp26-b5fe.zip", () => {
    const meta = inferImportMetadataFromFileName(
      "pro192-sp26-b5fe.zip",
      sampleCourses,
      sampleCampuses,
    );

    expect(meta.courseCode).toBe("PRO192");
    expect(meta.semester).toBe("SP26");
    expect(meta.campusCode).toBe("HCM");
    expect(meta.durationMinutes).toBe(60);
    expect(meta.isRetake).toBe(false);
  });

  it("detects explicit campus if specified in filename", () => {
    const meta = inferImportMetadataFromFileName(
      "ssg104-sp26-hl-fe.zip",
      sampleCourses,
      sampleCampuses,
    );

    expect(meta.courseCode).toBe("SSG104");
    expect(meta.semester).toBe("SP26");
    expect(meta.campusCode).toBe("HL");
  });
});

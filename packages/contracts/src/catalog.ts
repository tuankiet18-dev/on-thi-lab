import { z } from "zod";

export const profileOptionSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
});

export const campusSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
});

export const majorSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
});

export const curriculumSchema = z.object({
  id: z.string().uuid(),
  majorId: z.string().uuid(),
  code: z.string(),
  name: z.string(),
});

export const termCourseSchema = z.object({
  courseId: z.string().uuid(),
  courseCode: z.string(),
  courseName: z.string(),
  termNumber: z.number().int(),
  isElective: z.boolean(),
  examFormatStatus: z.enum(["fe_candidate", "requires_review", "not_fe"]),
});

export const examFormatStatuses = [
  "fe_candidate",
  "requires_review",
  "not_fe",
] as const;

export const adminCurriculumSchema = curriculumSchema.extend({
  majorCode: z.string(),
  majorName: z.string(),
  courseCount: z.number().int().nonnegative(),
});

export const adminCoursePlacementSchema = z.object({
  curriculumId: z.string().uuid(),
  curriculumCode: z.string(),
  curriculumName: z.string(),
  majorCode: z.string(),
  majorName: z.string(),
  termNumber: z.number().int().positive(),
  isElective: z.boolean(),
});

export const adminCourseSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  priorityWave: z.number().int(),
  examFormatStatus: z.enum(examFormatStatuses),
  placements: z.array(adminCoursePlacementSchema),
});

export const adminCatalogSchema = z.object({
  majors: z.array(majorSchema),
  curricula: z.array(adminCurriculumSchema),
  courses: z.array(adminCourseSchema),
});

export const createMajorSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{2,30}$/),
  name: z.string().trim().min(2).max(160),
});

export const createCurriculumSchema = z.object({
  majorId: z.string().uuid(),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{2,50}$/),
  name: z.string().trim().min(2).max(200),
  effectiveFrom: z.string().trim().max(30).optional(),
  effectiveTo: z.string().trim().max(30).optional(),
});

export const createCourseSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{3,12}$/),
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(1_000).optional(),
  priorityWave: z.number().int().min(1).max(9).default(4),
  examFormatStatus: z.enum(examFormatStatuses).default("fe_candidate"),
});

export const updateCourseSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{3,12}$/),
  name: z.string().trim().min(2).max(200),
  examFormatStatus: z.enum(examFormatStatuses).default("fe_candidate"),
});

export const upsertCurriculumCourseSchema = z.object({
  curriculumId: z.string().uuid(),
  courseId: z.string().uuid(),
  termNumber: z.number().int().min(1).max(20),
  isElective: z.boolean().default(false),
});

export type ProfileOption = z.infer<typeof profileOptionSchema>;
export type Campus = z.infer<typeof campusSchema>;
export type Major = z.infer<typeof majorSchema>;
export type Curriculum = z.infer<typeof curriculumSchema>;
export type TermCourse = z.infer<typeof termCourseSchema>;
export type ExamFormatStatus = (typeof examFormatStatuses)[number];
export type AdminCurriculum = z.infer<typeof adminCurriculumSchema>;
export type AdminCoursePlacement = z.infer<typeof adminCoursePlacementSchema>;
export type AdminCourse = z.infer<typeof adminCourseSchema>;
export type AdminCatalog = z.infer<typeof adminCatalogSchema>;
export type CreateMajorInput = z.infer<typeof createMajorSchema>;
export type CreateCurriculumInput = z.infer<typeof createCurriculumSchema>;
export type CreateCourseInput = z.infer<typeof createCourseSchema>;
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;
export type UpsertCurriculumCourseInput = z.infer<
  typeof upsertCurriculumCourseSchema
>;

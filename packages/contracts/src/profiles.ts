import { z } from "zod";
import { curriculumSchema, profileOptionSchema } from "./catalog";
import { userRoles } from "./common";

export const studentProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string().min(1),
  studentCode: z.string().min(4).nullable(),
  campus: profileOptionSchema,
  major: profileOptionSchema.nullable(),
  curriculum: curriculumSchema.nullable(),
  role: z.enum(userRoles),
});

export const profileOptionsSchema = z.object({
  campuses: z.array(profileOptionSchema),
  majors: z.array(profileOptionSchema),
  curricula: z.array(curriculumSchema),
});

export const upsertStudentProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  studentCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{4,20}$/)
    .optional(),
  campusCode: z.string().trim().min(1).max(20),
  majorCode: z.string().trim().min(1).max(30).optional(),
  curriculumId: z.string().uuid().optional(),
});

export type StudentProfile = z.infer<typeof studentProfileSchema>;
export type ProfileOptions = z.infer<typeof profileOptionsSchema>;
export type UpsertStudentProfileInput = z.infer<
  typeof upsertStudentProfileSchema
>;

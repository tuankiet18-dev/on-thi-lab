CREATE TYPE "public"."exam_format_status" AS ENUM('fe_candidate', 'requires_review', 'not_fe');--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "priority_wave" integer DEFAULT 4 NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "exam_format_status" "exam_format_status" DEFAULT 'fe_candidate' NOT NULL;
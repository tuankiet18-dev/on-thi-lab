CREATE TYPE "public"."presentation_mode" AS ENUM('image', 'text');--> statement-breakpoint
ALTER TABLE "exam_revisions" ADD COLUMN "presentation_mode" "presentation_mode" DEFAULT 'image' NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "ocr_metadata" jsonb;
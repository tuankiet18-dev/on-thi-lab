DROP INDEX "questions_revision_hash_idx";--> statement-breakpoint
CREATE INDEX "questions_revision_hash_idx" ON "questions" USING btree ("revision_id","image_hash");
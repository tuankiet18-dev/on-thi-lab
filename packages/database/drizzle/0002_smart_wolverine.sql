CREATE TABLE "question_answer_audits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"changed_by" uuid NOT NULL,
	"previous_type" "question_type" NOT NULL,
	"next_type" "question_type" NOT NULL,
	"previous_options" jsonb NOT NULL,
	"next_options" jsonb NOT NULL,
	"previous_correct_options" jsonb NOT NULL,
	"next_correct_options" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "question_answer_audits" ADD CONSTRAINT "question_answer_audits_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_answer_audits" ADD CONSTRAINT "question_answer_audits_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "question_answer_audits_question_idx" ON "question_answer_audits" USING btree ("question_id","created_at");
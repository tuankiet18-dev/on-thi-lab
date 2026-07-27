CREATE TABLE "exam_bookmarks" (
	"user_id" uuid NOT NULL,
	"exam_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exam_bookmarks_user_id_exam_id_pk" PRIMARY KEY("user_id","exam_id")
);
--> statement-breakpoint
ALTER TABLE "exam_bookmarks" ADD CONSTRAINT "exam_bookmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_bookmarks" ADD CONSTRAINT "exam_bookmarks_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exam_bookmarks_user_created_idx" ON "exam_bookmarks" USING btree ("user_id","created_at");
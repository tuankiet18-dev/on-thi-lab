import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
};

export const roleEnum = pgEnum("role", ["user", "contributor", "admin"]);
export const examTypeEnum = pgEnum("exam_type", ["FE", "PE"]);
export const examStatusEnum = pgEnum("exam_status", [
  "draft",
  "review",
  "published",
  "cancelled",
]);
export const questionTypeEnum = pgEnum("question_type", ["single", "multiple"]);
export const attemptStatusEnum = pgEnum("attempt_status", [
  "in_progress",
  "submitted",
  "auto_submitted",
  "cancelled",
]);
export const reportStatusEnum = pgEnum("report_status", [
  "open",
  "reviewing",
  "resolved",
  "rejected",
]);
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "pending",
  "active",
  "expired",
  "cancelled",
]);
export const examFormatStatusEnum = pgEnum("exam_format_status", [
  "fe_candidate",
  "requires_review",
  "not_fe",
]);

export const campuses = pgTable("campuses", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  ...timestamps,
});

export const majors = pgTable("majors", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  ...timestamps,
});

export const curricula = pgTable(
  "curricula",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    majorId: uuid("major_id")
      .references(() => majors.id)
      .notNull(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    effectiveFrom: text("effective_from"),
    effectiveTo: text("effective_to"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("curricula_major_code_idx").on(table.majorId, table.code),
  ],
);

export const courses = pgTable("courses", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  priorityWave: integer("priority_wave").default(4).notNull(),
  examFormatStatus: examFormatStatusEnum("exam_format_status")
    .default("fe_candidate")
    .notNull(),
  ...timestamps,
});

export const curriculumCourses = pgTable(
  "curriculum_courses",
  {
    curriculumId: uuid("curriculum_id")
      .references(() => curricula.id)
      .notNull(),
    courseId: uuid("course_id")
      .references(() => courses.id)
      .notNull(),
    termNumber: integer("term_number").notNull(),
    isElective: boolean("is_elective").default(false).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.curriculumId, table.courseId] }),
    index("curriculum_courses_term_idx").on(
      table.curriculumId,
      table.termNumber,
    ),
  ],
);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  cognitoSubject: text("cognito_subject").notNull().unique(),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  studentCode: text("student_code").notNull().unique(),
  campusId: uuid("campus_id").references(() => campuses.id),
  majorId: uuid("major_id").references(() => majors.id),
  curriculumId: uuid("curriculum_id").references(() => curricula.id),
  role: roleEnum("role").default("user").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  ...timestamps,
});

export const exams = pgTable(
  "exams",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull().unique(),
    courseId: uuid("course_id")
      .references(() => courses.id)
      .notNull(),
    campusId: uuid("campus_id").references(() => campuses.id),
    semester: text("semester").notNull(),
    examType: examTypeEnum("exam_type").notNull(),
    isRetake: boolean("is_retake").default(false).notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    shuffleQuestions: boolean("shuffle_questions").default(true).notNull(),
    status: examStatusEnum("status").default("draft").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdBy: uuid("created_by")
      .references(() => users.id)
      .notNull(),
    ...timestamps,
  },
  (table) => [
    index("exams_catalog_idx").on(
      table.courseId,
      table.semester,
      table.campusId,
      table.examType,
    ),
  ],
);

export const examRevisions = pgTable(
  "exam_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    examId: uuid("exam_id")
      .references(() => exams.id)
      .notNull(),
    revision: integer("revision").notNull(),
    note: text("note"),
    answerConfidence: text("answer_confidence").default("reviewed").notNull(),
    approvedBy: uuid("approved_by").references(() => users.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("exam_revisions_number_idx").on(table.examId, table.revision),
  ],
);

export const questions = pgTable(
  "questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    revisionId: uuid("revision_id")
      .references(() => examRevisions.id)
      .notNull(),
    order: integer("question_order").notNull(),
    imageKey: text("image_key").notNull(),
    imageWidth: integer("image_width"),
    imageHeight: integer("image_height"),
    imageHash: text("image_hash").notNull(),
    type: questionTypeEnum("question_type").notNull(),
    options: jsonb("options").$type<string[]>().notNull(),
    correctOptions: jsonb("correct_options").$type<number[]>().notNull(),
    aiMetadata: jsonb("ai_metadata").$type<{
      provider?: string;
      model?: string;
      confidence?: number;
      raw?: unknown;
    }>(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("questions_revision_order_idx").on(
      table.revisionId,
      table.order,
    ),
    uniqueIndex("questions_revision_hash_idx").on(
      table.revisionId,
      table.imageHash,
    ),
  ],
);

export const questionAnswerAudits = pgTable(
  "question_answer_audits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    questionId: uuid("question_id")
      .references(() => questions.id)
      .notNull(),
    changedBy: uuid("changed_by")
      .references(() => users.id)
      .notNull(),
    previousType: questionTypeEnum("previous_type").notNull(),
    nextType: questionTypeEnum("next_type").notNull(),
    previousOptions: jsonb("previous_options").$type<string[]>().notNull(),
    nextOptions: jsonb("next_options").$type<string[]>().notNull(),
    previousCorrectOptions: jsonb("previous_correct_options")
      .$type<number[]>()
      .notNull(),
    nextCorrectOptions: jsonb("next_correct_options")
      .$type<number[]>()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("question_answer_audits_question_idx").on(
      table.questionId,
      table.createdAt,
    ),
  ],
);

export const attempts = pgTable(
  "attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    examId: uuid("exam_id")
      .references(() => exams.id)
      .notNull(),
    revisionId: uuid("revision_id")
      .references(() => examRevisions.id)
      .notNull(),
    status: attemptStatusEnum("status").default("in_progress").notNull(),
    deviceIdHash: text("device_id_hash").notNull(),
    questionOrder: jsonb("question_order").$type<string[]>().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    correctCount: integer("correct_count"),
    score: numeric("score", { precision: 4, scale: 2 }),
    ...timestamps,
  },
  (table) => [
    index("attempts_user_status_idx").on(table.userId, table.status),
    index("attempts_expiry_idx").on(table.status, table.expiresAt),
  ],
);

export const attemptAnswers = pgTable(
  "attempt_answers",
  {
    attemptId: uuid("attempt_id")
      .references(() => attempts.id)
      .notNull(),
    questionId: uuid("question_id")
      .references(() => questions.id)
      .notNull(),
    selectedOptions: jsonb("selected_options").$type<number[]>().notNull(),
    sequence: integer("sequence").default(0).notNull(),
    answeredAt: timestamp("answered_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.attemptId, table.questionId] })],
);

export const bookmarks = pgTable(
  "bookmarks",
  {
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    questionId: uuid("question_id")
      .references(() => questions.id)
      .notNull(),
    ...timestamps,
  },
  (table) => [primaryKey({ columns: [table.userId, table.questionId] })],
);

export const reports = pgTable("reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  questionId: uuid("question_id")
    .references(() => questions.id)
    .notNull(),
  attemptId: uuid("attempt_id").references(() => attempts.id),
  category: text("category").notNull(),
  detail: text("detail").notNull(),
  status: reportStatusEnum("status").default("open").notNull(),
  resolution: text("resolution"),
  resolvedBy: uuid("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  ...timestamps,
});

export const plans = pgTable("plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  durationMonths: integer("duration_months").notNull(),
  priceVnd: integer("price_vnd").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  ...timestamps,
});

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  planId: uuid("plan_id")
    .references(() => plans.id)
    .notNull(),
  status: subscriptionStatusEnum("status").default("pending").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  provider: text("provider").default("payos").notNull(),
  providerOrderCode: text("provider_order_code").unique(),
  amountVnd: integer("amount_vnd").notNull(),
  ...timestamps,
});

export const dailyUsage = pgTable(
  "daily_usage",
  {
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    usageDate: text("usage_date").notNull(),
    attemptsStarted: integer("attempts_started").default(0).notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.usageDate] })],
);

export const feedback = pgTable("feedback", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id),
  title: text("title").notNull(),
  detail: text("detail").notNull(),
  status: text("status").default("new").notNull(),
  ...timestamps,
});

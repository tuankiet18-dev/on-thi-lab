---
name: postgres-best-practices
description: >-
  Use this skill when designing PostgreSQL schemas, writing SQL queries, working with
  Drizzle ORM, configuring indexes, handling transactions, or writing database migrations.
  Ensures high performance, ACID integrity, and zero-downtime schema evolution.
---

# PostgreSQL & Drizzle ORM Best Practices

Guidelines for architecting robust, scalable, and safe PostgreSQL databases.

---

## 1. Schema Design Principles

1. **Explicit Constraints & Nullability**:
   - Explicitly define `notNull()`, `primaryKey()`, `unique()`, and foreign key `references()`.
   - Use UUIDs (`uuid('id').defaultRandom().primaryKey()`) or monotonic keys for entity identifiers.
   - Use `timestamp('created_at').defaultNow().notNull()` and `updatedAt` triggers or application hooks.

2. **Index Strategy**:
   - **Foreign Keys**: Always create indexes on foreign key columns used in joins and filters.
   - **Composite Indexes**: Align composite indexes with query filter order (Equality columns first, Range/Inequality columns last).
   - **Partial Indexes**: Use partial indexes for soft-deletes or status filters:
     ```sql
     CREATE INDEX idx_active_attempts ON attempts (user_id, exam_id) WHERE status = 'IN_PROGRESS';
     ```

---

## 2. Transactions & Concurrency

1. **Transaction Boundaries**:
   - Keep transactions short and focused on database operations. Do NOT make external HTTP/API calls inside a transaction.
   - Example with Drizzle ORM:
     ```ts
     await db.transaction(async (tx) => {
       const attempt = await tx
         .select()
         .from(attemptsTable)
         .where(eq(attemptsTable.id, attemptId))
         .for("update");
       if (attempt.status !== "IN_PROGRESS") {
         throw new Error("Attempt is already submitted");
       }
       await tx
         .update(attemptsTable)
         .set({ status: "SUBMITTED", submittedAt: new Date() })
         .where(eq(attemptsTable.id, attemptId));
     });
     ```

2. **Idempotency & Monotonic Updates**:
   - For autosaves or streaming events, check sequence numbers or timestamps before updating:
     ```ts
     await db
       .update(answersTable)
       .set({ selectedOption, sequenceNumber })
       .where(
         and(
           eq(answersTable.attemptId, attemptId),
           eq(answersTable.questionId, questionId),
           lt(answersTable.sequenceNumber, sequenceNumber),
         ),
       );
     ```

---

## 3. Migration Guidelines

1. **Backward-Compatible Schema Changes**:
   - Step 1: Add new nullable column or table.
   - Step 2: Deploy code writing to both old and new columns.
   - Step 3: Backfill data.
   - Step 4: Add `NOT NULL` constraint and remove old column.
2. **Never lock tables during migration**: Use `CONCURRENTLY` for index creation in raw SQL migrations.

---
name: security-review
description: >-
  Use this skill when auditing code changes for application security vulnerabilities,
  differential diff analysis, authentication/authorization validation, secure data handling,
  preventing SQL/NoSQL injection, CORS/CSRF safety, and credential protection.
---

# Security Review & Audit Skill

Guidelines for conducting security reviews on code changes, APIs, and data access layers.

---

## 1. Security Checklist by Domain

### 1. Authentication & Authorization (AuthN & AuthZ)

- **Role Order & RBAC**: Verify role boundaries (`user` < `contributor` < `admin`). Ensure contributors/users cannot read admin feedback or audit logs.
- **Resource Ownership**: Always check `userId` matches the current session token or the user has admin role before returning or mutating data:
  ```ts
  // ✅ Good: Ensure tenant/user isolation
  const attempt = await db.query.attempts.findFirst({
    where: and(
      eq(attempts.id, attemptId),
      eq(attempts.userId, session.user.id),
    ),
  });
  ```
- **JWT & Session Safety**: Validate signature, expiration (`exp`), and algorithm. Never trust unverified claims.

### 2. Input Validation & Injection Prevention

- **Schema Validation**: All incoming request bodies and query parameters MUST be validated via Zod / TypeBox contracts before reaching repository layers.
- **Parameterized SQL**: Always use parameterized queries (via Drizzle ORM or `sql` tagged templates). Never interpolate raw strings into queries.
- **XSS Prevention**: Sanitize HTML before rendering. In React, avoid `dangerouslySetInnerHTML` unless explicitly sanitized with DOMPurify.

### 3. Rate Limiting & Denial of Service (DoS)

- Enforce rate limits on public endpoints (login, exam start, OCR upload, answer submission).
- Set maximum request payload sizes for JSON and file uploads.

### 4. Secrets & Sensitive Data Exposure

- Never hardcode API keys, database passwords, or JWT secrets in client bundles or git commits.
- Ensure `.env*` files are listed in `.gitignore`.
- Sanitize error messages returned to clients; do not leak internal stack traces or database error messages in production.

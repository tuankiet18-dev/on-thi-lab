---
name: api-design-standards
description: >-
  Use this skill when designing RESTful APIs, HTTP endpoints, RPC services, payload
  schemas, error representations (RFC 7807), pagination, rate limiting, and idempotency mechanisms.
---

# API Design Standards Skill

Guidelines for building clean, consistent, resilient, and developer-friendly APIs.

---

## 1. URL & Resource Naming Conventions

- **Nouns over Verbs**: Use plural nouns for resource collections (`/api/v1/exams`, `/api/v1/attempts`).
- **Hierarchy for Sub-resources**: `/api/v1/exams/:examId/questions`, `/api/v1/attempts/:attemptId/answers`.
- **Kebab-case for Endpoints**: `/api/v1/exam-drafts`, `/api/v1/user-profiles`.
- **HTTP Methods**:
  - `GET`: Retrieve resources (Idempotent & Safe).
  - `POST`: Create a resource or trigger a non-idempotent operation.
  - `PUT`: Complete resource replacement (Idempotent).
  - `PATCH`: Partial resource update.
  - `DELETE`: Remove a resource (Idempotent).

---

## 2. Standardized Error Response (RFC 7807 / Problem Details)

All error responses should follow a consistent JSON format with actionable error codes:

```json
{
  "error": {
    "code": "EXAM_ALREADY_SUBMITTED",
    "message": "This exam attempt has already been submitted and cannot be modified.",
    "status": 409,
    "details": [
      {
        "field": "attemptId",
        "issue": "Attempt status is SUBMITTED"
      }
    ],
    "requestId": "req_01h7x..."
  }
}
```

---

## 3. Pagination & Filtering

- **Cursor-Based Pagination** (Preferred for high volume / real-time data):
  - Request: `GET /api/v1/items?limit=20&cursor=eyJpZCI6MTAwfQ==`
  - Response:
    ```json
    {
      "data": [...],
      "pagination": {
        "nextCursor": "eyJpZCI6MTIwfQ==",
        "hasMore": true
      }
    }
    ```
- **Offset-Based Pagination** (Suitable for catalog search with page numbers):
  - Request: `GET /api/v1/items?page=1&pageSize=20`

---

## 4. Idempotency & Concurrency

- **Idempotency Keys**: For critical operations (payments, final exam submissions), support `Idempotency-Key` header.
- **Optimistic Concurrency Control**: Use `ETag` / `If-Match` headers or entity version numbers (`version: 3`) to prevent lost updates in concurrent environments.

# Source Code Map

This map answers “where should I edit?” without reading all of `src`.

## Request path

| Domain             | Contract                    | Browser client                                        | API route                                                      | Persistence / worker                                                    |
| ------------------ | --------------------------- | ----------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Profile & auth     | `profiles.ts`, `common.ts`  | `features/profiles/api.ts`, `auth/`                   | `modules/profiles/routes.ts`                                   | `user-profile-repository.ts`                                            |
| Catalog & courses  | `catalog.ts`                | `features/catalog/api.ts`                             | `modules/catalog/routes.ts`, `modules/admin-catalog/routes.ts` | `catalog-repository.ts`, `admin-catalog-repository.ts`                  |
| Import ZIP         | `admin.ts`, `reviews.ts`    | `features/admin/api.ts`                               | `modules/imports/routes.ts`                                    | `import-service.ts`, `draft-import-repository.ts`, `packages/importer/` |
| Review & publish   | `reviews.ts`                | `features/exam-review/api.ts`                         | `modules/exam-review/routes.ts`                                | `draft-import-repository.ts`, `modules/exam-review/`                    |
| OCR / hybrid       | `reviews.ts`                | `features/ocr/api.ts`                                 | `modules/ocr/routes.ts`                                        | `ocr-repository.ts`, `apps/worker/src/ocr-*`                            |
| Exam catalog       | `exams.ts`, `catalog.ts`    | `features/catalog/api.ts`                             | `modules/catalog/routes.ts`                                    | `catalog-repository.ts`                                                 |
| Attempts & scoring | `attempts.ts`               | `features/attempts/api.ts`                            | `modules/attempts/routes.ts`                                   | `attempt-repository.ts`                                                 |
| Bookmarks          | `bookmarks.ts`              | `features/bookmarks/api.ts`                           | `modules/bookmarks/routes.ts`                                  | `bookmark-repository.ts`                                                |
| Reports & feedback | `reports.ts`, `feedback.ts` | `features/reports/api.ts`, `features/feedback/api.ts` | `modules/moderation/routes.ts`                                 | `report-repository.ts`, `feedback-repository.ts`                        |
| Admin attention    | `admin.ts`                  | `features/admin/api.ts`                               | `modules/admin-users/routes.ts`                                | `admin-attention-repository.ts`                                         |

Contract paths are relative to `packages/contracts/src`, browser paths to
`apps/web/src`, API paths to `apps/api/src`, and repository paths to
`packages/database/src`.

## Composition roots

- `apps/api/src/app.ts`: HTTP middleware and domain route registration only.
- `apps/api/src/runtime.ts`: production dependency construction.
- `apps/web/src/main.tsx` and `router.tsx`: browser startup and routing.
- `apps/worker/src/lambda.ts`: worker runtime initialization.
- `infra/lib/onthilab-stack.ts`: AWS resources; keep construct IDs stable.

## Shared infrastructure

- `apps/api/src/app-context.ts`: dependency interfaces supplied to route
  modules.
- `apps/api/src/default-dependencies.ts`: safe defaults used by tests/local
  startup.
- `apps/api/src/http/`: HTTP-only middleware and URL mapping.
- `apps/web/src/api/http.ts`: fetch, auth headers and response validation.
- `apps/web/src/lib/api.ts`: legacy compatibility barrel; do not add logic.
- `packages/contracts/src/index.ts`: public compatibility barrel; schemas live
  in domain files.
- `packages/database/src/schema.ts`: database schema only.

## Adding a feature

1. Add or extend a domain contract schema.
2. Add the repository method and transaction if persistence is required.
3. Add a route inside the owning API module and register a new module only when
   it is a genuinely new domain.
4. Add its browser API function inside the same web feature.
5. Keep page components focused on orchestration; extract reusable UI and state
   hooks into the owning feature folder.
6. Add tests at the layer that owns the rule, not only at the page layer.

## Files intentionally kept as facades

These files support gradual migration and should stay tiny:

- `packages/contracts/src/index.ts`
- `apps/web/src/lib/api.ts`
- `apps/api/src/app.ts` (composition root, not a barrel)

If a facade starts containing validation, fetch logic or business decisions,
move that logic back to its owner.

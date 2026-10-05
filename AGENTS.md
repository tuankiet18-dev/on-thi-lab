# OnThiLab Agent Guide

Use this file as the first navigation entry point. Do not scan the entire
repository before locating the owning domain in `docs/code-map.md`.

## Fast navigation

1. Read `docs/code-map.md` and select one domain.
2. Read that domain's contract in `packages/contracts/src/<domain>.ts`.
3. Follow the request path only as far as needed:
   `web feature API -> API module routes -> database repository`.
4. Read `docs/architecture.md` before changing domain behavior or persistence.

Useful searches:

```bash
rg "route-or-symbol" apps packages
rg "register.*Routes" apps/api/src/modules
rg "Repository" packages/database/src
```

## Dependency direction

```text
apps/web -> packages/contracts
apps/api -> packages/contracts + packages/database + packages/importer
apps/worker -> packages/contracts + packages/database
packages/database -> packages/contracts
infra -> deployable apps/packages
```

- Domain modules must not import from a UI page or another app.
- `apps/api/src/app.ts` is wiring only. Put endpoints in
  `apps/api/src/modules/<domain>/routes.ts`.
- Put browser calls in `apps/web/src/features/<domain>/api.ts`; keep
  `apps/web/src/lib/api.ts` as a compatibility facade only.
- Put public validation/types in the owning contracts file, then export it from
  `packages/contracts/src/index.ts`.
- Keep transactions in database repositories. Do not replace internal calls
  with HTTP requests.

## Business invariants

Never change these incidentally during refactors:

- A student has at most one in-progress attempt per exam.
- The server owns `expiresAt`; the browser timer is only presentation.
- Answer autosave sequence is monotonic and submission is idempotent.
- An attempt always points to an immutable exam revision.
- Only fully reviewed exams can be published.
- AI/community answers are suggestions until confirmed by the review rules.
- OCR hybrid mode may fall back to the original image per question.
- Role order is user, contributor, admin; contributors cannot gain admin-only
  feedback visibility.
- Attempts are currently unlimited.

## Compatibility during refactors

- Preserve HTTP paths, status codes, payload schemas and auth middleware.
- Preserve existing exports through a thin barrel/facade while callers migrate.
- Do not rename database tables/columns or CDK construct IDs in an organization
  refactor.
- Prefer small domain commits; do not mix a behavior feature into a structural
  change.

## Required verification

Run the smallest affected checks while editing, then before handoff run:

```bash
pnpm validate
```

For API route moves, `pnpm --filter @onthilab/api test` is mandatory. For
contract changes, test contracts plus every consuming package.

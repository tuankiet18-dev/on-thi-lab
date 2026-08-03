<h1 align="center">
  <img src="apps/web/public/logo.png" alt="OnThiLab Mascot" width="72" /><br />
  OnThiLab
</h1>

<p align="center">
  <strong>Exam practice platform for FPT University students</strong><br />
  <em>Nền tảng luyện đề thi FE/PE dành cho sinh viên Đại học FPT</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-22+-339933?logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Hono-API-E36002?logo=hono&logoColor=white" alt="Hono" />
  <img src="https://img.shields.io/badge/PostgreSQL-Supabase-3ECF8E?logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/Deploy-AWS-FF9900?logo=amazonaws&logoColor=white" alt="AWS" />
</p>

---

## About / Giới thiệu

**OnThiLab** is an exam practice platform for FPT University students. Students can search past FE/PE exams by course code, campus and semester; take timed mock tests with autosave; view graded results with answer explanations; and track their study progress over time.

**OnThiLab** là nền tảng luyện đề thi cuối kỳ (FE/PE) dành cho sinh viên FPT University. Sinh viên có thể tìm đề theo mã môn, campus và học kỳ; làm bài với bộ đếm thời gian và autosave giống thi thật; xem kết quả, đáp án và theo dõi tiến độ ôn tập.

**The system supports 3 roles / Hệ thống hỗ trợ 3 vai trò:**

| Role / Vai trò             | Capabilities / Chức năng                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 🎓 **Student / Sinh viên** | Search exams, take timed tests, view results, bookmark questions — Tìm đề, làm bài, xem kết quả, lưu câu hỏi |
| 🛠️ **Contributor**         | Import exams via ZIP, review & correct answers — Nhập đề từ ZIP, duyệt và chỉnh đáp án                       |
| 👑 **Admin**               | Publish exams, manage catalog, manage users — Xuất bản đề, quản lý danh mục, phân quyền                      |

---

## Tech Stack

| Layer              | Technology                                           |
| ------------------ | ---------------------------------------------------- |
| **Frontend**       | React 19, Vite 7, TanStack Router, Tailwind CSS v4   |
| **Backend API**    | Hono.js on AWS Lambda (Node.js 22)                   |
| **Database**       | PostgreSQL via Supabase, Drizzle ORM                 |
| **Authentication** | AWS Cognito, Google OAuth, Authorization Code + PKCE |
| **Storage**        | AWS S3 (question images)                             |
| **Queue**          | AWS SQS (import jobs + AI answer suggestions)        |
| **CDN**            | AWS CloudFront                                       |
| **Infrastructure** | AWS CDK (TypeScript)                                 |
| **CI/CD**          | GitHub Actions                                       |
| **Testing**        | Vitest (unit), Playwright (e2e)                      |
| **Monorepo**       | pnpm Workspaces                                      |

---

## Repository Structure / Cấu trúc repo

```
onthilab/
├── apps/
│   ├── web/          # React SPA (Frontend)
│   ├── api/          # Hono API (Backend — runs on Lambda)
│   └── worker/       # SQS consumer (AI answer suggestions)
├── packages/
│   ├── contracts/    # Shared Zod schemas & TypeScript types
│   ├── database/     # Drizzle schema, query functions, migrations
│   ├── config/       # Shared config utilities
│   └── importer/     # ZIP import & validation logic
├── infra/            # AWS CDK stacks (Lambda, S3, CloudFront, Cognito)
├── e2e/              # Playwright end-to-end tests
└── docs/             # Architecture, ADRs, runbooks
```

---

## Prerequisites / Yêu cầu

- **Node.js** ≥ 22
- **pnpm** ≥ 10.13 → `npm install -g pnpm`
- **AWS CLI** — only required for deployment / chỉ cần khi deploy

---

## Getting Started / Cài đặt

### 1. Clone & install

```bash
git clone https://github.com/tuankiet18-dev/on-thi-lab.git
cd on-thi-lab
pnpm install
pnpm git:setup        # Install pre-commit hooks
```

### 2. Configure environment variables / Cấu hình biến môi trường

```bash
cp .env.example .env.local
# Fill in the required variables
```

### 3. Start development servers / Chạy server

```bash
pnpm dev              # Both web (port 5173) and api (port 8787)
pnpm dev:web          # Frontend only
pnpm dev:api          # Backend only
```

Open `http://localhost:5173` in your browser.

> **Demo mode / Chế độ demo:** If Cognito and database are not configured, the frontend automatically falls back to local demo data so you can explore the UI without a backend.

---

## Environment Variables / Biến môi trường

### Frontend

| Variable                    | Description                      |
| --------------------------- | -------------------------------- |
| `VITE_API_URL`              | Hono API base URL                |
| `VITE_COGNITO_DOMAIN`       | Cognito hosted UI domain         |
| `VITE_COGNITO_CLIENT_ID`    | Cognito App client ID            |
| `VITE_COGNITO_REDIRECT_URI` | OAuth callback URL after sign-in |
| `VITE_COGNITO_LOGOUT_URI`   | Redirect URL after sign-out      |

### Backend

| Variable                    | Description                                    |
| --------------------------- | ---------------------------------------------- |
| `DATABASE_URL`              | PostgreSQL connection string (Supabase pooler) |
| `COGNITO_USER_POOL_ID`      | Cognito User Pool ID                           |
| `COGNITO_CLIENT_ID`         | Cognito App client ID                          |
| `S3_QUESTION_IMAGES_BUCKET` | S3 bucket name for question images             |
| `AI_SUGGESTION_QUEUE_URL`   | SQS queue URL (optional — enables AI pipeline) |

> See [`docs/secrets-and-environments.md`](docs/secrets-and-environments.md) for full environment setup details.

---

## Quality Gates / Kiểm tra chất lượng

```bash
pnpm validate         # Format check + typecheck + unit tests + build (full CI gate)
pnpm typecheck        # TypeScript check only
pnpm test             # Unit tests (Vitest)
pnpm test:e2e         # End-to-end tests (Playwright)
pnpm format           # Auto-format all source files
```

---

## Staging Deployment / Deploy lên Staging

### Frontend (S3 + CloudFront)

```bash
VITE_API_URL='https://<api-gateway-url>/staging' \
VITE_COGNITO_DOMAIN='https://<cognito-domain>' \
VITE_COGNITO_CLIENT_ID='<client-id>' \
VITE_COGNITO_REDIRECT_URI='https://staging.onthilab.id.vn/auth/callback' \
VITE_COGNITO_LOGOUT_URI='https://staging.onthilab.id.vn/' \
pnpm --filter @onthilab/web exec vite build --mode staging

aws s3 sync apps/web/dist s3://<web-bucket> --delete --only-show-errors
aws cloudfront create-invalidation --distribution-id <distribution-id> --paths '/*'
```

### Backend (AWS Lambda via CDK)

```bash
pnpm build
cd infra
pnpm cdk deploy --require-approval never
```

---

## Contributing / Quy trình đóng góp

```bash
# 1. Create a branch from main
git switch main && git pull origin main
git switch -c feat/your-feature-name

# 2. Make changes and validate
pnpm validate

# 3. Commit and open a PR
git add .
git commit -m "feat(scope): short description"
git push -u origin feat/your-feature-name
gh pr create --base main
```

> **Only merge when all CI checks (`validate` and `e2e`) are green.**
>
> **Chỉ merge khi tất cả CI checks (`validate` và `e2e`) đều xanh.**

---

## Documentation / Tài liệu

| File                                                                   | Content                                            |
| ---------------------------------------------------------------------- | -------------------------------------------------- |
| [`docs/architecture.md`](docs/architecture.md)                         | System architecture, auth flow, service boundaries |
| [`docs/roadmap-to-production.md`](docs/roadmap-to-production.md)       | Development phase roadmap                          |
| [`docs/import-zip-format.md`](docs/import-zip-format.md)               | ZIP file format for exam import                    |
| [`docs/ai-answer-suggestions.md`](docs/ai-answer-suggestions.md)       | AI answer suggestion pipeline                      |
| [`docs/secrets-and-environments.md`](docs/secrets-and-environments.md) | Secrets & environment management                   |
| [`docs/runbook.md`](docs/runbook.md)                                   | Operations & incident runbook                      |

---

## Development Status / Trạng thái phát triển

| Phase | Scope                                              | Status         |
| ----- | -------------------------------------------------- | -------------- |
| 0–2   | Config, CI/CD, Auth (Cognito + Google), Onboarding | ✅ Done        |
| 3–4   | ZIP import, AI suggestions, Exam engine            | 🔄 In progress |
| 5     | History, Statistics, Bookmark, Reports             | 📋 Planned     |
| 6     | Staging/Production AWS deploy, Observability       | 🔄 In progress |
| 7–8   | Security audit, UAT, Go-live                       | 📋 Planned     |

**🎯 Production MVP target: before January 6, 2027**

---

## License

This project does not currently have an open-source license.

_Dự án này chưa có giấy phép mã nguồn mở._

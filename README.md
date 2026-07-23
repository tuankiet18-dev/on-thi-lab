# OnThiLab

Nền tảng luyện thi FE theo cấu trúc đề thật dành cho sinh viên FPT. Repository này chứa vertical slice đầu tiên dựa trên [product spec](./spec.md).

## Đã có

- Dashboard và kho đề responsive, lọc theo campus/kỳ học.
- Luồng thi demo image-first: timer, next/previous, đánh dấu, autosave, cảnh báo trước khi nộp và auto-submit.
- Chấm điểm exact-match cho câu một hoặc nhiều đáp án, trang xem lại kết quả và điểm tham khảo.
- Trang Admin nhập ZIP theo quy trình upload → AI đề xuất → duyệt → publish.
- Hono API cho catalog, create/resume attempt, autosave và submit idempotent.
- Drizzle schema cho catalog, version đề/đáp án, attempt, report và subscription.
- Worker contract độc lập với nhà cung cấp AI.
- AWS CDK với stack Cognito độc lập; scaffold core cho S3/CloudFront, SQS/DLQ
  và Aurora PostgreSQL.
- Runtime config validation và feature flags an toàn cho Google, AI và payOS.
- Seed idempotent cho 5 campus, 9 kỳ và 41 môn ưu tiên theo bốn data wave.

## Chạy local

Yêu cầu Node.js 22+ và Docker (chỉ cần khi làm việc với PostgreSQL).

```bash
corepack enable
pnpm install
pnpm dev
```

- Web: <http://localhost:5173>
- API health: <http://localhost:8787/health>

Nếu máy không có Corepack:

```bash
npx pnpm@10.13.1 install
npx pnpm@10.13.1 dev
```

Lệnh kiểm tra:

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm infra:synth
```

PostgreSQL local:

```bash
docker compose up -d postgres
cp .env.example .env
pnpm --filter @onthilab/database db:generate
pnpm --filter @onthilab/database db:migrate
pnpm --filter @onthilab/database db:seed
```

`db:seed` có thể chạy lại an toàn; dữ liệu catalog được upsert thay vì tạo bản
ghi trùng.

## Cấu trúc

```text
apps/
  web/       React + Vite + TanStack Router/Query
  api/       Hono API, tương thích Lambda
  worker/    Hợp đồng xử lý AI Vision
packages/
  contracts/ Zod contracts và scoring domain
  database/  Drizzle PostgreSQL schema
infra/       AWS CDK
docs/        Architecture notes
```

Tài liệu vận hành:

- [Roadmap đến production](./docs/roadmap-to-production.md)
- [Definition of Done](./docs/definition-of-done.md)
- [Secrets và environments](./docs/secrets-and-environments.md)

## Việc tiếp theo

1. Kết nối UI với API và PostgreSQL thay cho adapter local.
2. Kết nối Cognito Managed Login vào web, thêm Google OAuth và onboarding hồ
   sơ.
3. Hoàn thiện presigned multipart upload ZIP, worker giải nén và AI adapter.
4. Xây màn hình review đáp án 60 câu, audit log và publish revision.
5. Thêm payOS, entitlement và giới hạn free 2 lượt/ngày.
6. Bổ sung E2E cho concurrency, reload, timeout, offline và mobile.

Không deploy trực tiếp từ máy local trước khi đã cấu hình AWS account, budget alerts, domain và secrets.

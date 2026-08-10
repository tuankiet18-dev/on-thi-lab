<p align="center">
  <img src="apps/web/public/logo.png" alt="OnThiLab" width="80" />
</p>

<h1 align="center">OnThiLab</h1>

<p align="center">
  <strong>Nền tảng luyện đề FE thực tế cho sinh viên FPT University.</strong><br />
  Tìm đúng môn, làm đề đúng thời gian và xem lại kết quả để ôn tập hiệu quả hơn.
</p>

<p align="center">
  <a href="https://onthilab.id.vn">Production</a> ·
  <a href="https://staging.onthilab.id.vn">Staging</a> ·
  <a href="https://github.com/tuankiet18-dev/on-thi-lab/actions/workflows/ci.yml"><img src="https://github.com/tuankiet18-dev/on-thi-lab/actions/workflows/ci.yml/badge.svg" alt="CI status" /></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-22+-339933?logo=nodedotjs&logoColor=white" alt="Node.js 22+" />
  <img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/AWS-Serverless-FF9900?logo=amazonaws&logoColor=white" alt="AWS Serverless" />
</p>

## Mục tiêu

OnThiLab giúp sinh viên luyện lại đề FE của các kỳ trước theo trải nghiệm gần với bài thi thực tế. Hệ thống chỉ cung cấp điểm và đáp án tham khảo; mọi đáp án trước khi phát hành đều được quản trị viên duyệt.

## Tính năng chính

### Dành cho sinh viên

- Tìm đề theo mã hoặc tên môn, campus và kỳ học.
- Làm đề có đồng hồ đếm ngược, tự lưu đáp án, chuyển câu linh hoạt và tự nộp khi hết giờ.
- Làm lại đề không giới hạn; xem điểm, đáp án tham khảo và chi tiết từng câu sau khi nộp.
- Xem đề trước khi làm, lưu đề/câu hỏi cần ôn, xem lịch sử và thống kê cá nhân.
- Đăng nhập bằng Google hoặc email/mật khẩu qua Amazon Cognito.

### Dành cho quản trị viên và cộng tác viên

- Quản lý danh mục môn học và đề thi theo môn.
- Nhập một hoặc nhiều ZIP; mỗi ZIP tạo một đề nháp độc lập.
- Duyệt đáp án được gợi ý từ `answers.json`, dữ liệu comment đã crawl hoặc AI theo từng câu.
- Chọn giữ ảnh gốc, dùng OCR text, hoặc chế độ **hybrid**: câu OCR đủ tin cậy hiển thị text; câu có biểu đồ, công thức hoặc OCR thiếu dữ liệu tự dùng ảnh gốc.
- Duyệt, xuất bản, hủy đề và xử lý báo lỗi/góp ý của sinh viên.

## Luồng dữ liệu đề thi

```text
ZIP ảnh + answers.json (tùy chọn)
        │
        ▼
Nhập đề nháp ──► Duyệt đáp án ──► Duyệt OCR (nếu bật) ──► Xuất bản
                                      │
                                      └── hybrid: text hợp lệ / ảnh gốc dự phòng
```

Xem chi tiết định dạng ZIP tại [docs/import-zip-format.md](docs/import-zip-format.md).

## Kiến trúc

| Thành phần    | Công nghệ                                               |
| ------------- | ------------------------------------------------------- |
| Web           | React 19, Vite 7, TanStack Router, Tailwind CSS v4      |
| API           | Hono trên AWS Lambda (Node.js 22)                       |
| Database      | PostgreSQL trên Supabase, Drizzle ORM                   |
| Đăng nhập     | Amazon Cognito, Google OAuth, Authorization Code + PKCE |
| Lưu trữ & CDN | Amazon S3, CloudFront                                   |
| Xử lý nền     | SQS, Lambda worker, Amazon Textract cho OCR             |
| Hạ tầng       | AWS CDK (TypeScript)                                    |
| Kiểm thử      | Vitest, Playwright, GitHub Actions                      |

```text
React SPA → API Gateway → Lambda API → Supabase PostgreSQL
    │                         │
    └── CloudFront + S3        ├── S3 question images
                              └── SQS → Lambda worker → Textract / AI
```

## Cấu trúc repository

```text
apps/
  web/        React SPA
  api/        Hono API chạy trên Lambda
  worker/     Worker xử lý import, OCR và gợi ý đáp án
packages/
  contracts/  Zod schemas và kiểu dùng chung
  database/   Drizzle schema, migrations và repositories
  importer/   Đọc, kiểm tra ZIP và xử lý dữ liệu nhập
  config/     Cấu hình dùng chung
infra/        AWS CDK stacks
e2e/          Playwright end-to-end tests
docs/         Tài liệu kiến trúc, vận hành và định dạng import
```

## Bắt đầu phát triển

### Yêu cầu

- Node.js 22 trở lên
- pnpm 10.13 trở lên
- AWS CLI (chỉ cần khi triển khai)

### Cài đặt

```bash
git clone https://github.com/tuankiet18-dev/on-thi-lab.git
cd on-thi-lab
pnpm install
pnpm git:setup
cp .env.example .env.local
```

Điền các biến cần thiết trong `.env.local`. Không commit file này hoặc credential dưới bất kỳ hình thức nào.

### Chạy local

```bash
pnpm dev       # Web :5173 và API :8787
pnpm dev:web   # Chỉ frontend
pnpm dev:api   # Chỉ API
```

Mở `http://localhost:5173`.

## Chất lượng mã nguồn

```bash
pnpm validate       # format + typecheck + test + build
pnpm typecheck      # kiểm tra TypeScript
pnpm test           # unit tests
pnpm test:e2e       # Playwright e2e
pnpm format         # định dạng mã nguồn
pnpm infra:synth    # kiểm tra CDK synthesis
```

## Triển khai

Các script deploy lấy API endpoint, S3 bucket và CloudFront distribution trực tiếp từ CloudFormation. Chúng build đúng Vite mode của từng môi trường và tạo cache invalidation sau khi upload web.

```bash
# Deploy đầy đủ staging: validate, CDK, web và CloudFront
pnpm deploy:staging

# Chỉ deploy web staging
pnpm deploy:staging:web

# Deploy đầy đủ production (bắt buộc xác nhận)
pnpm deploy:prod -- --confirm-production

# Chỉ deploy web production
pnpm deploy:prod:web -- --confirm-production
```

Khi release có migration database, thêm `--migrate` vào lệnh deploy. Chỉ dùng `--skip-validate` khi source hiện tại vừa được kiểm tra đầy đủ và bạn có lý do rõ ràng.

Biến bí mật được lưu trong AWS Systems Manager Parameter Store; xem [docs/secrets-and-environments.md](docs/secrets-and-environments.md) và [docs/runbook.md](docs/runbook.md) trước khi vận hành.

## Quy trình đóng góp

Repository sử dụng **GitHub Flow**: `main` luôn phải có thể deploy và mọi thay đổi đi qua branch + pull request.

```bash
git switch main
git pull --ff-only origin main
git switch -c fix/short-description

pnpm validate
git add <files>
git commit -m "fix(scope): short description"
git push -u origin fix/short-description
gh pr create --fill
```

- Dùng Conventional Commits.
- Tên branch chỉ dùng `feat/`, `fix/`, `hotfix/`, `refactor/`, `test/`, `docs/`, `chore/` hoặc `ci/`.
- Không push trực tiếp lên `main`; chỉ squash merge khi CI xanh.

Quy định đầy đủ: [CONTRIBUTING.md](CONTRIBUTING.md).

## Tài liệu

- [Kiến trúc hệ thống](docs/architecture.md)
- [Định dạng ZIP nhập đề](docs/import-zip-format.md)
- [Gợi ý đáp án AI](docs/ai-answer-suggestions.md)
- [Secrets và môi trường](docs/secrets-and-environments.md)
- [Runbook vận hành](docs/runbook.md)
- [Roadmap production](docs/roadmap-to-production.md)

## Lưu ý sử dụng nội dung

OnThiLab chỉ phục vụ mục đích học tập. Người nhập nội dung chịu trách nhiệm về quyền sử dụng dữ liệu; mọi điểm số và đáp án trên hệ thống đều mang tính tham khảo.

## License

Chưa phát hành giấy phép mã nguồn mở.

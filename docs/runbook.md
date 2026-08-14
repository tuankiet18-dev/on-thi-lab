# OnThiLab staging and production runbook

Runbook này là source of truth cho deploy, smoke test và rollback. Hệ thống dùng
Supabase PostgreSQL; không dùng RDS/Aurora.

## Prerequisites

- Node.js 22+, pnpm 10+, AWS CLI và AWS credentials đúng account.
- `.env.staging` và `.env.production` tồn tại, chỉ chứa cấu hình public dành cho
  Vite; không commit secret.
- SSM Parameter Store đã có `/onthilab/<stage>/database` và các parameter cần
  cho Cognito/AI.
- ACM certificate ở `us-east-1` và domain đã trỏ đến CloudFront.
- Working tree chứa đúng source cần phát hành và `pnpm validate` đạt.

Script deploy tự xác định CloudFormation outputs, kiểm tra API health, build
đúng Vite mode, upload S3 và tạo CloudFront invalidation.

## Deploy staging

```bash
# Full deploy: validate, CDK, API health, web upload, invalidation
pnpm deploy:staging

# Release có database migration
pnpm deploy:staging --migrate

# Chỉ cập nhật web
pnpm deploy:staging:web
```

Sau deploy, chạy smoke test trên staging:

1. Đăng nhập Google và email/password.
2. Mở kho đề và tải một ảnh câu hỏi.
3. Bắt đầu đề, chọn ít nhất hai câu, reload và kiểm tra resume/autosave.
4. Submit và mở trang kết quả.
5. Với thay đổi admin/OCR: import một ZIP nhỏ, review và không publish dữ liệu
   test nếu chưa xác minh.

Load test chỉ được chạy trên staging theo `docs/load-testing.md`.

## Deploy production

Chỉ deploy sau khi staging đạt và người thực hiện đã xác nhận release scope.

```bash
# Full deploy production; cờ xác nhận là bắt buộc
pnpm deploy:prod --confirm-production

# Release có database migration
pnpm deploy:prod --confirm-production --migrate

# Chỉ cập nhật web
pnpm deploy:prod:web --confirm-production
```

Không dùng `--skip-validate` trừ khi cùng source đã vừa được validate đầy đủ và
lý do được ghi trong release/PR.

## Post-deploy verification

Script đã kiểm tra API health. Người deploy tiếp tục xác minh:

```bash
curl --fail --silent --show-error https://onthilab.id.vn >/dev/null
curl --fail --silent --show-error https://staging.onthilab.id.vn >/dev/null

aws cloudformation describe-stacks \
  --region ap-southeast-1 \
  --stack-name OnThiLab-prod \
  --query 'Stacks[0].StackStatus' \
  --output text
```

Checklist production:

- CloudFormation là `CREATE_COMPLETE` hoặc `UPDATE_COMPLETE`, không rollback.
- API `/health`, trang chủ và một SPA route trả HTTP 200.
- CloudFront invalidation hoàn tất hoặc asset hash mới đã tải được.
- Cognito callback quay về đúng domain production.
- CloudWatch không xuất hiện error/throttle bất thường sau release.
- Một critical-flow smoke test bằng tài khoản production test đạt; không dùng
  dữ liệu của sinh viên thật.

## Application rollback

1. Xác định commit production gần nhất hoạt động ổn định.
2. Tạo branch `hotfix/...` từ `main` và dùng `git revert` cho commit/PR gây lỗi.
3. Chạy `pnpm validate`, mở pull request và chỉ merge khi CI xanh.
4. Deploy lại production bằng script chuẩn.
5. Xác minh health, auth và critical exam flow.

Không force-push, không push trực tiếp vào `main`, không rollback database bằng
cách xóa bảng hoặc sửa tay dữ liệu.

## Migration incident

- Migration phải forward-compatible với phiên bản ứng dụng trước trong thời
  gian rollout.
- Nếu app rollback nhưng migration vẫn tương thích, giữ migration và chỉ
  rollback application.
- Với lỗi dữ liệu, dừng thao tác admin nặng, bảo toàn evidence và dùng quy trình
  backup/restore Supabase đã được diễn tập. Không dùng hướng dẫn RDS vì hệ thống
  không có RDS.
- Ghi lại migration, thời gian, request ID và phạm vi dữ liệu ảnh hưởng.

## Monitoring and incident triage

- `ApiLambdaErrorAlarm`: xem Lambda application log theo request ID.
- `ApiLambdaThrottleAlarm`: kiểm tra account concurrency quota trước khi tăng
  reserved concurrency.
- `ApiGatewayLatencyAlarm`: tách API latency khỏi thời gian tải ảnh CloudFront.
- `ApiGatewayServerErrorAlarm`: đối chiếu API access log và Lambda errors.
- OCR/import DLQ hoặc old-message alarm: tạm dừng import hàng loạt, xem payload
  lỗi và retry có kiểm soát.
- Supabase CPU/RAM/connections trên 70% liên tục: dừng admin workload nặng và
  kiểm tra query/index trước khi nâng compute.

Chi tiết giờ cao điểm nằm trong `docs/capacity-runbook.md`. Sau mọi incident,
cập nhật `docs/project-status.md` nếu khả năng hệ thống hoặc rủi ro đã thay đổi.

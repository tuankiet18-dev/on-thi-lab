# Kiến trúc OnThiLab

## Mục tiêu của vertical slice

Phiên bản khởi tạo chứng minh trọn vẹn một luồng quan trọng:

1. Sinh viên duyệt danh mục và lọc theo campus/kỳ học.
2. Sinh viên xem quy định của đề FE.
3. Hệ thống tạo hoặc khôi phục một attempt đang làm.
4. Câu trả lời được lưu sau mỗi thay đổi; timer không thể tạm dừng.
5. Hệ thống nộp thủ công hoặc tự nộp khi hết giờ.
6. Kết quả dùng exact-match cho câu nhiều đáp án và thang điểm 10.

Onboarding, catalog, publish và exam engine đều dùng API Hono và PostgreSQL làm
nguồn dữ liệu chính. Dữ liệu demo/local storage chỉ còn là fallback để bộ UI
test có thể chạy độc lập khi Cognito và database không được cấu hình.

## Luồng xác thực development

```text
React SPA
  └── Authorization Code + PKCE
        └── Cognito Managed Login
              ├── Google OAuth
              └── Cognito email/password
```

- Google client ID và client secret chỉ tồn tại trong SSM Parameter Store
  Standard `String` tại `/onthilab/<stage>/google/client-id` và
  `/onthilab/<stage>/google/client-secret`; Cognito nhận dynamic reference khi
  deploy. CloudFormation Cognito không hỗ trợ `ssm-secure` dynamic reference
  cho provider này, nên quyền đọc parameter phải được giới hạn cho deploy
  operator.
- Browser chỉ nhận Cognito public client ID; không có client secret.
- OAuth transaction và token được lưu trong `sessionStorage`; mã xác minh PKCE
  và `state` được kiểm tra trước khi đổi code lấy token.
- API xác thực Cognito ID token trong bearer header, gồm chữ ký, issuer,
  audience/client ID, loại token và expiry trước khi tin cậy email/tên.
- Onboarding lưu vào bảng `users`, lấy role từ server và chỉ yêu cầu campus.
  MSSV/ngành là thông tin hồ sơ tùy chọn, có thể bổ sung sau. Catalog/exam/
  attempt API yêu cầu người dùng đã hoàn tất onboarding tối thiểu.

## Ranh giới hệ thống

```text
React/Vite
   ├── CloudFront ── S3 web
   ├── CloudFront ── S3 question images
   │
   ▼
API Gateway ── Lambda/Hono ── Supabase PostgreSQL qua transaction pooler
                         ├── SQS import jobs ── AI Vision provider
                         └── Cognito / payOS webhook
```

## Quy tắc bất biến

- Một người dùng có tối đa một attempt `in_progress` cho mỗi đề.
- `expiresAt` từ server là nguồn thời gian chính thức; client chỉ hiển thị countdown.
- Autosave dùng `sequence` tăng dần để request đến muộn không ghi đè đáp án mới.
- Submit là idempotent.
- Attempt luôn trỏ tới một `exam_revision`; sửa đáp án không làm đổi điểm lịch sử.
- Đề chỉ được publish khi revision đã có người duyệt.
- Gợi ý AI chỉ nằm trong `ai_metadata`; không được dùng làm đáp án chính thức
  trước khi người duyệt áp dụng và lưu.
- Chỉ Admin được approve revision và publish; Contributor chỉ nhập/duyệt đáp án.
- Chỉ Admin được yêu cầu AI cho từng câu đang duyệt vì thao tác có thể phát sinh
  chi phí.
- Người dùng có thể tạo attempt mới không giới hạn trong giai đoạn ra mắt;
  attempt đang hoạt động vẫn được resume trên cùng thiết bị.
- Ảnh gốc và ảnh phát hành dùng object key bất biến, checksum để chống trùng.

## Chi phí AWS và Supabase

Supabase PostgreSQL Free là database cho public MVP traffic thấp, kết nối từ
Lambda chỉ qua `DATABASE_URL` đọc lúc cold start từ SSM Parameter Store
SecureString. CDK không còn provision Aurora hay VPC, tránh chi phí nền không
cần thiết. S3 private qua CloudFront OAC, SQS có DLQ và tài nguyên dev có thể
xóa. Các control vận hành bắt buộc gồm:

- thiết lập AWS Budgets ở các mốc 25/50/75/90%;
- đặt Supabase ở region gần Singapore, dùng pooler connection string cho Lambda;
- sao lưu PostgreSQL hằng ngày sang S3 và diễn tập restore;
- thêm WAF/rate limit, log retention và cảnh báo lỗi;
- giữ domain, ACM certificate và parameter tách biệt theo environment;
- chạy smoke test và kiểm tra alarm sau mỗi production deploy.

Trong giai đoạn 100–300 sinh viên đồng thời, mỗi API Lambda container chỉ mở một
database connection, API Gateway có rate/burst guardrail và ảnh câu hỏi đi
thẳng qua CloudFront. Không đặt reserved concurrency khi quota account còn thấp;
mức 200 người đã được xác minh, còn mốc 300 cần tăng quota Lambda và test lại.
Chi tiết nằm trong `docs/project-status.md`, `docs/load-testing.md` và
`docs/capacity-runbook.md`.

Trong development, pipeline AI dùng hàng đợi nền có giới hạn concurrency. Khi
`AI_SUGGESTION_QUEUE_URL` được cấu hình, API chuyển sang producer SQS. Worker
kiểm tra JSON có cấu trúc và lưu `suggested/failed`; browser không nhận khóa
provider. Chi tiết vận hành nằm trong `docs/ai-answer-suggestions.md`.

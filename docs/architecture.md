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
- Onboarding lưu vào bảng `users`, kiểm tra MSSV/email unique, lấy campus/ngành
  từ database và lấy role từ server. Catalog/exam/attempt API yêu cầu người dùng
  đã hoàn tất hồ sơ.

## Ranh giới hệ thống

```text
React/Vite
   │
   ▼
CloudFront ── S3 web
   │
   ▼
API Gateway ── Lambda/Hono ── Supabase PostgreSQL
                         ├── S3 question images
                         ├── SQS import jobs ── AI Vision provider
                         └── Cognito / payOS webhook
```

## Quy tắc bất biến

- Một người dùng chỉ có một attempt `in_progress`.
- `expiresAt` từ server là nguồn thời gian chính thức; client chỉ hiển thị countdown.
- Autosave dùng `sequence` tăng dần để request đến muộn không ghi đè đáp án mới.
- Submit là idempotent.
- Attempt luôn trỏ tới một `exam_revision`; sửa đáp án không làm đổi điểm lịch sử.
- Đề chỉ được publish khi revision đã có người duyệt.
- Gợi ý AI chỉ nằm trong `ai_metadata`; không được dùng làm đáp án chính thức
  trước khi người duyệt áp dụng và lưu.
- Chỉ Admin được approve revision và publish; Contributor chỉ nhập/duyệt đáp án.
- Chỉ Admin được khởi tạo batch AI vì thao tác có thể phát sinh chi phí.
- Người dùng có thể tạo attempt mới không giới hạn trong giai đoạn ra mắt;
  attempt đang hoạt động vẫn được resume trên cùng thiết bị.
- Ảnh gốc và ảnh phát hành dùng object key bất biến, checksum để chống trùng.

## Chi phí AWS và Supabase

Supabase PostgreSQL Free là database cho closed beta, kết nối từ Lambda chỉ qua
`DATABASE_URL` đọc lúc cold start từ SSM Parameter Store SecureString. CDK không còn provision Aurora hay
VPC, tránh chi phí nền không cần thiết. S3 private qua CloudFront OAC, SQS có
DLQ và tài nguyên dev có thể xóa. Trước khi deploy production cần:

- thiết lập AWS Budgets ở các mốc 25/50/75/90%;
- đặt Supabase ở region gần Singapore, dùng pooler connection string cho Lambda;
- sao lưu PostgreSQL hằng ngày sang S3 và diễn tập restore;
- thêm WAF/rate limit, log retention và cảnh báo lỗi;
- cấu hình domain production, ACM certificate và secrets theo environment;
- nối Lambda/API Gateway và worker vào các package ứng dụng.

Trong development, pipeline AI dùng hàng đợi nền có giới hạn concurrency. Khi
`AI_SUGGESTION_QUEUE_URL` được cấu hình, API chuyển sang producer SQS. Worker
kiểm tra JSON có cấu trúc và lưu `suggested/failed`; browser không nhận khóa
provider. Chi tiết vận hành nằm trong `docs/ai-answer-suggestions.md`.

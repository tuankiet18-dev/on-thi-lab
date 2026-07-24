# Kiến trúc OnThiLab

## Mục tiêu của vertical slice

Phiên bản khởi tạo chứng minh trọn vẹn một luồng quan trọng:

1. Sinh viên duyệt danh mục và lọc theo campus/kỳ học.
2. Sinh viên xem quy định của đề FE.
3. Hệ thống tạo hoặc khôi phục một attempt đang làm.
4. Câu trả lời được lưu sau mỗi thay đổi; timer không thể tạm dừng.
5. Hệ thống nộp thủ công hoặc tự nộp khi hết giờ.
6. Kết quả dùng exact-match cho câu nhiều đáp án và thang điểm 10.

Onboarding đã dùng API Hono và PostgreSQL làm nguồn dữ liệu chính. Exam engine
demo vẫn dùng local storage để có thể chạy độc lập; bước tiếp theo là thay
adapter attempt/catalog bằng HTTP client và repository production.

## Luồng xác thực development

```text
React SPA
  └── Authorization Code + PKCE
        └── Cognito Managed Login
              ├── Google OAuth
              └── Cognito email/password
```

- Google client secret chỉ tồn tại trong AWS Secrets Manager tại
  `/onthilab/dev/google/oauth`.
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
API Gateway ── Lambda/Hono ── Aurora PostgreSQL (Data API)
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
- Ảnh gốc và ảnh phát hành dùng object key bất biến, checksum để chống trùng.

## Chi phí AWS

Aurora PostgreSQL Serverless v2 đã được chọn cho staging/production. CDK mặc
định đặt cluster ở 0.5–2 ACU, S3 private qua CloudFront OAC, SQS có DLQ và tài
nguyên dev có thể xóa. Chưa tạo cluster trước khi pipeline nhập đề sẵn sàng để
tránh tiêu credit trong giai đoạn phát triển local. Trước khi deploy production
cần:

- thiết lập AWS Budgets ở các mốc 25/50/75/90%;
- load test và tinh chỉnh khoảng ACU theo traffic thật;
- thêm WAF/rate limit, log retention và cảnh báo lỗi;
- cấu hình domain production, ACM certificate và secrets theo environment;
- nối Lambda/API Gateway và worker vào các package ứng dụng.

# Kiến trúc OnThiLab

## Mục tiêu của vertical slice

Phiên bản khởi tạo chứng minh trọn vẹn một luồng quan trọng:

1. Sinh viên duyệt danh mục và lọc theo campus/kỳ học.
2. Sinh viên xem quy định của đề FE.
3. Hệ thống tạo hoặc khôi phục một attempt đang làm.
4. Câu trả lời được lưu sau mỗi thay đổi; timer không thể tạm dừng.
5. Hệ thống nộp thủ công hoặc tự nộp khi hết giờ.
6. Kết quả dùng exact-match cho câu nhiều đáp án và thang điểm 10.

UI hiện dùng local storage để có thể chạy độc lập. API Hono đã cung cấp cùng semantics cho create/resume, autosave và submit; bước tiếp theo là thay adapter local bằng HTTP client.

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

CDK mặc định đặt Aurora Serverless v2 ở 0.5–2 ACU, S3 private qua CloudFront OAC, SQS có DLQ và tài nguyên dev có thể xóa. Trước khi deploy production cần:

- thiết lập AWS Budgets ở các mốc 25/50/75/90%;
- quyết định Aurora Serverless v2 hay PostgreSQL managed khác dựa trên traffic thật;
- thêm WAF/rate limit, log retention và cảnh báo lỗi;
- cấu hình Google IdP, domain, ACM certificate và secrets;
- nối Lambda/API Gateway và worker vào các package ứng dụng.

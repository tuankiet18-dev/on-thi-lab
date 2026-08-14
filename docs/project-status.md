# OnThiLab project status

> Cập nhật lần cuối: **14/08/2026 (Asia/Ho_Chi_Minh)**
>
> Trạng thái phát hành: **Production MVP đang hoạt động**

Tài liệu này ghi nhận trạng thái triển khai đã được xác minh, giới hạn hiện tại
và các việc ưu tiên tiếp theo. Chi tiết nghiệp vụ nằm trong `spec.md`; cách vận
hành nằm trong `docs/runbook.md`.

## Environments

| Môi trường | URL                                                      | Trạng thái | Mục đích              |
| ---------- | -------------------------------------------------------- | ---------- | --------------------- |
| Production | [onthilab.id.vn](https://onthilab.id.vn)                 | Active     | Người dùng thật       |
| Staging    | [staging.onthilab.id.vn](https://staging.onthilab.id.vn) | Active     | UAT, OCR và load test |
| Local      | `http://localhost:5173`                                  | Supported  | Phát triển web/API    |

Production gần nhất đã được xác minh bằng CloudFormation `UPDATE_COMPLETE`, API
health HTTP 200, web và SPA route HTTP 200, cùng CloudFront invalidation hoàn
tất.

## Feature status

| Nhóm                               | Trạng thái | Ghi chú                                                     |
| ---------------------------------- | ---------- | ----------------------------------------------------------- |
| Cognito, Google và email login     | Stable     | Authorization Code + PKCE; profile yêu cầu campus           |
| Danh mục môn và kho đề             | Stable     | Quản lý theo môn; lọc campus và kỳ học                      |
| Import nhiều ZIP                   | Stable     | Số câu và tên ảnh linh hoạt; hỗ trợ `answers.json`          |
| Duyệt đáp án và publish            | Stable     | Đáp án gợi ý phải qua quy tắc review                        |
| OCR và hybrid image/text           | Stable     | Có fallback ảnh theo từng câu                               |
| Làm bài, autosave và submit        | Stable     | Sequence đơn điệu, submit idempotent, attempt theo revision |
| Xem đề, kết quả, lịch sử, thống kê | Stable     | Đáp án chỉ xuất hiện theo đúng quyền/ trạng thái            |
| Bookmark, report và feedback       | Stable     | Có attention count cho công việc quản trị chưa xử lý        |
| Monetization/payOS                 | Disabled   | Chưa nằm trong public MVP                                   |
| Flashcard                          | Deferred   | Không thuộc release hiện tại                                |

## Production topology

- React SPA trên S3 private và CloudFront.
- API Gateway gọi Hono API trên Lambda Node.js 22.
- Supabase PostgreSQL; Lambda dùng transaction pooler và tối đa một connection
  trên mỗi container.
- Ảnh câu hỏi đi qua CloudFront riêng, không đi qua API Lambda.
- SQS + Lambda worker xử lý OCR/import; OCR worker có DLQ và concurrency giới
  hạn.
- Cognito quản lý đăng nhập; cấu hình server-side đọc từ SSM Parameter Store.
- CloudWatch lưu access/application logs và theo dõi error, throttle,
  concurrency, latency.

## Quality snapshot

Release ngày 14/08/2026 đạt:

- `pnpm validate`: format, TypeScript, **130 tests** và production build đều
  thành công.
- Migration `0007_parched_amazoness.sql` đã được áp dụng cho production.
- Smoke test production: API `/health`, trang chủ và `/login` đều HTTP 200.
- Frontend build còn cảnh báo bundle JavaScript xấp xỉ 1 MB; đây là khoản nợ
  hiệu năng, không phải lỗi phát hành.

## Capacity snapshot

Load test chỉ chạy trên staging với luồng catalog → attempt → session → autosave
→ submit.

| Concurrent users | Request error rate | API p95 | Autosave p95 | Kết luận                      |
| ---------------: | -----------------: | ------: | -----------: | ----------------------------- |
|               10 |              0.00% |  242 ms |       218 ms | Đạt                           |
|               50 |              0.00% |  188 ms |       180 ms | Đạt                           |
|              100 |              0.03% |  178 ms |       175 ms | Đạt ngưỡng                    |
|              200 |              0.02% |  173 ms |       171 ms | Đạt mục tiêu hiện tại         |
|              300 |              0.29% |  172 ms |       169 ms | Chưa đạt do Lambda throttling |

Ở mốc 300, 42 phản hồi lỗi trùng với 42 lần Lambda throttle khi account
concurrency chạm quota 10. Không thấy deadlock/conflict database và submit không
lỗi. Đây là giới hạn quota AWS, nhưng vẫn phải tăng quota và chạy lại staging
trước khi công bố hỗ trợ 300 người đồng thời.

## Open risks and next priorities

1. **P0 trước đợt traffic lớn:** tăng Lambda account concurrency tối thiểu 50,
   khuyến nghị 100; chạy lại bài test 300 users.
2. **P1 vận hành:** nối CloudWatch alarms với kênh nhận cảnh báo có người trực và
   diễn tập xử lý một alarm trên staging.
3. **P1 dữ liệu:** xác minh lịch backup Supabase và diễn tập restore; ghi nhận
   RPO/RTO thực tế.
4. **P1 release:** tự động hóa smoke test auth → mở đề → autosave → resume →
   submit sau deploy.
5. **P2 hiệu năng web:** code-split theo route để giảm bundle tải ban đầu.
6. **Theo dõi tăng trưởng:** giữ Supabase Free khi tải còn thấp; chỉ nâng cấp sau
   khi query/index đã tối ưu và CPU, RAM hoặc connections vượt 70% liên tục.

## Release decision

Production hiện phù hợp để vận hành public MVP miễn phí ở traffic thấp đến vừa.
Mức chịu tải đã xác minh là khoảng **200 sinh viên đồng thời** theo workload
staging. Không chạy load test trực tiếp trên production.

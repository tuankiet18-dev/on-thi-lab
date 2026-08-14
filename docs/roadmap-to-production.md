# OnThiLab delivery roadmap

Roadmap này mô tả hướng phát triển sau khi Production MVP đã hoạt động. Phạm
vi nghiệp vụ chi tiết lấy từ `spec.md`; trạng thái release thực tế lấy từ
`docs/project-status.md`.

## Product direction

- Duy trì public MVP miễn phí và không giới hạn lượt làm bài.
- Quản lý nội dung theo **môn → các đề**, không phụ thuộc vào việc admin phải
  biết toàn bộ chương trình đào tạo.
- Phát hành dữ liệu dần: danh mục có thể đầy đủ trước, đề chỉ xuất hiện sau khi
  đã review.
- Monetization/payOS mặc định tắt; chỉ đánh giá lại khi sản phẩm có dữ liệu sử
  dụng đủ tin cậy.
- Flashcard và dữ liệu Quizlet được hoãn để ưu tiên độ ổn định của exam engine.

## Completed foundation

| Capability                          | Trạng thái | Release evidence                                    |
| ----------------------------------- | ---------- | --------------------------------------------------- |
| Auth, Google/email, profile và RBAC | Done       | Cognito + JWT server validation                     |
| Danh mục môn và kho đề              | Done       | Search/filter theo môn, campus, kỳ                  |
| Import nhiều ZIP và chống trùng     | Done       | Ảnh tên tùy ý, số câu linh hoạt, `answers.json`     |
| Review đáp án và publish            | Done       | Audit, review gate, immutable revision              |
| OCR/hybrid                          | Done       | Text hợp lệ; fallback ảnh theo câu                  |
| Exam engine                         | Done       | Timer server, monotonic autosave, idempotent submit |
| Student review tools                | Done       | Preview, result, history, stats, bookmark           |
| Moderation                          | Done       | Report, feedback, admin attention count             |
| Staging và production serverless    | Done       | S3/CloudFront, API Gateway/Lambda, SQS, Supabase    |
| Capacity guardrails cho public MVP  | Done       | CloudWatch alarms, API throttle, DB connection cap  |

## Current release track

### R1 — Reliability before growth

Mục tiêu: xác minh 300 sinh viên đồng thời mà không có Lambda throttle.

- Tăng Lambda account concurrency quota tối thiểu 50, khuyến nghị 100.
- Chạy lại load test 300 users trên staging.
- Nối CloudWatch alarms với kênh thông báo có người trực.
- Tự động hóa post-deploy smoke test của critical exam flow.

Exit gate: error rate dưới 1%, submit error dưới 0,1%, không Lambda throttle và
không mất đáp án đã nhận HTTP 200.

### R2 — Data safety and operations

Mục tiêu: có bằng chứng khôi phục được hệ thống khi dữ liệu hoặc release gặp sự
cố.

- Xác minh backup schedule của Supabase.
- Diễn tập restore staging và ghi nhận RPO/RTO thực tế.
- Diễn tập rollback một release ứng dụng.
- Hoàn thiện owner/escalation cho report, feedback và queue lỗi.

Exit gate: restore/rollback drill có biên bản và không dựa vào thao tác chưa
được kiểm chứng.

### R3 — Performance and product learning

Mục tiêu: cải thiện thời gian tải và thu thập dữ liệu sử dụng trước khi mở rộng
phạm vi.

- Code-split frontend theo route, giảm initial JavaScript bundle.
- Theo dõi search → exam detail → attempt → submit funnel.
- Đánh giá chất lượng OCR/review theo môn và layout ảnh.
- Chỉ nâng Supabase sau khi đã kiểm tra query/index và metrics vượt guardrail.

### R4 — Optional expansion

- Flashcard nếu dữ liệu và quyền sử dụng nguồn đã rõ.
- Monetization/payOS qua feature flag sau khi có quyết định sản phẩm.
- Nội dung PE chỉ khi có engine và review workflow riêng phù hợp.

## Data waves

| Wave |  Kỳ | Số môn định hướng | Ghi chú                    |
| ---- | --: | ----------------: | -------------------------- |
| 1    | 1–3 |                15 | Nguồn dữ liệu launch chính |
| 2    | 4–5 |                10 | Mở sau khi Wave 1 ổn định  |
| 3    | 6–7 |                 7 | Xác minh môn project/OJT   |
| 4    | 8–9 |                 9 | Hoàn thiện dần catalog     |

Các môn lab, project hoặc thiên thực hành phải được đánh dấu cần review. Public
MVP chỉ phát hành đề FE trắc nghiệm đã qua duyệt.

## Release gates

- Không còn lỗi P0/P1 đã biết trong phạm vi release.
- `pnpm validate` đạt và migration có kế hoạch tương thích/rollback.
- Staging smoke test critical path đạt.
- Capacity không vượt mức đã xác minh trong `project-status.md`.
- API health, CloudFormation và CloudFront invalidation được kiểm tra sau deploy.
- Release thay đổi persistence/infra phải cập nhật runbook liên quan.

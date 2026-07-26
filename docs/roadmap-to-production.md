# OnThiLab — Roadmap to production

Roadmap này là tài liệu điều phối triển khai. Product scope chi tiết và các quyết
định nghiệp vụ vẫn lấy từ `spec.md`.

## Mốc phát hành

- Production MVP miễn phí: mục tiêu trước ngày 06/01/2027.
- Catalog launch: đủ 41 môn ưu tiên, kể cả môn chưa có đề.
- Data launch: tối thiểu 20–30 đề đã duyệt, bao phủ ít nhất 8–10 môn kỳ 1–3.
- Monetization: mặc định tắt; chỉ đánh giá bật sau 3 tháng hoặc 1.000 MAU.

## Trạng thái phase

| Phase | Phạm vi                                         | Trạng thái  | Exit gate                                      |
| ----- | ----------------------------------------------- | ----------- | ---------------------------------------------- |
| 0     | Config, flags, seed, CI, tài liệu vận hành      | Done        | `pnpm validate`, CDK synth và E2E đạt          |
| 1     | PostgreSQL persistence và API thật              | Done        | Không còn in-memory API trong luồng production |
| 2     | Cognito, Google OAuth, onboarding, RBAC         | Done        | Auth/RBAC integration tests đạt                |
| 3     | ZIP, S3, SQS, AI Vision, review, publish        | In progress | Import và duyệt được đề tối thiểu 60 ảnh       |
| 4     | Exam engine production                          | In progress | Autosave/timeout/idempotency/concurrency đạt   |
| 5     | History, stats, bookmark, report, admin         | Planned     | Acceptance criteria User/Admin đạt             |
| 6     | AWS/Supabase staging/prod, CI/CD, observability | In progress | Staging deploy/rollback/restore đạt            |
| 7     | Security, legal, launch data, closed beta       | Planned     | Không còn P0/P1, UAT đạt                       |
| 8     | Production rollout và payOS feature flag        | Planned     | Go-live checklist và smoke test đạt            |

Phase 2 đã có Cognito User Pool, Google IdP, email/password,
Authorization Code + PKCE, refresh/logout, JWT middleware ở API và persistence
hồ sơ PostgreSQL. API yêu cầu onboarding trước khi truy cập catalog/exam/attempt
và role được trả từ database. Guard contributor/admin đã được áp dụng trên API
nhập đề và có integration test RBAC.

Phase 3 đã có validator ZIP an toàn, giải nén đúng 60 ảnh, checksum bất biến,
multipart API tạo exam/revision/question ở trạng thái draft và storage adapter
local để kiểm thử. Contributor/Admin có thể duyệt từng đáp án, chọn dạng một
hoặc nhiều đáp án, xem tiến độ 60 câu và chuyển đề sang trạng thái `review`.
Mọi lần sửa đáp án đều có audit trước/sau. Pipeline gợi ý đáp án AI đã có
provider server-side, validation JSON, trạng thái queued/processing/suggested/
failed/confirmed, local concurrency queue, SQS producer và UI Admin xác nhận
chi phí. AI không ghi thẳng đáp án; người duyệt phải áp dụng và lưu từng câu.
Admin đã có bước xác nhận cuối, khóa revision và xuất bản đề vào catalog. Phần
còn lại của phase là presigned S3 và deploy SQS consumer worker trên AWS.

Phase 4 đã thay catalog và exam demo bằng API PostgreSQL. Attempt lưu revision,
thứ tự câu đã trộn, timer server, autosave có sequence, submit idempotent và
exact-match score. Đáp án đúng chỉ được trả về sau khi nộp. Free user bị giới
hạn tối đa 2 lượt mới mỗi ngày; subscription đang active không áp dụng giới hạn
này. Còn lại là integration/load test concurrency và lịch sử làm bài.

Phase 6 dùng Supabase PostgreSQL thay Aurora Serverless để phù hợp closed beta.
AWS vẫn là lớp deploy: CloudFront/S3 cho web, API Gateway/Lambda cho API, S3
private cho ảnh đề, SQS/DLQ cho tác vụ nền, SSM Parameter Store SecureString
cho database connection string và Secrets Manager cho Google OAuth. Domain production là `onthilab.id.vn`; database, auth và ứng dụng web
được tách staging/prod, trong giới hạn hai Supabase Free project.

## Data waves

| Wave |  Kỳ | Số môn | Ghi chú                             |
| ---- | --: | -----: | ----------------------------------- |
| 1    | 1–3 |     15 | Nguồn dữ liệu launch chính          |
| 2    | 4–5 |     10 | Mở ngay sau khi Wave 1 ổn định      |
| 3    | 6–7 |      7 | Xác minh format với môn project/OJT |
| 4    | 8–9 |      9 | Hoàn thiện toàn bộ catalog          |

Các môn lab, project hoặc thiên thực hành được gắn
`exam_format_status=requires_review`. Chỉ đề FE trắc nghiệm được publish trong
MVP; môn không có FE vẫn xuất hiện trong catalog với trạng thái phù hợp.

## Go/no-go production

- Không còn lỗi P0 hoặc P1.
- Submit thành công tối thiểu 99,9% trong load test.
- Chịu được 200 lượt thi đồng thời theo workload đã chốt.
- Backup restore thử thành công; RTO không quá 4 giờ và RPO không quá 15 phút.
- Budget alerts, logs, alarms và support channel hoạt động.
- Terms, Privacy, disclaimer và content removal flow đã public.
- Có rollback runbook và một lần diễn tập rollback trên staging.

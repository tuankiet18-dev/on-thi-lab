# OnThiLab — Roadmap to production

Roadmap này là tài liệu điều phối triển khai. Product scope chi tiết và các quyết
định nghiệp vụ vẫn lấy từ `spec.md`.

## Mốc phát hành

- Production MVP miễn phí: mục tiêu trước ngày 06/01/2027.
- Catalog launch: đủ 41 môn ưu tiên, kể cả môn chưa có đề.
- Data launch: tối thiểu 20–30 đề đã duyệt, bao phủ ít nhất 8–10 môn kỳ 1–3.
- Monetization: mặc định tắt; chỉ đánh giá bật sau 3 tháng hoặc 1.000 MAU.

## Trạng thái phase

| Phase | Phạm vi                                    | Trạng thái  | Exit gate                                      |
| ----- | ------------------------------------------ | ----------- | ---------------------------------------------- |
| 0     | Config, flags, seed, CI, tài liệu vận hành | Done        | `pnpm validate`, CDK synth và E2E đạt          |
| 1     | PostgreSQL persistence và API thật         | Planned     | Không còn in-memory API trong luồng production |
| 2     | Cognito, Google OAuth, onboarding, RBAC    | In progress | Auth/RBAC integration tests đạt                |
| 3     | ZIP, S3, SQS, AI Vision, review, publish   | Planned     | Import và duyệt được đề tối thiểu 60 ảnh       |
| 4     | Exam engine production                     | Planned     | Autosave/timeout/idempotency/concurrency đạt   |
| 5     | History, stats, bookmark, report, admin    | Planned     | Acceptance criteria User/Admin đạt             |
| 6     | AWS staging/prod, CI/CD, observability     | Planned     | Staging deploy/rollback/restore đạt            |
| 7     | Security, legal, launch data, closed beta  | Planned     | Không còn P0/P1, UAT đạt                       |
| 8     | Production rollout và payOS feature flag   | Planned     | Go-live checklist và smoke test đạt            |

Phase 2 development đã có Cognito User Pool, Google IdP, email/password,
Authorization Code + PKCE, refresh/logout và onboarding UI. Phần còn lại của
exit gate là JWT middleware ở API, persistence hồ sơ và phân quyền
user/contributor/admin bằng integration test.

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

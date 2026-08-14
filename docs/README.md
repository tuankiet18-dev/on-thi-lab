# OnThiLab documentation

Đây là mục lục chính cho tài liệu dự án. Bắt đầu từ tài liệu phù hợp với công
việc đang làm thay vì đọc toàn bộ thư mục `docs`.

## Source of truth

| Cần biết                                  | Tài liệu                                                |
| ----------------------------------------- | ------------------------------------------------------- |
| Hệ thống đang chạy đến đâu, còn rủi ro gì | [Project status](project-status.md)                     |
| Phạm vi và quyết định nghiệp vụ           | [Product specification](../spec.md)                     |
| Kiến trúc và các invariant                | [Architecture](architecture.md)                         |
| Tìm đúng module để sửa code               | [Source code map](code-map.md)                          |
| Deploy, smoke test và rollback            | [Operations runbook](runbook.md)                        |
| Cấu hình môi trường và nơi lưu credential | [Secrets and environments](secrets-and-environments.md) |
| Khả năng chịu tải và xử lý giờ cao điểm   | [Capacity runbook](capacity-runbook.md)                 |

Khi nội dung xung đột, ưu tiên contract/code đang chạy cho chi tiết kỹ thuật,
`spec.md` cho nghiệp vụ, và `project-status.md` cho trạng thái triển khai.

## Product

- [Giới thiệu dự án](about.md)
- [Product specification](../spec.md)
- [Roadmap](roadmap-to-production.md)
- [Định dạng ZIP nhập đề](import-zip-format.md)
- [Gợi ý đáp án AI](ai-answer-suggestions.md)

## Engineering

- [Kiến trúc hệ thống](architecture.md)
- [Source code map](code-map.md)
- [ADR 0001 — Modular monolith](adr/0001-modular-monolith.md)
- [ADR 0002 — Versioned exam attempts](adr/0002-versioned-exam-attempts.md)
- [API module convention](../apps/api/src/modules/README.md)
- [Web feature convention](../apps/web/src/features/README.md)

## Quality and contribution

- [Contribution and Git workflow](../CONTRIBUTING.md)
- [Definition of Done](definition-of-done.md)
- [Load testing](load-testing.md)

## Operations

- [Project status](project-status.md)
- [Staging and production runbook](runbook.md)
- [Secrets and environments](secrets-and-environments.md)
- [Capacity runbook](capacity-runbook.md)

## Maintenance rules

- Cập nhật `project-status.md` sau mỗi release production hoặc load test quan
  trọng.
- Cập nhật runbook trong cùng pull request khi lệnh deploy/rollback thay đổi.
- Ghi quyết định kiến trúc dài hạn bằng ADR mới; không sửa lịch sử của ADR đã
  accepted.
- Không đưa secret, token, ARN nhạy cảm, connection string hoặc dữ liệu cá nhân
  vào tài liệu.
- Dùng liên kết tương đối để tài liệu hoạt động trên GitHub và local.

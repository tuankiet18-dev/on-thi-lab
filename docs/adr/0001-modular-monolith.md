# ADR 0001 — Modular monolith

- Status: Accepted
- Date: 2026-07-23

## Decision

API OnThiLab là một modular monolith Hono chạy trên AWS Lambda. Các module dùng
chung contract và database nhưng có ranh giới domain rõ ràng.

## Reason

Một người phát triển có thể deploy, quan sát và thay đổi hệ thống nhanh hơn so
với microservices. SQS/Lambda chỉ được tách cho tác vụ dài hoặc bất đồng bộ như
xử lý ZIP, ảnh và AI.

## Consequences

- Không gọi HTTP nội bộ giữa các module.
- Transaction nghiệp vụ có thể dùng chung PostgreSQL.
- Chỉ tách service khi có dữ liệu vận hành chứng minh nhu cầu.

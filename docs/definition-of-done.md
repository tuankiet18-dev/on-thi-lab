# Definition of Done

Một thay đổi chỉ được coi là hoàn thành khi thỏa các điều kiện áp dụng dưới đây.

## Code

- Không có secret, dữ liệu cá nhân hoặc credential trong source/log/test fixture.
- Request/response công khai có Zod contract và validation.
- Database change có migration tiến, seed idempotent và kế hoạch rollback.
- Mọi thao tác ghi quan trọng có transaction hoặc idempotency strategy.
- Feature chưa production-ready được bảo vệ bằng flag mặc định tắt.

## Tests

- Unit test cho domain rules và edge cases.
- Integration test cho database/API khi thay đổi persistence.
- E2E cho critical path khi thay đổi UI hoặc exam/payment flow.
- `pnpm format:check`, `pnpm typecheck`, `pnpm test` và `pnpm build` đều đạt.
- Không có browser console error trong E2E critical path.

## Security và privacy

- API thực thi authorization phía server, không dựa vào việc ẩn UI.
- Log mask token, email, MSSV, bank account và payment signature.
- Upload kiểm tra loại file, kích thước, checksum và đường dẫn.
- Webhook xác minh signature trước khi thay đổi trạng thái.
- Chỉ thu thập dữ liệu tối thiểu cần cho sản phẩm.

## Operations

- Có metric/log đủ để phát hiện và chẩn đoán lỗi.
- Có runbook hoặc ghi chú rollback cho thay đổi rủi ro cao.
- Cấu hình development, staging và production không dùng chung secret.
- Tài liệu vận hành và acceptance criteria được cập nhật cùng thay đổi.

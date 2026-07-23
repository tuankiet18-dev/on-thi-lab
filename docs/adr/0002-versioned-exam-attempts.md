# ADR 0002 — Versioned exam attempts

- Status: Accepted
- Date: 2026-07-23

## Decision

Mỗi attempt trỏ tới một `exam_revision` và giữ snapshot thứ tự câu cùng đáp án
dùng để chấm. Chỉnh đáp án hoặc publish revision mới không thay đổi kết quả cũ.

## Consequences

- Submit phải idempotent.
- Autosave dùng sequence tăng dần.
- Report có thể tạo revision mới nhưng không tính lại điểm lịch sử.
- Không xóa revision đã được attempt tham chiếu.

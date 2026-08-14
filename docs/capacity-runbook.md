# Capacity runbook

Runbook này áp dụng cho mục tiêu 100–300 sinh viên đồng thời trong giai đoạn
Supabase Free.

## Guardrails hiện tại

- API Lambda dùng concurrency quota chung của tài khoản. Không đặt reserved
  concurrency khi quota tài khoản còn thấp vì AWS luôn yêu cầu chừa ít nhất 10
  execution không dành riêng.
- Mỗi Lambda/worker giữ tối đa một database connection.
- API Gateway giới hạn 80 request/giây, burst 160.
- OCR worker tối đa 3 execution đồng thời và có DLQ.
- Ảnh câu hỏi mới được trả qua CloudFront riêng thay vì đi qua Lambda.
- Autosave gộp thay đổi cùng câu; autosave và submit retry lỗi mạng, 429, 5xx
  có jitter. Submit có thể retry an toàn vì API giữ tính idempotent.

`DATABASE_URL` trên staging/prod phải là Supabase transaction pooler URL cổng
6543 và tiếp tục dùng `prepare=false`.

Mức đã xác minh gần nhất là 200 sinh viên đồng thời. Bài test 300 users chạm
account concurrency quota 10 và tạo Lambda throttle; không công bố mốc 300 là
đã hỗ trợ cho tới khi quota được tăng và test lại đạt.

## Trước giờ cao điểm

1. Xác nhận `/health` trả HTTP 200.
2. Kiểm tra Lambda account concurrency quota. Với mục tiêu 300 sinh viên phải
   yêu cầu quota tối thiểu 50; đợt load test phải xác nhận mức thực tế trước khi
   mở traffic.
3. Kiểm tra CloudWatch không có alarm đang đỏ và OCR/import queue không tồn.
4. Kiểm tra Supabase Database Health: CPU, RAM, connections và disk.
5. Không import/OCR hàng loạt trong thời gian sinh viên đang thi.
6. Chạy smoke test: login, mở đề, lưu 2 câu, reload/resume và submit.

## Khi tải tăng

- `ApiLambdaConcurrencyAlarm`: kiểm tra request rate; không tăng concurrency
  trước khi xác nhận DB còn connection và CPU.
- `ApiLambdaThrottleAlarm`: giữ giới hạn để bảo vệ DB; kiểm tra client nhận 429
  và autosave retry thành công.
- `ApiGatewayLatencyAlarm`: tách latency API khỏi thời gian tải ảnh; kiểm tra
  query chậm trong Supabase.
- `ApiGatewayServerErrorAlarm`: tìm theo request ID trong API access log và
  Lambda log.

Nếu CPU/RAM hoặc connections của Supabase vượt 70% liên tục, tạm dừng thao tác
admin nặng. Chỉ nâng lên Pro/Small sau khi query/index và connection pool đã
được kiểm tra bằng load test.

## Sau sự cố

Không xóa dữ liệu attempt để khôi phục giao diện. Lưu khoảng thời gian, request
ID, alarm, k6 summary và Supabase metrics; rollback phiên bản ứng dụng nếu lỗi
bắt đầu ngay sau deploy. Submission vẫn phải idempotent và sequence autosave
vẫn phải tăng đơn điệu sau mọi thay đổi.

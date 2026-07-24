# Gợi ý đáp án AI

## Nguyên tắc an toàn

- AI chỉ ghi đề xuất vào `questions.ai_metadata`.
- Gợi ý không làm tăng `answeredCount` và không được dùng để chấm điểm.
- Người duyệt phải mở ảnh, bấm **Áp dụng vào biểu mẫu**, kiểm tra và lưu.
- Chỉ thao tác lưu của người duyệt mới cập nhật `correct_options`.
- Chỉ Admin được khởi tạo batch AI vì thao tác có thể phát sinh chi phí.
- Đề vẫn phải đi qua `ready` và bước xác nhận xuất bản của Admin.

## Luồng xử lý

```text
Admin xác nhận chi phí
  → API tìm các câu chưa có đáp án
  → đánh dấu queued trong PostgreSQL
  → local: hàng đợi nền, số ảnh đồng thời theo AI_LOCAL_CONCURRENCY
     AWS: SQS, tối đa 10 message mỗi batch
  → worker đọc ảnh server-side
  → provider Vision trả JSON có cấu trúc
  → worker kiểm tra loại câu, số lựa chọn, chỉ số và confidence
  → lưu suggested hoặc failed vào ai_metadata
  → UI polling trong khi còn queued/processing
  → người duyệt áp dụng và lưu → confirmed
```

Không đưa ảnh hoặc API key xuống browser. Ảnh được API/worker đọc từ storage và
gửi trực tiếp đến provider.

## Cấu hình local

Thêm các biến sau vào `.env.local`:

```dotenv
FEATURE_AI_IMPORT_ENABLED=true
AI_PROVIDER=groq
AI_BASE_URL=https://api.groq.com/openai/v1
AI_MODEL=<vision-model-name>
AI_API_KEY=<server-only-key>
AI_LOCAL_CONCURRENCY=1
```

Không đặt tên biến khóa AI với tiền tố `VITE_`. Khi
`AI_SUGGESTION_QUEUE_URL` để trống, API chạy hàng đợi nền local. Đây là chế độ
phù hợp để duyệt đề SWD392 hiện tại.

## Cấu hình AWS

CDK xuất `AiSuggestionQueueUrl`. Đặt output này vào
`AI_SUGGESTION_QUEUE_URL`; API sẽ gửi message theo batch SQS thay vì tự gọi
provider. Queue đã có DLQ, mã hóa do SQS quản lý, visibility timeout 5 phút và
retry tối đa 3 lần.

Trước khi bật trên production cần deploy consumer worker có quyền đọc bucket
ảnh, đọc secret AI và ghi Aurora. Không bật flag nếu consumer chưa hoạt động,
vì message sẽ chỉ nằm trong queue.

## Vận hành và chi phí

- Bắt đầu với concurrency 1 và một đề thử. Với Groq Free/On-demand, provider
  giới hạn output ở 256 token, tắt reasoning của Qwen 3.6 và tự chờ theo header
  `retry-after`.
- Theo dõi số câu `failed`; nút chạy lại chỉ queue câu chưa có đáp án hoặc lỗi.
- `queued`, `processing`, `suggested` và `confirmed` không bị queue trùng.
- Không log API key, data URL ảnh hoặc raw response đầy đủ.
- Có thể đổi provider tương thích Chat Completions qua `AI_BASE_URL` mà không
  sửa browser hay schema dữ liệu.

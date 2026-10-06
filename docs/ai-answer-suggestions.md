# Gợi ý đáp án AI

## Nguyên tắc an toàn

- AI chỉ ghi đề xuất vào `questions.ai_metadata`.
- Gợi ý không làm tăng `answeredCount` và không được dùng để chấm điểm.
- Người duyệt phải mở ảnh, kiểm tra gợi ý được điền sẵn và lưu.
- Chỉ thao tác lưu của người duyệt mới cập nhật `correct_options`.
- Chỉ Admin được yêu cầu AI cho câu đang duyệt vì thao tác có thể phát sinh chi
  phí.
- Đề vẫn phải đi qua `ready` và bước xác nhận xuất bản của Admin.

## Luồng xử lý

```text
Admin yêu cầu gợi ý cho câu đang mở
  → browser chỉ gửi examId và questionId
  → API xác nhận câu thuộc phiên bản hiện tại và chưa có đáp án
  → đánh dấu đúng một câu là queued trong PostgreSQL
  → xử lý ngay trong API (local và production hiện tại):
     đọc đúng ảnh của câu đó từ storage ở server-side
     (nhánh SQS chỉ dùng khi đặt AI_SUGGESTION_QUEUE_URL, hiện chưa có consumer)
  → provider Vision trả JSON có cấu trúc
  → hệ thống nhận diện lại loại câu, số lựa chọn và đáp án từ ảnh
  → kiểm tra loại câu, số lựa chọn, chỉ số và confidence
  → cập nhật số lựa chọn của câu nếu AI phát hiện cấu trúc khác
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

Production hiện chạy AI **trong API Lambda**: stack đặt `AI_PROVIDER=groq`,
`AI_MODEL`, `AI_BASE_URL` và `FEATURE_AI_IMPORT_ENABLED=true`, key đọc từ SSM
`/onthilab/prod/ai/api-key` lúc cold start. Không đặt `AI_SUGGESTION_QUEUE_URL`.
Ở production, timeout provider là 20 giây và không retry; thao tác một câu chờ
kết quả rồi mới trả `202`, còn gợi ý cả đề (`queueExam`) không được `await` nên
có thể bị dừng khi Lambda bị đóng băng.

CDK có `ImportQueue` (DLQ, visibility 5 phút, retry 3 lần) và xuất
`AiSuggestionQueueUrl`, nhưng **chưa có consumer nào**. Chỉ đặt
`AI_SUGGESTION_QUEUE_URL` sau khi triển khai worker có quyền đọc bucket ảnh, đọc
parameter AI và ghi Supabase PostgreSQL; nếu không, message sẽ chỉ nằm trong
queue.

Gợi ý chỉ được ghi vào `ai_metadata` (kể cả `optionCount` và `proposedType`).
`type`, `options` và `correct_options` của câu chỉ đổi khi người duyệt lưu và
xác nhận. Một yêu cầu `queued/processing` quá 120 giây (ví dụ Lambda bị timeout)
được coi là bị bỏ dở và có thể yêu cầu lại.

## Vận hành và chi phí

- Bắt đầu với concurrency 1 và một đề thử. Với Groq Free/On-demand, provider
  giới hạn output ở 256 token, tắt reasoning của Qwen 3.6 và tự chờ theo header
  `retry-after`. Cửa sổ chờ dài hơn 90 giây (ví dụ chạm hạn mức token/ngày) sẽ
  được đánh dấu `failed` để thao tác không treo nhiều giờ.
- Nút tạo lại chỉ queue câu đang mở nếu câu chưa có đáp án chính thức.
- Mỗi yêu cầu chỉ gửi đúng ảnh câu đang mở; không gửi toàn bộ đề.
- `queued`, `processing`, `suggested` và `confirmed` không bị queue trùng.
- Không log API key, data URL ảnh hoặc raw response đầy đủ.
- Có thể đổi provider tương thích Chat Completions qua `AI_BASE_URL` mà không
  sửa browser hay schema dữ liệu.

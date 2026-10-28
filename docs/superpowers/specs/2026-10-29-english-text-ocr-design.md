# Tự chuyển câu hỏi tiếng Anh từ ảnh sang text (thay AWS Textract)

## Mục tiêu
Khi import đề, câu hỏi **tiếng Anh** đủ chắc được hiển thị dạng text; mọi câu khác giữ ảnh gốc.
Admin không phải kiểm tra từng câu. Bỏ AWS Textract khỏi kiến trúc.

## Ngoài phạm vi (bước đầu)
Tiếng Việt, chạy lại đề đã có (chỉ khi admin bấm "OCR lại"), VietOCR/PyTorch, mô hình thị giác.

## Hiện trạng giữ nguyên
`import -> OcrQueue -> Worker (Node) -> questions.ocr_metadata`; hybrid hiển thị text chỉ khi `status=approved`,
có `textContent` và 2–6 lựa chọn, ngược lại hiện ảnh. Không đổi bảng, cột, API, giao diện web.
Claim idempotent, reclaim job bị kẹt, retry/DLQ, cache theo `imageHash` vẫn nằm trong worker Node đã có test.

## Thay đổi
1. **Lambda mới `TextOcrFunction`** (`apps/text-ocr-worker/`, Python container, x86_64, 2048 MB, timeout 90 s).
   Không có quyền DB. Chỉ đọc S3 ảnh câu hỏi. Vào: `{key}`; ra:
   `{ status: "approved" | "needs_review", textContent, options[], flagReasons[], confidence }`.
   Mỗi ảnh: tìm khối chữ bằng xử lý ảnh -> hai bộ đọc độc lập (Tesseract eng, PaddleOCR Latin qua RapidOCR) -> cổng tự duyệt.
2. **Cổng tự duyệt** (mọi điều kiện phải đạt, nếu không `needs_review`): hai bộ đọc trùng nhau ở mọi trường;
   cấu trúc A→N liên tục (2–6 lựa chọn); không có code/công thức/hình cạnh phần chữ; không có chỗ trống `____`;
   không có dấu tiếng Việt hay chữ không phải Latin (cờ `non_english`); từ lạ phải được cả hai bộ xác nhận;
   chặn tên có I/l dễ nhầm (camelCase, từ lạ bắt đầu bằng i/I/l/L).
3. **Worker Node** (`apps/worker`): thay Textract + `sharp` + `normalizeQuestionText` bằng một lần gọi `lambda:Invoke`
   tới `TextOcrFunction`. Toàn bộ claim/lưu/retry giữ nguyên. `providerVersion` mới `tesseract-paddle@2026-10`
   (thêm vào `ocrJobSchema`; kết quả Textract cũ không bị dùng lại làm cache).
4. **Bỏ Textract**: xóa `@aws-sdk/client-textract`, quyền `textract:DetectDocumentText`, `ocr-text-normalizer`, `sharp`
   khỏi worker (nếu không còn dùng); cập nhật CDK và tài liệu (`docs/aws-architecture.md`, README).
5. **Hạ tầng**: thêm `TextOcrFunction` vào `onthilab-stack.ts` (image từ thư mục mới, quyền đọc S3, log group),
   cấp `lambda:InvokeFunction` cho worker, thêm biến `TEXT_OCR_FUNCTION_NAME`. `OptionCountWorker` không đổi.

## Lỗi và hồi phục
- Invoke lỗi/timeout: worker chạy đường lỗi hiện có (`scheduleOcrRetry`, DLQ sau 3 lần); câu hiển thị ảnh. Không ảnh hưởng sinh viên.
- Không chắc là đủ lý do để giữ ảnh. Cổng không bao giờ ghi đáp án.

## Kiểm chứng (điều kiện để deploy)
- Test Python cho cổng bằng ảnh tổng hợp (I/l, công thức bên phải, thiếu cấu trúc, chỗ trống, tiếng Việt).
- Test worker Node (processOcrJob) với reader giả; test tích hợp DB hiện có vẫn qua; `pnpm validate`.
- Build image thật rồi chạy trên bộ đối chiếu tiếng Anh (ngoài repo, `~/onthilab-ocr-work/golden*`): không câu nào ngoài
  chữ bị duyệt, độ chính xác của câu duyệt >= mức đã đo (37/37 trên 99 câu tiếng Anh), phủ khoảng 37%.
- `cdk diff` cho prod để bạn xem trước; deploy bằng `scripts/deploy.sh --confirm-production`.

## Rủi ro đã biết
- Base image Lambda của AWS (Amazon Linux) không có Tesseract: dùng base Debian + `awslambdaric`; phiên bản Tesseract có
  thể lệch (đo trên 5.3.4) nên phải chạy lại bộ đối chiếu trên image thật.
- Mẫu đo nhỏ (99 câu tiếng Anh); vài câu sai vẫn có thể hiện text cho sinh viên.
- Thời gian một đề 60 ảnh chưa đo trên Lambda (mỗi ảnh vài giây, chạy song song tối đa 3 worker).

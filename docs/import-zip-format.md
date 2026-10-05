# Định dạng ZIP nhập đề FE

Mỗi ZIP chứa từ 1 đến 120 ảnh câu hỏi (ví dụ 50 hoặc 60 ảnh; cho phép `.jpg`,
`.jpeg`, `.png`, `.webp` và một thư mục gốc tùy ý). Tên ảnh có thể là bất kỳ
chuỗi nào, miễn không trùng trong ZIP. Hệ thống tự gán thứ tự nội bộ theo thứ tự
file trong manifest ZIP; thứ tự tên file không ảnh hưởng đến việc import.

Có thể kèm đúng một `answers.json`. File này được đọc khi import để xác định
đáp án; hệ thống không lưu hoặc trả về tác giả hay nội dung comment. Metadata
`optionCount*` là tùy chọn.

```json
{
  "1775674360012.webp": [
    {
      "author": "crawler-id",
      "content": "AB",
      "optionCount": 4,
      "optionCountConfidence": 0.97,
      "optionCountSource": "ocr",
      "optionCountNeedsReview": false
    },
    { "author": "crawler-id-2", "content": "Đáp án đúng là A, B" }
  ]
}
```

- Khóa trong `answers.json` phải là tên ảnh gốc (hoặc đường dẫn ảnh gốc) mà crawler
  đã xuất ra. Đáp án hợp lệ là một tổ hợp từ `A` đến `F`: `A`, `AB`, `ABC`…; thứ tự được
  chuẩn hóa trước khi tổng hợp, nên `BA` và `AB` là cùng một lựa chọn.
- Parser chỉ nhận dòng đầu tiên có đáp án rõ ràng hoặc mẫu `Đáp án đúng là …`;
  không suy diễn từ phần giải thích còn lại.
- Khi một người có nhiều comment, chỉ vote có thể parse sau cùng được dùng để
  tổng hợp và định danh người đó bị loại bỏ ngay sau bước này.
- Đáp án có một tổ hợp đứng đầu duy nhất được lưu ngay khi tạo đề nháp, kể cả
  khi chỉ có một comment hoặc chưa có OCR. Câu không có đáp án hợp lệ hoặc hòa
  phiếu cần xác nhận thủ công; trang duyệt hiển thị lý do của từng câu.
- Với đề mới trên AWS, RapidOCR chạy nền để kiểm tra số lựa chọn A–F trên ảnh,
  độc lập với OCR nội dung đề. Kết quả độ tin cậy thấp, lỗi hoặc mâu thuẫn với
  chữ đáp án tạo cảnh báo riêng; không xóa đáp án đã xác định được. OCR chỉ đối
  chiếu, không tự thay đổi số lựa chọn đang lưu: mọi chênh lệch đều giữ nguyên
  dữ liệu và hiển thị cảnh báo để kiểm tra ảnh.
- Bộ lọc “Cần xác nhận” hiển thị câu thiếu đáp án; bộ lọc “OCR cảnh báo” hiển
  thị lỗi đếm lựa chọn. Các đề cũ không tự động chạy lại OCR. Đáp án gợi ý còn
  lưu trong đề nháp cũ có thể được lưu hàng loạt theo quy tắc mới.
- Admin có thể dùng “Thử lại OCR lỗi” khi job gửi hàng đợi bị lỗi hoặc quá 15
  phút chưa hoàn tất. Chỉ những câu còn ở trạng thái lỗi/chờ quá hạn của đề
  nháp được gửi lại. Kết quả từ lần chạy cũ sẽ bị bỏ qua nếu đến sau lần mới;
  câu đã duyệt thủ công không được gửi lại.

Giới hạn bảo mật: ZIP tối đa 250 MB, ảnh tối đa 20 MB, `answers.json` tối đa
1 MB, tổng dữ liệu giải nén tối đa 500 MB và tỷ lệ nén tối đa 100:1.

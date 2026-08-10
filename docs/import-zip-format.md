# Định dạng ZIP nhập đề FE

Mỗi ZIP chứa từ 1 đến 120 ảnh câu hỏi (ví dụ 50 hoặc 60 ảnh; cho phép `.jpg`,
`.jpeg`, `.png`, `.webp` và một thư mục gốc tùy ý). Tên ảnh có thể là bất kỳ
chuỗi nào, miễn không trùng trong ZIP. Hệ thống tự gán thứ tự nội bộ theo thứ tự
file trong manifest ZIP; thứ tự tên file không ảnh hưởng đến việc import.

Có thể kèm đúng một `answers.json`. File này chỉ dùng trong lúc import để tạo
gợi ý cho trang duyệt; hệ thống không lưu hoặc trả về tác giả hay nội dung
comment.

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
- `optionCount` nhận từ 2 đến 6. Hệ thống chỉ tự lưu đáp án khi comment có đồng
  thuận rõ ràng và OCR nhận diện số lựa chọn với độ tin cậy từ 82%. Loại câu
  một/nhiều đáp án, số lựa chọn và đáp án được ghi ngay khi tạo đề nháp.
- Câu có đồng thuận dưới 75%, hòa phiếu, OCR không chắc chắn hoặc thiếu metadata
  số lựa chọn được giữ ở trạng thái “Cần kiểm tra”. Trang duyệt mặc định chỉ
  hiển thị các ngoại lệ này; quản trị viên không phải lưu lại toàn bộ đề.
- Với đề nháp được tạo trước thay đổi này, trang duyệt tự áp dụng các gợi ý
  cộng đồng đủ điều kiện khi mở đề.

Giới hạn bảo mật: ZIP tối đa 250 MB, ảnh tối đa 20 MB, `answers.json` tối đa
1 MB, tổng dữ liệu giải nén tối đa 500 MB và tỷ lệ nén tối đa 100:1.

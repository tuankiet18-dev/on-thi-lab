# Định dạng ZIP nhập đề FE

Mỗi ZIP chứa ảnh câu hỏi được đánh số liên tiếp từ `Q1.jpg` đến `Qn.jpg` (ví dụ
`Q50.jpg` hoặc `Q60.jpg`; cho phép `.jpeg`,
`.png`, `.webp` và một thư mục gốc tùy ý). Tên ảnh xác định thứ tự câu hỏi.

Có thể kèm đúng một `answers.json`. File này chỉ dùng trong lúc import để tạo
gợi ý cho trang duyệt; hệ thống không lưu hoặc trả về tác giả hay nội dung
comment.

```json
{
  "Q1.jpg": [
    { "author": "crawler-id", "content": "AB" },
    { "author": "crawler-id-2", "content": "Đáp án đúng là A, B" }
  ]
}
```

- Đáp án hợp lệ là một tổ hợp từ `A` đến `F`: `A`, `AB`, `ABC`…; thứ tự được
  chuẩn hóa trước khi tổng hợp, nên `BA` và `AB` là cùng một lựa chọn.
- Parser chỉ nhận dòng đầu tiên có đáp án rõ ràng hoặc mẫu `Đáp án đúng là …`;
  không suy diễn từ phần giải thích còn lại.
- Khi một người có nhiều comment, chỉ vote có thể parse sau cùng được dùng để
  tổng hợp và định danh người đó bị loại bỏ ngay sau bước này.
- Gợi ý luôn cần quản trị viên áp dụng và lưu thành đáp án chính thức. Những
  câu có đồng thuận dưới 75% hoặc hòa phiếu được gắn cờ cần kiểm tra.

Giới hạn bảo mật: ZIP tối đa 250 MB, ảnh tối đa 20 MB, `answers.json` tối đa
1 MB, tổng dữ liệu giải nén tối đa 500 MB và tỷ lệ nén tối đa 100:1.

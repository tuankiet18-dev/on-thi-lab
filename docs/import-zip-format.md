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
    { "author": "crawler-id", "content": "AB" },
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
- Gợi ý luôn cần quản trị viên áp dụng và lưu thành đáp án chính thức. Những
  câu có đồng thuận dưới 75% hoặc hòa phiếu được gắn cờ cần kiểm tra.

Giới hạn bảo mật: ZIP tối đa 250 MB, ảnh tối đa 20 MB, `answers.json` tối đa
1 MB, tổng dữ liệu giải nén tối đa 500 MB và tỷ lệ nén tối đa 100:1.

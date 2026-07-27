# Product Specification — OnThiLab

| Thuộc tính | Giá trị |
|---|---|
| Trạng thái | Approved — Ready for implementation |
| Phiên bản | 1.0 |
| Ngày cập nhật | 2026-07-23 |
| Phạm vi hiện tại | MVP |
| Chủ sở hữu sản phẩm | Cá nhân |

> Tài liệu này là nguồn tham chiếu chính cho phạm vi sản phẩm. Phiên bản 1.0
> không còn câu hỏi chặn việc triển khai MVP.

## 1. Tóm tắt sản phẩm

Nền tảng giúp sinh viên FPT ở tất cả campus luyện thi bằng cách làm lại các đề
Final Exam (FE) của những học kỳ trước trong điều kiện gần giống kỳ thi thật.

Mỗi câu hỏi được hiển thị bằng ảnh gốc. Người dùng chọn một hoặc nhiều đáp án
A–F trên giao diện của hệ thống. Hệ thống đếm ngược thời gian, tự động nộp bài
khi hết giờ, chấm điểm và cho phép xem lại bài sau khi nộp.

Đáp án ban đầu có thể do AI đề xuất và phải luôn được ghi rõ là đáp án tham
khảo. Người dùng có thể báo cáo câu hỏi hoặc đáp án có vấn đề để Admin xem xét.

Sản phẩm hỗ trợ cấu trúc đầy đủ gồm tất cả campus, ngành, curriculum, chín kỳ
học và các môn tương ứng; dữ liệu đề thi được phát hành dần, ưu tiên hai đến ba
học kỳ gần nhất.

## 2. Vấn đề cần giải quyết

- Sinh viên khó tìm đề thi cũ đúng với campus, ngành, curriculum và môn đang học.
- Tài liệu hiện tại phân tán, chủ yếu ở dạng ảnh và không có trải nghiệm thi thử.
- Sinh viên không có đồng hồ, cơ chế tự nộp, chấm điểm và lịch sử làm bài tập
  trung tại một nơi.
- Đáp án cộng đồng hoặc AI có thể chưa được xác minh, nhưng nguồn vẫn hữu ích
  nếu độ tin cậy được thể hiện minh bạch.

## 3. Mục tiêu

### 3.1. Mục tiêu MVP

- Cho phép sinh viên tìm đúng đề FE theo thông tin học tập của mình.
- Mô phỏng nguyên bản từng đề thi cũ, không ghép câu từ các đề khác nhau.
- Hỗ trợ câu hỏi chọn một và chọn nhiều đáp án.
- Hiển thị câu hỏi bằng ảnh mà không bắt buộc phải OCR.
- Chấm điểm tự động theo đáp án tham khảo.
- Lưu lịch sử làm bài và cho phép làm lại.
- Cung cấp công cụ quản trị để một Admin có thể nhập và xuất bản toàn bộ dữ liệu.
- Cho phép mở rộng phân quyền khi có thêm cộng tác viên.
- Chuẩn bị nền tảng cho mô hình freemium.

### 3.2. Tiêu chí thành công ban đầu

Mục tiêu trong ba tháng đầu:

- 2.000 tài khoản đăng ký.
- 500 Monthly Active Users.
- 200 đề được public.
- 2.000 lượt thi hoàn thành.
- Tỷ lệ hoàn thành bài thi từ 70% trở lên.
- Tỷ lệ người dùng quay lại trong 30 ngày từ 25% trở lên.
- Report được xử lý trong vòng 72 giờ.

Hệ thống cũng phải đo được:

- Tỷ lệ hoàn thành hồ sơ.
- Số đề theo campus/môn/học kỳ.
- Tỷ lệ tự động nộp do hết giờ.
- Số lượt làm lại.
- Số báo cáo theo loại và thời gian xử lý.
- Tỷ lệ chuyển đổi Free → Pro sau khi monetization được bật.

## 4. Ngoài phạm vi MVP

- Practical Exam (PE).
- Câu hỏi tự luận hoặc cần giám khảo chấm.
- Tự động tạo đề mới bằng cách trộn câu từ nhiều đề.
- Proctoring, quay webcam hoặc chống gian lận cấp độ kỳ thi chính thức.
- OCR toàn bộ dữ liệu như một điều kiện bắt buộc trước khi xuất bản.
- Thay thế hoặc đại diện cho hệ thống thi chính thức của trường.
- Cam kết điểm trên hệ thống tương đương điểm thi thật.

## 5. Thuật ngữ

| Thuật ngữ | Ý nghĩa |
|---|---|
| Kỳ học | Vị trí trong lộ trình đào tạo, ví dụ kỳ 1 đến kỳ 9 |
| Học kỳ tổ chức | Đợt học/thi theo thời gian, ví dụ Spring 2026 |
| Curriculum | Phiên bản chương trình đào tạo của một ngành |
| FE | Final Exam |
| PE | Practical Exam, chưa thuộc MVP |
| Regular | Lần thi chính |
| Retake | Lần thi lại |
| Đề thi | Một bộ câu hỏi FE nguyên bản từ cùng một lần tổ chức thi |
| Lượt thi | Một lần người dùng bắt đầu làm một đề |
| Đáp án tham khảo | Đáp án có thể do AI hoặc cộng đồng cung cấp, không phải kết quả chính thức |

## 6. Người dùng và phân quyền

### 6.1. Guest

- Xem landing page và danh mục công khai.
- Xem môn nào đang có đề.
- Xem metadata của đề như campus, môn, kỳ thi, số câu và thời lượng.
- Không được xem ảnh câu hỏi hoặc đáp án.
- Không được bắt đầu làm bài.

### 6.2. User

- Đăng ký, đăng nhập và quản lý hồ sơ cá nhân.
- Tìm và lọc đề thi.
- Bắt đầu, làm, nộp và làm lại đề.
- Xem kết quả và lịch sử của chính mình.
- Bookmark đề thi và câu hỏi khi xem kết quả.
- Báo cáo câu hỏi hoặc đáp án có vấn đề.
- Xem trạng thái các báo cáo đã gửi.
- Sử dụng quyền lợi theo gói hiện tại.

### 6.3. Contributor

Vai trò dự phòng, do Admin cấp khi có thêm thành viên:

- Tải ảnh và tạo dữ liệu đề ở trạng thái nháp.
- Nhập metadata, số lựa chọn và đáp án tham khảo.
- Chỉnh sửa nội dung chưa xuất bản nếu được cấp quyền.
- Không mặc định có quyền quản lý người dùng hoặc cấu hình thanh toán.

### 6.4. Admin

- Có toàn bộ quyền của User và Contributor.
- Quản lý campus, ngành, curriculum, kỳ học và môn học.
- Tạo, sửa, xuất bản, ẩn và lưu trữ đề thi.
- Tạo hoặc cập nhật đáp án tham khảo.
- Xử lý báo cáo.
- Quản lý người dùng và cấp/thu hồi vai trò.
- Cấu hình giới hạn gói miễn phí và quyền lợi trả phí.
- Xem nhật ký thao tác quản trị.

### 6.5. Reviewer

Chưa phải vai trò riêng trong MVP. Admin thực hiện việc kiểm duyệt. Hệ thống
phân quyền nên hỗ trợ thêm Reviewer sau này mà không cần thay đổi mô hình dữ liệu
cốt lõi.

## 7. Danh mục học thuật

### 7.1. Cấu trúc

```text
Campus
└── Ngành
    └── Curriculum
        └── Kỳ học (1–9)
            └── Môn học
                └── Đề thi
```

Một môn có thể:

- Xuất hiện trong nhiều ngành.
- Xuất hiện trong nhiều curriculum.
- Nằm ở kỳ học khác nhau tùy curriculum.
- Có đề khác nhau theo campus và học kỳ tổ chức.

Vì vậy, môn học phải là thực thể dùng chung; quan hệ curriculum–kỳ–môn được lưu
riêng thay vì sao chép môn học cho từng ngành.

### 7.2. Hồ sơ sinh viên

Khi đăng ký, người dùng phải hoàn thành hồ sơ gồm:

- Họ và tên: bắt buộc.
- MSSV: bắt buộc.
- Campus: bắt buộc.
- Ngành: bắt buộc.
- Curriculum: bắt buộc, do người dùng tự chọn.

MSSV cần được chuẩn hóa, là duy nhất và không được hiển thị công khai. MVP chưa
xác minh MSSV với hệ thống của trường.

### 7.3. Trạng thái dữ liệu

- Danh mục có thể tồn tại dù chưa có đề.
- Môn chưa có đề hiển thị trạng thái “Chưa có đề thi”.
- Đề có thể phát hành dần mà không phụ thuộc việc hoàn tất toàn bộ danh mục.

## 8. Định danh đề thi

Yêu cầu hiển thị ban đầu của một đề gồm:

- Mã môn.
- Kỳ học trong curriculum.
- Loại thi: FE.
- Lần thi: Regular hoặc Retake.

Do cùng một mã môn có thể có nhiều đề qua các năm và campus, bốn thuộc tính trên
không đủ để tạo khóa duy nhất. Hệ thống dùng `exam_id` nội bộ và đề xuất lưu thêm:

- Campus.
- Học kỳ tổ chức: Spring, Summer hoặc Fall, bắt buộc.
- Năm tổ chức, bắt buộc.
- Mã đề, nếu nguồn có cung cấp.
- Curriculum áp dụng, nếu đề bị giới hạn theo curriculum.
- Phiên bản của đề.

Nếu có nhiều đề trùng toàn bộ metadata, Admin phải nhập mã đề hoặc số thứ tự bộ
đề. Hệ thống luôn dùng `exam_id` làm khóa kỹ thuật, không dùng tiêu đề hiển thị
làm khóa database.

## 9. Mô hình dữ liệu đề thi

### 9.1. Exam

- ID nội bộ.
- Mã và tên môn.
- Campus.
- Kỳ học trong curriculum.
- Học kỳ tổ chức và năm: bắt buộc.
- Loại thi: FE.
- Lần thi: Regular/Retake.
- Mã đề hoặc số thứ tự Set: bắt buộc khi có nhiều đề trùng metadata; hệ thống
  đề xuất số Set kế tiếp và Admin được sửa.
- Thời lượng tính bằng phút.
- Tổng số câu; một đề FE điển hình có 60 câu nhưng giá trị vẫn được cấu hình theo
  đề gốc.
- Thang điểm: 10.
- Điểm đạt: tùy chọn.
- Ngôn ngữ: tùy chọn.
- Nguồn/provenance nội bộ.
- Ghi chú miễn trừ trách nhiệm.
- Trạng thái: Draft/Processing/Answer review/Published/Hidden/Archived.
- Thời điểm tạo, cập nhật và xuất bản.
- Người tạo và người cập nhật.

### 9.2. Question

- ID nội bộ.
- Exam Revision ID.
- Số thứ tự gốc.
- Đường dẫn ảnh gốc.
- Đường dẫn ảnh tối ưu để phân phối.
- Loại câu: Single choice hoặc Multiple choice.
- Số lựa chọn: từ A đến F.
- Danh sách đáp án tham khảo.
- Nguồn đáp án: AI/Admin/Contributor.
- Trạng thái xác minh: AI generated/Human verified/Disputed.
- Mức độ tin cậy: tùy chọn.
- Văn bản OCR: trường dự phòng cho giai đoạn sau, không được tạo trong MVP.
- Trạng thái xuất bản.
- Phiên bản đáp án.
- Thời điểm tạo và cập nhật.

### 9.3. Exam Attempt

- ID lượt thi.
- User ID.
- Exam ID và Exam Revision ID tại thời điểm bắt đầu.
- Thứ tự câu đã trộn.
- Thời điểm bắt đầu.
- Thời điểm hết hạn do server tính.
- Thời điểm nộp.
- Trạng thái.
- Lý do kết thúc: Manual/Timeout/Cancelled.
- Câu trả lời theo từng câu.
- Phiên bản đáp án dùng để chấm.
- Số câu đúng, sai và bỏ trống.
- Điểm số.
- Thời gian thực tế đã sử dụng.

### 9.4. Exam Revision

- ID revision.
- Exam ID.
- Số phiên bản tăng dần.
- Snapshot metadata, danh sách câu hỏi, ảnh và đáp án.
- Trạng thái: Draft/Published/Superseded.
- Lý do tạo revision.
- Người tạo và thời điểm tạo.

Mỗi đề có đúng một revision Published hiện hành. Khi sửa ảnh hoặc đáp án của đề
đã public, hệ thống tạo revision mới. Lượt thi đang diễn ra và kết quả cũ tiếp
tục tham chiếu revision cũ; lượt bắt đầu sau khi revision mới được public dùng
revision mới.

### 9.5. Question Report

- ID báo cáo.
- User ID.
- Exam ID, Question ID và phiên bản câu hỏi.
- Loại báo cáo.
- Nội dung mô tả.
- Trạng thái xử lý.
- Phản hồi của Admin.
- Thời điểm tạo và xử lý.

## 10. Chiến lược dữ liệu ảnh

### 10.1. Quyết định MVP: Image-first

Ảnh là nguồn hiển thị chính của câu hỏi. Hệ thống không cần trích xuất toàn bộ
nội dung câu hỏi và lựa chọn để người dùng làm bài.

Phần dữ liệu có cấu trúc tối thiểu cho mỗi câu gồm:

- Ảnh câu hỏi.
- Loại chọn một/chọn nhiều.
- Số lựa chọn A–D, A–E hoặc A–F.
- Đáp án tham khảo.
- Số thứ tự.

Người dùng chọn đáp án bằng các control A–F do hệ thống render bên dưới hoặc bên
cạnh ảnh. Không yêu cầu người dùng click trực tiếp vào vị trí chữ trên ảnh.

### 10.2. Lợi ích

- Giảm lỗi OCR đối với code, bảng, công thức và hình minh họa.
- Nhập dữ liệu nhanh hơn.
- Giữ nguyên bố cục của đề gốc.
- Có thể xuất bản ngay cả khi chưa có văn bản OCR.

### 10.3. Hạn chế

- Không tìm kiếm được theo nội dung câu hỏi.
- Khả năng tiếp cận cho screen reader thấp.
- AI Vision cần đọc từng ảnh trong quá trình nhập đề.
- Tốn băng thông và cần tối ưu ảnh tốt.
- Khó phát hiện câu trùng lặp chỉ bằng text.

### 10.4. AI Vision và OCR

MVP không triển khai OCR. AI Vision đọc trực tiếp từng ảnh để đề xuất loại câu,
số lựa chọn và đáp án:

1. Admin tải ảnh lên.
2. Hệ thống lưu bản gốc bất biến.
3. Hệ thống tạo bản hiển thị đã tối ưu kích thước và định dạng.
4. Worker AI Vision xử lý bất đồng bộ tối đa 5 ảnh cùng lúc.
5. Mỗi ảnh lỗi được tự động retry tối đa 3 lần và có thể retry thủ công.
6. AI đề xuất Single/Multiple, số lựa chọn và một hoặc nhiều đáp án; không tạo
   phần giải thích.
7. Kết quả được lưu ở trạng thái AI generated.
8. Admin kiểm tra và xác nhận từng kết quả.
9. Chỉ đề đã có đủ đáp án được Admin duyệt mới được xuất bản.

OCR để tìm kiếm và phát hiện câu trùng được hoãn sang giai đoạn sau. Lựa chọn
nhà cung cấp AI Vision chỉ được chốt sau khi đánh giá một tập ảnh đại diện và so
sánh độ chính xác, tốc độ, chi phí.

### 10.5. Yêu cầu xử lý ảnh

- Không làm thay đổi nội dung học thuật của ảnh.
- Lưu bản gốc để đối chiếu.
- Tạo thumbnail cho danh sách và bản tối ưu cho màn hình thi.
- Lazy-load và preload câu kế tiếp.
- Không để URL lưu trữ nội bộ cho phép ghi hoặc liệt kê file.
- Có cơ chế thay ảnh nhưng vẫn giữ lịch sử phiên bản.
- Admin chịu trách nhiệm chuẩn bị ảnh sạch, có quyền sử dụng và không chứa
  watermark/logo của nguồn trước khi upload.
- Hệ thống không có chức năng tự động xóa watermark.

## 11. Quy trình Admin nhập đề

### 11.1. Tạo đề

1. Admin chọn môn, campus, kỳ học, học kỳ tổ chức, loại thi và Regular/Retake.
2. Admin nhập thời lượng, số câu và metadata còn lại.
3. Hệ thống kiểm tra khả năng trùng đề.
4. Đề được tạo ở trạng thái Draft.

### 11.2. Tải câu hỏi

1. Admin tải hàng loạt ảnh của một đề bằng cách chọn nhiều file hoặc upload một
   file ZIP; một đề FE điển hình gồm 60 ảnh.
2. Giao diện hiển thị tiến độ upload riêng cho từng ảnh và cho phép retry ảnh lỗi.
3. Hệ thống nhận JPG, PNG và WebP, tối đa 10 MB mỗi ảnh.
4. File được đặt tên theo số thứ tự có padding, ví dụ `001.jpg` đến `060.jpg`.
5. Hệ thống giải nén ZIP an toàn, chỉ nhận các định dạng ảnh được hỗ trợ và từ
   chối file không hợp lệ.
6. Hệ thống sắp xếp tự nhiên theo tên file.
7. Admin kéo thả để sửa thứ tự.
8. Mỗi ảnh mặc định tương ứng một câu.
9. Hệ thống đối chiếu số ảnh thành công với tổng số câu đã khai báo.
10. Admin yêu cầu AI Vision đề xuất loại câu, số lựa chọn và đáp án cho từng câu
    hoặc toàn đề.
11. Admin duyệt hoặc sửa từng kết quả và xem trước toàn bộ đề.
12. Khi mọi câu hợp lệ và đã duyệt đáp án, Admin xuất bản.

### 11.3. Xuất bản

Đề không được xuất bản ngay chỉ dựa trên kết quả AI. Trước khi xuất bản:

- Mọi câu phải có ảnh hợp lệ, loại câu, số lựa chọn và đáp án.
- Mọi đáp án AI phải được Admin duyệt hoặc sửa.
- Hệ thống phải chặn Publish nếu số ảnh khác tổng số câu hoặc còn câu chưa duyệt.
- Trang bắt đầu thi phải ghi rõ điểm và đáp án chỉ mang tính tham khảo.
- Admin có thể sửa đáp án sau khi xuất bản.
- Kết quả các lượt thi cũ không bị ghi đè hoặc tự động tính lại.

## 12. Tìm và chọn đề

### 12.1. Gợi ý cá nhân hóa

Sau khi đăng nhập, hệ thống ưu tiên campus, ngành và curriculum trong hồ sơ của
người dùng. Người dùng vẫn có thể thay bộ lọc để xem dữ liệu khác.

### 12.2. Bộ lọc

- Campus: campus của tôi, một campus cụ thể hoặc tất cả.
- Ngành.
- Curriculum.
- Kỳ học 1–9.
- Môn học/mã môn.
- Loại thi: FE.
- Regular/Retake.
- Học kỳ tổ chức và năm.
- Trạng thái đã làm/chưa làm: có thể triển khai sau MVP.

### 12.3. Thẻ đề thi

Mỗi đề tối thiểu hiển thị:

- Mã và tên môn.
- Campus.
- Kỳ/học kỳ áp dụng.
- FE Regular hoặc FE Retake.
- Số câu.
- Thời gian làm bài.
- Số lượt đã làm của người dùng.
- Nhãn “Đáp án và điểm số tham khảo”.
- Quyền truy cập theo gói.

### 12.4. Dashboard sinh viên

Sau khi đăng nhập, dashboard hiển thị:

- Lượt thi đang diễn ra và nút tiếp tục, nếu có.
- Các môn phù hợp với campus, ngành và curriculum trong hồ sơ.
- Đề mới được xuất bản cho các môn phù hợp.
- Kết quả các lượt thi gần đây.
- Tổng số lượt đã hoàn thành, điểm trung bình và điểm tốt nhất.
- Shortcut tới đề và câu hỏi đã bookmark.

## 13. Luồng làm bài

### 13.1. Trước khi bắt đầu

Trang hướng dẫn hiển thị:

- Thông tin đề.
- Số câu và thời lượng.
- Quy tắc không tạm dừng.
- Hệ thống tự nộp khi hết giờ.
- Đề có thể trộn thứ tự câu.
- Cách chấm câu chọn nhiều.
- Miễn trừ trách nhiệm về đáp án và điểm số.
- Nút bắt đầu.

Thời gian chỉ bắt đầu sau khi server xác nhận tạo lượt thi.

### 13.2. Trong khi làm bài

- Mỗi màn hình hiển thị một ảnh tương ứng một câu.
- Control đáp án A–F được render dựa trên cấu hình câu.
- Single choice dùng radio; Multiple choice dùng checkbox.
- Có nút Previous và Next.
- Có bảng điều hướng nhanh theo số câu.
- Người dùng được quay lại và sửa mọi đáp án trước khi nộp.
- Đồng hồ đếm ngược luôn hiển thị.
- Không có chức năng pause.
- Hệ thống lưu tự động đáp án.
- Thứ tự câu được trộn một lần khi tạo lượt thi và giữ cố định trong lượt đó.
- Không trộn câu giữa các đề.
- Không trộn thứ tự lựa chọn A–F vì các lựa chọn đã nằm trong ảnh.
- Khi hết giờ, server tự động nộp bài.
- Client khóa toàn bộ thao tác trả lời ngay khi timer về 0. Background worker
  được phép hoàn tất chấm và chuyển trạng thái chậm tối đa 60 giây.

### 13.3. Nộp thủ công

- Khi bấm Submit, hiển thị xác nhận.
- Xác nhận cho biết số câu đã trả lời và bỏ trống.
- Sau khi xác nhận, không thể sửa lượt thi.
- Server chấm điểm theo snapshot đáp án tại thời điểm nộp.

### 13.4. Mất mạng, reload hoặc đóng trình duyệt

Không được coi là tạm dừng. Đồng hồ phía server tiếp tục chạy. Người dùng có thể
reload hoặc mở lại lượt thi đang diễn ra trên cùng thiết bị trong thời gian còn
lại; đáp án đã autosave được phục hồi.

Một lượt thi chỉ được hoạt động trên một thiết bị tại một thời điểm. Thiết bị
thứ hai không được tiếp tục lượt thi đang diễn ra.

Một người dùng chỉ được có một lượt thi In progress trên toàn hệ thống. Nếu đã
có lượt đang diễn ra, hệ thống đưa người dùng trở lại lượt đó thay vì tạo lượt
mới.

Khi hết giờ, server chấm theo các đáp án cuối cùng đã autosave, kể cả khi client
đang mất mạng hoặc đã đóng. Lượt thi chỉ chuyển sang Cancelled khi Admin chủ động
hủy hoặc lượt thi chưa từng lưu thành công bất kỳ dữ liệu làm bài nào. Người
dùng không thể tránh lưu điểm bằng cách ngắt mạng trước khi hết giờ.

### 13.5. Trạng thái lượt thi

```text
Created → In progress → Submitted
                      ↘ Auto-submitted
```

Các trạng thái lỗi hoặc lượt thi không bao giờ bắt đầu cần được bổ sung khi thiết
kế kỹ thuật.

## 14. Trộn câu

- Hệ thống dùng thứ tự ngẫu nhiên mới cho mỗi lượt thi.
- Thứ tự được lưu trong Exam Attempt để reload không làm đổi vị trí câu.
- Màn hình kết quả hiển thị theo thứ tự của lượt thi đã làm và kèm số thứ tự gốc.
- Admin được bật hoặc tắt trộn ở cấp đề; mặc định bật.
- Không bao giờ trộn vị trí lựa chọn A–F.

## 15. Chấm điểm

### 15.1. Nguyên tắc đã chốt

- Chấm tự động sau khi người dùng nộp hoặc hết giờ.
- Đáp án và điểm số mang tính tham khảo.
- Lượt thi cũ giữ nguyên điểm nếu Admin sửa đáp án sau đó.
- Mỗi lượt thi phải lưu phiên bản đáp án dùng để chấm.

### 15.2. Công thức

- Thang điểm: 10.
- Mọi câu có cùng trọng số.
- Điểm số = `số câu đúng / tổng số câu × 10`.
- Điểm được làm tròn đến hai chữ số thập phân.
- Single choice chỉ đúng khi chọn đúng một đáp án tham khảo.
- Multiple choice dùng exact match: phải chọn đúng và đủ toàn bộ đáp án.
- Chọn thiếu hoặc chọn thừa làm câu đó được 0 điểm.
- Không có điểm từng phần và không có điểm âm.
- Câu bỏ trống được 0 điểm.
- MVP không hiển thị trạng thái đạt/không đạt.

## 16. Kết quả và xem lại bài

Sau khi nộp, người dùng được xem:

- Điểm tham khảo.
- Số câu đúng, sai và bỏ trống.
- Thời gian đã sử dụng.
- Danh sách tất cả câu.
- Ảnh câu hỏi.
- Đáp án người dùng đã chọn.
- Đáp án tham khảo.
- Đúng/sai theo quy tắc chấm.
- Trạng thái AI generated/Human verified/Disputed.
- Nút báo cáo.
- Nút làm lại đề.
- Nút bookmark đề.
- Nút bookmark từng câu hỏi.

Việc hiển thị đáp án ngay sau từng câu trong lúc thi không thuộc MVP.

### 16.1. Lịch sử và thống kê

- Lịch sử hiển thị tất cả lượt thi theo thời gian.
- Có bộ lọc theo môn, campus, học kỳ tổ chức và khoảng thời gian.
- Với mỗi môn/đề, hiển thị điểm tốt nhất và điểm trung bình.
- Có biểu đồ xu hướng điểm theo thời gian.
- Thống kê được môn, đề và các câu người dùng thường làm sai.
- MVP không phân tích chủ đề yếu vì chưa có topic metadata hoặc OCR.
- Điểm cũ luôn dùng revision đáp án tại thời điểm chấm.
- Bookmark đề và câu hỏi được quản lý trong một trang riêng.

## 17. Báo cáo câu hỏi hoặc đáp án

### 17.1. Loại báo cáo đề xuất

- Đáp án tham khảo có thể sai.
- Ảnh bị mờ, cắt hoặc không tải được.
- Số lựa chọn không đúng.
- Câu hỏi bị trùng.
- Metadata đề sai.
- Nội dung không phù hợp.
- Khác.

### 17.2. Xử lý

- Báo cáo được gửi vào trang quản trị.
- Admin có thể mở câu hỏi và ảnh gốc để đối chiếu.
- Admin đánh dấu Open/Reviewing/Resolved/Rejected.
- Admin có thể sửa đáp án và tăng phiên bản đáp án.
- Điểm lịch sử không thay đổi.
- MVP không gửi thông báo khi report được xử lý.
- User có thể mở danh sách report của mình để xem trạng thái và phản hồi Admin.

## 18. Xác thực và tài khoản

### 18.1. Phương thức

- Google OAuth.
- Email và mật khẩu.

Mọi địa chỉ email đã xác minh đều được đăng ký; không giới hạn theo domain FPT.
Nếu Google OAuth và tài khoản mật khẩu có cùng email đã xác minh, hệ thống liên
kết hai phương thức đăng nhập vào cùng một User thay vì tạo tài khoản trùng.

### 18.2. Yêu cầu bảo mật

- Email phải được xác minh đối với đăng ký bằng mật khẩu.
- Mật khẩu phải được băm bằng thuật toán phù hợp; không bao giờ lưu plaintext.
- Có luồng quên/đặt lại mật khẩu.
- Phiên đăng nhập có thể thu hồi.
- Route Admin phải kiểm tra quyền phía server.
- Các thao tác quản trị quan trọng phải có audit log.
- Rate limit đăng nhập, reset password và report.
- MVP không triển khai MFA cho Admin hoặc User.
- Admin phải đăng nhập lại trước thao tác nhạy cảm như đổi vai trò, xóa đề, sửa
  MSSV hoặc xóa tài khoản.
- Admin phải dùng mật khẩu mạnh và email đã xác minh.

### 18.3. Hồ sơ và quyền riêng tư

- MSSV, campus, ngành và curriculum là dữ liệu hồ sơ cá nhân.
- Không hiển thị MSSV công khai.
- Người dùng có thể tự sửa campus, ngành và curriculum.
- MSSV chỉ Admin được sửa.
- Người dùng được yêu cầu xóa tài khoản. Hồ sơ và lịch sử thi cá nhân bị xóa;
  hệ thống chỉ giữ số liệu tổng hợp đã ẩn danh.

## 19. Freemium và thanh toán

Trong giai đoạn phát hành đầu tiên, toàn bộ tính năng MVP được mở miễn phí để
thu hút người dùng và thu thập dữ liệu sử dụng. Chưa triển khai màn hình mua gói
hoặc giới hạn lượt thi. Người dùng được làm lại một đề không giới hạn số lần.

Hệ thống vẫn chuẩn bị mô hình `Plan`, `Entitlement` và `Usage` để có thể bật
freemium sau này mà không phải thay đổi cấu trúc User hoặc lịch sử thi.

### 19.1. Thời điểm đánh giá thu phí

- Ba tháng đầu toàn bộ tính năng được miễn phí và không giới hạn lượt thi.
- Đánh giá bật monetization sau ba tháng vận hành hoặc khi đạt 1.000 MAU, tùy
  điều kiện nào đến trước.
- Bật giới hạn bằng feature flag; không cần deploy lại ứng dụng.

### 19.2. Gói Free

Sau khi freemium được bật:

- Xem toàn bộ danh mục và đề đã public.
- Tối đa hai lượt thi mới mỗi ngày.
- Lượt thi đang diễn ra được tiếp tục và auto-submit bình thường dù đã sang ngày
  mới.
- Xem kết quả và lịch sử cơ bản.
- Bookmark đề/câu hỏi và gửi report.
- Giới hạn được tính theo timezone Asia/Ho_Chi_Minh.
- Admin có thể tặng entitlement hoặc miễn giới hạn cho tài khoản cụ thể.

### 19.3. Gói Pro

- Subscription có kỳ hạn 1 tháng, 3 tháng và 1 năm.
- Không giới hạn số lượt thi.
- Thống kê nâng cao.
- Phân tích điểm yếu khi dữ liệu topic/OCR được bổ sung.
- Các quyền lợi mới có thể được thêm bằng entitlement, không hard-code theo tên
  plan.

### 19.4. Giá

| Kỳ hạn | Giá |
|---|---:|
| 1 tháng | 29.000₫ |
| 3 tháng | 69.000₫ |
| 1 năm | 199.000₫ |

Giá được lưu trong database và có version; client không gửi hoặc quyết định số
tiền cần thanh toán.

### 19.5. Cổng thanh toán

- Provider: payOS.
- Chủ sở hữu xác minh payOS bằng thông tin cá nhân và tài khoản ngân hàng cá
  nhân nhận tiền.
- Backend tạo payment link; client không được giữ API key/checksum key.
- Webhook phải được xác minh chữ ký trước khi cập nhật Payment Order.
- Trang redirect sau thanh toán chỉ dùng cho UX, không kích hoạt Pro.
- Webhook và quá trình kích hoạt entitlement phải idempotent.

### 19.6. Gia hạn và entitlement

- Không tự động gia hạn.
- User chủ động mua lại kỳ hạn.
- Nếu User chưa có Pro hoặc Pro đã hết hạn, thời gian mới tính từ lúc webhook
  thanh toán hợp lệ được xử lý.
- Nếu Pro còn hạn, thời gian mới được cộng nối tiếp từ ngày hết hạn hiện tại.
- Mỗi lần kích hoạt lưu Payment Order, Plan Price Version, thời điểm bắt đầu và
  thời điểm kết thúc.
- Job đối soát kiểm tra Payment Order chưa kết luận trong tối đa 24 giờ.
- Trong thời gian webhook/đối soát chưa hoàn tất, trạng thái hiển thị Processing;
  hệ thống không kích hoạt Pro chỉ dựa trên thông tin client.

### 19.7. Hủy và hoàn tiền

- User có thể ngừng mua lại; do không tự động gia hạn nên không có thao tác hủy
  recurring payment.
- Hoàn tiền khi thanh toán trùng hoặc lỗi hệ thống khiến User không thể sử dụng
  Pro quá 24 giờ.
- Yêu cầu hoàn tiền phải gửi trong vòng 7 ngày kể từ giao dịch.
- Không hoàn tiền một phần do đổi ý sau khi Pro đã được kích hoạt.
- Admin ghi lại lý do, số tiền, người xử lý và mã giao dịch hoàn tiền.
- Nội dung chính sách cuối cùng phải được kiểm tra tuân thủ pháp lý trước khi
  bật monetization.
- Hệ thống gửi xác nhận thanh toán điện tử; hóa đơn/chứng từ thuế thực hiện theo
  nghĩa vụ pháp lý áp dụng tại thời điểm monetization.

Việc thương mại hóa không chặn phát hành MVP miễn phí.

## 20. Quản trị

Trang quản trị MVP cần:

- Dashboard số lượng danh mục, đề, câu và báo cáo.
- CRUD campus, ngành, curriculum, kỳ và môn.
- Gắn môn vào curriculum và kỳ học.
- CRUD đề.
- Bulk upload và sắp xếp ảnh câu hỏi.
- Cấu hình loại câu, số lựa chọn và đáp án.
- Yêu cầu AI đề xuất đáp án theo từng câu hoặc toàn đề.
- Preview đề trước khi xuất bản.
- Publish/Hide/Archive.
- Xử lý report.
- Tìm kiếm người dùng và cấp quyền.
- Audit log.

## 21. Yêu cầu phi chức năng

### 21.1. Responsive

- Trải nghiệm phải dùng được trên desktop, tablet và mobile.
- Ảnh phải fit theo chiều rộng nhưng cho phép zoom/pan khi nội dung nhỏ.
- Control đáp án không được nằm bên trong ảnh để giữ vùng bấm dễ sử dụng.

### 21.2. Hiệu năng

- Tải trước ảnh của câu tiếp theo.
- Không tải toàn bộ ảnh độ phân giải cao ngay khi mở đề.
- Dùng CDN/object storage và cache phù hợp.
- Autosave không được chặn thao tác chuyển câu.
- API thông thường phản hồi dưới 1,5 giây ở p95.
- Ảnh câu hiện tại tải dưới 2,5 giây ở p95.
- Autosave được server xác nhận dưới 1 giây ở p95.
- Ảnh câu kế tiếp được preload.
- Sau khi Aurora auto-pause, lần truy cập đầu được phép mất tối đa 20 giây và
  giao diện phải hiển thị trạng thái đang khởi động dịch vụ.

### 21.3. Tin cậy

- Đồng hồ server là nguồn sự thật, không phụ thuộc đồng hồ thiết bị.
- Submit và auto-submit phải idempotent.
- Không mất câu trả lời đã được server xác nhận.
- Cần theo dõi lỗi upload, xử lý ảnh, autosave và chấm điểm.

### 21.4. Khả năng tiếp cận

Image-first làm giảm khả năng hỗ trợ screen reader. OCR text hoặc mô tả thay thế
nên được bổ sung dần. Control đáp án, timer, điều hướng và trạng thái câu phải
dùng được bằng bàn phím.

### 21.5. Bảo mật

- Kiểm tra loại, kích thước và nội dung file upload.
- Giải nén ZIP phải chống path traversal, ZIP bomb và file giả mạo extension.
- Không tin metadata từ client.
- Dùng signed URL hoặc quyền object phù hợp.
- Chống IDOR đối với lượt thi và kết quả.
- Không gửi đáp án đúng xuống client trước khi lượt thi kết thúc.
- Bảo vệ endpoint AI và upload bằng quota/rate limit.

### 21.6. Hạ tầng AWS

Toàn bộ hạ tầng production được triển khai trên AWS.

Các năng lực hạ tầng bắt buộc:

- Object storage cho ảnh gốc, ảnh tối ưu và ZIP tạm thời.
- CDN để phân phối ảnh câu hỏi.
- Relational database có backup và point-in-time recovery.
- Queue và worker cho xử lý ảnh/AI bất đồng bộ.
- Compute cho web/API và tác vụ nền.
- Quản lý secret và cấu hình môi trường.
- Centralized logs, metrics và cảnh báo.
- Tách biệt môi trường development, staging và production.
- Infrastructure as Code.

Các quyết định hạ tầng:

- Region production: Asia Pacific (Singapore), `ap-southeast-1`.
- Mục tiêu ba tháng đầu: 10.000 tài khoản, 200 người thi đồng thời và 1.000 đề.
- Uptime mục tiêu: 99,5%.
- Recovery Time Objective (RTO): 4 giờ.
- Recovery Point Objective (RPO): 15 phút.
- Tài khoản hiện có khoảng 172 USD AWS credit; kiến trúc phải giảm tối đa chi
  phí nền và có cảnh báo ngân sách.
- AWS credit hết hạn ngày 06/01/2027.
- AI được phép gọi nhà cung cấp bên ngoài AWS nếu giảm chi phí.

### 21.7. Tech stack đề xuất

#### Ngôn ngữ và repository

- TypeScript end-to-end.
- Node.js LTS cho API, worker và tooling.
- SQL cho migration, truy vấn đặc biệt và kiểm tra dữ liệu PostgreSQL.
- HTML/CSS được sinh và quản lý trong frontend React.
- Monorepo dùng pnpm workspaces.
- Cấu trúc dự kiến:

```text
apps/
├── web
├── api
└── worker
packages/
├── contracts
├── database
├── auth
├── ui
└── config
infra/
└── cdk
```

#### Frontend

- React + Vite + TypeScript.
- TanStack Router cho routing.
- TanStack Query cho server state, cache và retry.
- Tailwind CSS và shadcn/ui cho design system.
- React Hook Form + Zod cho form và validation.
- Host bản build tĩnh trên Amazon S3, phân phối qua CloudFront.

Lý do chọn Vite SPA thay vì Next.js SSR: phần lớn sản phẩm nằm sau đăng nhập,
không cần render động để SEO; static hosting giảm chi phí và số thành phần phải
vận hành. Landing page và các trang public vẫn được build thành nội dung tĩnh.

#### API

- TypeScript + Hono chạy trên AWS Lambda.
- Amazon API Gateway HTTP API làm public API entry point.
- Zod dùng chung trong `packages/contracts` để validate request/response.
- OpenAPI được sinh từ contract để phục vụ test và tài liệu nội bộ.
- API là modular monolith, không tách microservice trong MVP.

#### Database

- Amazon Aurora PostgreSQL Serverless v2.
- Cấu hình tối thiểu 0 ACU và cho phép auto-pause để giảm chi phí khi ít truy cập.
- RDS Data API để Lambda truy cập database mà không giữ connection pool hoặc
  chạy Lambda trong VPC.
- Drizzle ORM và Drizzle Kit cho schema, query và migration.
- Aurora Standard, chưa dùng read replica trong MVP.

Auto-pause có thể làm request đầu tiên sau thời gian dài không hoạt động chậm
khoảng 15 giây. Client phải có timeout/retry phù hợp và hiển thị trạng thái đang
khởi động dịch vụ. Nếu traffic ổn định, database sẽ không pause.

#### Authentication

- Amazon Cognito User Pool.
- Email/password và Google federation.
- Xác minh email bắt buộc.
- Liên kết Google identity với local user chỉ khi email từ cả hai nguồn đã được
  xác minh; thao tác link được thực hiện phía server bằng quyền Admin.
- Không bật Cognito Advanced Security Features trong MVP để tránh chi phí ngoài
  dự kiến; vẫn áp dụng rate limit và audit ở API.

#### Ảnh và file

- Amazon S3 lưu ảnh gốc, ảnh tối ưu và ZIP tạm thời trong các prefix/bucket tách
  biệt.
- Client upload trực tiếp lên S3 bằng presigned multipart upload; file không đi
  xuyên qua API Lambda.
- ZIP tối đa 600 MB, chỉ chứa ảnh ở thư mục gốc.
- S3 lifecycle tự xóa ZIP tạm và file upload lỗi.
- Worker dùng Sharp để kiểm tra, resize và chuyển bản phân phối sang WebP.
- CloudFront + Origin Access Control bảo vệ S3 origin.
- Ảnh câu hỏi dùng CloudFront signed cookie hoặc signed URL và chỉ cấp sau khi
  user đã đăng nhập.

#### Tác vụ nền

- Amazon SQS cho hàng đợi giải nén ZIP, xử lý ảnh và gọi AI.
- Mỗi queue có Dead-Letter Queue.
- AWS Lambda worker tiêu thụ queue.
- Reserved concurrency giới hạn pipeline AI ở 5 ảnh song song.
- EventBridge Scheduler hoặc worker định kỳ hoàn tất lượt thi hết giờ.
- Tất cả handler phải idempotent.

#### AI Vision

- Xây `VisionProvider` interface để không khóa vào một vendor/model.
- Provider ban đầu đề xuất: Gemini 3.1 Flash-Lite qua paid API.
- Gửi từng ảnh và yêu cầu structured JSON gồm `questionType`, `optionCount`,
  `answers` và `confidence`.
- Không gửi thông tin người dùng cho AI.
- Chỉ gọi AI trong luồng Admin import, không gọi khi sinh viên làm bài.
- Admin luôn duyệt kết quả trước khi public.
- Có thể đổi sang Amazon Bedrock hoặc provider khác sau benchmark mà không thay
  đổi domain logic.

#### Quan sát, email và bảo mật vận hành

- CloudWatch Logs, Metrics và Alarms.
- AWS Budgets cảnh báo tại các ngưỡng 25%, 50%, 75% và 90% credit/ngân sách.
- AWS CloudTrail cho audit hạ tầng.
- AWS Secrets Manager hoặc SSM Parameter Store cho secret.
- Amazon SES cho verify/reset email nếu không dùng email delivery mặc định của
  Cognito.
- Dùng duy nhất `support@onthilab.vn` làm địa chỉ gửi email hệ thống, Reply-To và
  nhận yêu cầu hỗ trợ.
- AWS WAF chỉ bật khi traffic/rủi ro thực tế yêu cầu để tránh chi phí nền sớm.

#### Infrastructure as Code và CI/CD

- AWS CDK bằng TypeScript.
- Development, staging và production là các stack riêng.
- GitHub Actions dùng OIDC để deploy, không lưu access key dài hạn.
- Migration database chạy thành job riêng trước khi chuyển traffic.

#### Testing

- Vitest cho unit/integration test.
- Playwright cho end-to-end test.
- Test contract cho API.
- Test tải tập trung vào autosave, submit idempotency và 200 lượt thi đồng thời.

### 21.8. Ngân sách vận hành

Giá tham chiếu tại AWS Singapore ở thời điểm viết spec:

- Aurora PostgreSQL Serverless v2: 0,20 USD/ACU-giờ.
- Aurora Standard storage: 0,11 USD/GB-tháng.
- Aurora I/O: 0,22 USD/một triệu I/O.
- S3 Standard: 0,025 USD/GB-tháng cho 50 TB đầu tiên.
- Lambda có free tier một triệu request và 400.000 GB-giây mỗi tháng.
- API Gateway có free tier một triệu HTTP API call/tháng trong thời gian tài
  khoản đủ điều kiện.
- CloudFront free tier hiện gồm 1 TB data transfer out.

Ước tính theo workload:

| Giai đoạn | AWS/tháng | AI ngoài AWS | Giả định chính |
|---|---:|---:|---|
| Development/beta nhỏ | 8–20 USD | 0–5 USD | Database pause phần lớn thời gian |
| Vận hành bình thường | 20–40 USD | 1–10 USD | 10.000 account, traffic phân tán |
| Tháng ôn thi cao điểm | 40–90 USD | 5–30 USD | Tối đa 200 lượt thi đồng thời |

Đây là estimate, không phải báo giá cố định. Aurora compute và lượng ảnh tải qua
CDN là hai biến số chính. AI chỉ chạy khi Admin import nên là chi phí theo số đề,
không theo số sinh viên.

Với 172 USD credit và giả định hết hạn 06/01/2027:

- Mục tiêu trung bình: không quá 25 USD AWS/tháng.
- Cảnh báo vận hành: 10, 20 và 25 USD.
- Ngưỡng cao điểm: 60 USD/tháng.
- Sau khi hết credit, ngân sách tiền thật hợp lý cho MVP là 25–40 USD/tháng.
- Nếu hai tháng liên tiếp vượt 40 USD, phải review Aurora ACU-hours, log
  retention, CDN egress và tần suất autosave trước khi tăng ngân sách.

Không mua Savings Plan hoặc Reserved Capacity trong MVP. Chỉ cân nhắc cam kết
dài hạn sau khi có ít nhất ba tháng dữ liệu tải thực tế.

### 21.9. Backup, retention và môi trường

- Aurora bật point-in-time recovery và giữ backup liên tục 7 ngày.
- Snapshot database hằng ngày được giữ 30 ngày.
- Ảnh gốc tồn tại trong suốt vòng đời đề và được xóa sau 30 ngày kể từ khi đề
  bị xóa.
- ZIP tạm và upload lỗi được lifecycle xóa sớm.
- Staging chỉ được deploy khi cần kiểm thử và xóa sau khi hoàn thành.
- Admin được import/export metadata và đáp án bằng CSV hoặc JSON.
- File do hệ thống export là template import chuẩn.
- Template có `schemaVersion`; hệ thống từ chối version không hỗ trợ và trả về
  danh sách lỗi theo dòng trước khi ghi dữ liệu.

### 21.10. Roadmap và góp ý

- Có trang roadmap public, không cần đăng nhập để xem.
- Roadmap hiển thị các nhóm Planned/In progress/Released.
- Admin tạo, sửa, sắp xếp và thay đổi trạng thái roadmap item.
- Roadmap item chỉ do Admin đăng; MVP không có vote.
- Có form gửi góp ý về tính năng, trải nghiệm hoặc lỗi chung.
- Người dùng phải đăng nhập mới được gửi góp ý để hạn chế spam.
- Góp ý được đưa vào trang quản trị để Admin phân loại và xử lý.

### 21.10.1. Trang pháp lý và yêu cầu gỡ nội dung

Trước khi public phải có:

- Điều khoản sử dụng.
- Chính sách quyền riêng tư.
- Tuyên bố độc lập, không đại diện cho trường.
- Tuyên bố đáp án và điểm số chỉ mang tính tham khảo.
- Form hoặc email yêu cầu sửa/gỡ nội dung.
- Thông tin liên hệ `support@onthilab.vn`.

Admin phải có quy trình ghi nhận, xem xét và phản hồi yêu cầu gỡ nội dung.

### 21.11. Ngôn ngữ và địa phương hóa

- Giao diện MVP dùng tiếng Việt.
- Nội dung ảnh câu hỏi giữ nguyên ngôn ngữ của đề.
- Chuỗi giao diện không được hard-code trực tiếp trong component; cấu trúc i18n
  phải sẵn sàng để bổ sung tiếng Anh sau MVP.
- Timezone nghiệp vụ mặc định: Asia/Ho_Chi_Minh.
- Ngày giờ hiển thị theo định dạng Việt Nam.

## 22. Nội dung, nguồn và miễn trừ trách nhiệm

- Mỗi đề cần lưu provenance nội bộ để Admin có thể truy vết nguồn.
- Không khẳng định đề hoặc đáp án là tài liệu chính thức nếu không có xác nhận.
- Giao diện phải ghi rõ đây là nền tảng ôn tập độc lập.
- Đáp án và điểm số chỉ mang tính tham khảo.
- Cần có kênh yêu cầu sửa hoặc gỡ nội dung.
- “Dữ liệu public” không tự động xác định toàn bộ quyền tái phân phối; chủ sở hữu
  cần xác nhận điều khoản của từng nguồn trước khi xuất bản.
- Admin chỉ upload ảnh đã tự chuẩn bị hợp lệ và sạch watermark. Hệ thống không
  tự động xóa logo hoặc watermark.

## 23. Thực thể dữ liệu sơ bộ

```text
User
├── UserProfile
├── UserRole
├── ExamAttempt
├── QuestionReport
├── ExamBookmark
├── QuestionBookmark
├── ProductFeedback
└── Entitlement

Campus
└── Exam

Major
└── Curriculum
    └── CurriculumCourse
        ├── StudyTerm
        └── Course
            └── Exam
                └── ExamRevision
                    └── Question
                        └── AnswerKeyVersion

ExamAttempt
├── ExamRevision
└── AttemptAnswer

Plan
├── PlanEntitlement
├── PlanPriceVersion
├── Subscription
├── PaymentOrder
└── UsageRecord

RoadmapItem
```

Quan hệ chính xác giữa Campus, Major và Curriculum cần cho phép curriculum dùng
chung giữa nhiều campus nhưng đề vẫn được lọc theo campus.

## 24. Acceptance criteria MVP sơ bộ

### 24.1. Danh mục

- Admin có thể tạo đủ campus, ngành, curriculum, kỳ 1–9 và môn.
- User nhìn thấy môn chưa có đề với trạng thái phù hợp.
- User có thể lọc đề theo campus hoặc chọn tất cả campus.

### 24.2. Nhập đề

- Admin có thể tạo một đề Draft và upload nhiều ảnh.
- Hệ thống hỗ trợ một lần nhập đề với số ảnh linh hoạt; tên ảnh có thể tùy ý, hệ thống tự gán thứ tự nội bộ theo manifest ZIP và theo dõi lỗi từng ảnh.
- Mỗi ảnh trở thành một câu và có thể đổi thứ tự.
- Admin cấu hình được Single/Multiple, A–D/A–E/A–F và đáp án.
- Hệ thống chặn publish khi thiếu ảnh, thiếu đáp án hoặc còn đáp án AI chưa duyệt.
- Admin có thể preview và publish đề.

### 24.3. Làm bài

- User chưa đăng nhập không thể bắt đầu thi.
- User bắt đầu được một lượt với thời hạn do server xác định.
- Mỗi trang hiển thị đúng một câu.
- User chuyển Previous/Next và sửa đáp án được.
- Reload không làm đổi thứ tự câu.
- Hết thời gian hệ thống tự nộp.
- Nộp nhiều lần không tạo kết quả trùng.

### 24.4. Chấm và lịch sử

- Single choice được chấm theo đáp án snapshot.
- Multiple choice được chấm theo quy tắc đã cấu hình.
- User xem được kết quả ngay sau khi nộp.
- User xem lại được lịch sử và làm lại cùng đề.
- Sửa đáp án sau này không thay đổi điểm đã lưu.

### 24.5. Report và phân quyền

- User report được một câu sau khi nộp.
- Admin xem và xử lý report được.
- User không thể truy cập chức năng Admin.
- Admin có thể cấp quyền Contributor.

### 24.6. Monetization khi được bật

- Free User không thể bắt đầu lượt thứ ba trong cùng ngày theo giờ Việt Nam.
- Giới hạn không làm hỏng lượt đang diễn ra hoặc lịch sử.
- Payment link luôn dùng giá lấy từ server.
- Redirect thành công không tự kích hoạt Pro.
- Webhook sai chữ ký không làm thay đổi Payment Order.
- Gửi cùng một webhook nhiều lần chỉ tạo một entitlement.
- Mua khi Pro còn hạn cộng nối tiếp đúng ngày hết hạn.
- Payment Order chưa kết luận được đối soát trong tối đa 24 giờ.
- Admin xem và xử lý được yêu cầu hoàn tiền.

## 25. Trạng thái yêu cầu

- Không còn câu hỏi P0 chặn thiết kế database hoặc logic thi.
- Không còn câu hỏi P1 chặn trải nghiệm MVP.
- Monetization đã có rule nghiệp vụ nhưng chỉ được bật sau mốc đánh giá đã chốt.
- PE, OCR, phân tích topic và các tính năng ngoài phạm vi được quản lý bằng
  roadmap; không chặn MVP.

## 26. Nhật ký quyết định

| Ngày | Quyết định |
|---|---|
| 2026-07-23 | Đối tượng chính là sinh viên FPT ở tất cả campus |
| 2026-07-23 | Hỗ trợ cấu trúc đủ chín kỳ, mọi ngành/môn; dữ liệu phát hành dần |
| 2026-07-23 | Quản lý curriculum để người dùng chọn đúng môn |
| 2026-07-23 | MVP tập trung FE trắc nghiệm; PE ngoài phạm vi |
| 2026-07-23 | Mỗi ảnh tương ứng một câu hỏi |
| 2026-07-23 | Image-first; OCR không bắt buộc để xuất bản |
| 2026-07-23 | Hỗ trợ chọn một và chọn nhiều, lựa chọn A–F |
| 2026-07-23 | Mô phỏng nguyên bản một đề, không trộn câu giữa nhiều đề |
| 2026-07-23 | Có thể trộn thứ tự câu trong một đề |
| 2026-07-23 | Không pause; hết giờ tự động nộp; được quay lại câu trước |
| 2026-07-23 | Được làm lại cùng một đề |
| 2026-07-23 | Đăng nhập bằng Google hoặc email/mật khẩu |
| 2026-07-23 | Hồ sơ bắt buộc có MSSV, campus và ngành |
| 2026-07-23 | Admin vận hành toàn bộ và có thể cấp Contributor |
| 2026-07-23 | Đáp án AI chỉ là đề xuất; Admin phải duyệt đủ trước khi public |
| 2026-07-23 | User có thể report để Admin xem xét |
| 2026-07-23 | Sửa đáp án không làm thay đổi điểm lịch sử |
| 2026-07-23 | Mô hình kinh doanh dự kiến là freemium |
| 2026-07-23 | Đề bắt buộc có học kỳ tổ chức và năm |
| 2026-07-23 | Chấm theo thang 10, các câu cùng trọng số, làm tròn hai chữ số |
| 2026-07-23 | Multiple choice phải exact match, không có điểm từng phần hoặc điểm âm |
| 2026-07-23 | Reload/mất mạng được tiếp tục trên cùng thiết bị, timer không dừng |
| 2026-07-23 | Một lượt thi chỉ hoạt động trên một thiết bị tại một thời điểm |
| 2026-07-23 | Admin bật/tắt trộn câu ở cấp đề; mặc định bật |
| 2026-07-23 | Không trộn lựa chọn A–F |
| 2026-07-23 | User tự chọn curriculum; MSSV duy nhất, chưa xác minh với trường |
| 2026-07-23 | AI chỉ đề xuất đáp án, không tạo giải thích trong MVP |
| 2026-07-23 | Bản phát hành đầu miễn phí toàn bộ; chuẩn bị sẵn entitlement cho freemium |
| 2026-07-23 | Một đề FE điển hình có 60 ảnh, mỗi ảnh là một câu |
| 2026-07-23 | Hệ thống đề xuất Set kế tiếp khi nhiều đề trùng metadata |
| 2026-07-23 | Mỗi user chỉ có một lượt In progress trên toàn hệ thống |
| 2026-07-23 | Không hiển thị đạt/không đạt trong MVP |
| 2026-07-23 | Xem lại theo thứ tự đã làm và kèm số thứ tự gốc |
| 2026-07-23 | Không gửi thông báo report; user tự xem trạng thái report |
| 2026-07-23 | User sửa campus/ngành/curriculum; chỉ Admin sửa MSSV |
| 2026-07-23 | Xóa tài khoản xóa dữ liệu cá nhân, chỉ giữ thống kê ẩn danh |
| 2026-07-23 | Họ tên bắt buộc; không thu thập kỳ học hiện tại |
| 2026-07-23 | Guest chỉ xem danh mục và metadata, không xem câu hỏi/đáp án |
| 2026-07-23 | Không giới hạn số lần làm lại trong giai đoạn miễn phí |
| 2026-07-23 | Không OCR trong MVP; AI Vision đọc ảnh trực tiếp |
| 2026-07-23 | Admin tự chuẩn bị ảnh hợp lệ, sạch watermark trước khi upload |
| 2026-07-23 | Ảnh dùng tên 001–060; hỗ trợ JPG/PNG/WebP, tối đa 10 MB/ảnh |
| 2026-07-23 | Có thể bulk upload nhiều ảnh hoặc một file ZIP |
| 2026-07-23 | AI đề xuất loại câu, số lựa chọn và đáp án; tối đa 5 ảnh song song |
| 2026-07-23 | AI tự retry tối đa 3 lần và hỗ trợ retry thủ công |
| 2026-07-23 | Sửa đề public tạo revision mới; lượt cũ dùng snapshot cũ |
| 2026-07-23 | Mọi email đã xác minh được đăng ký |
| 2026-07-23 | Các phương thức đăng nhập cùng email được liên kết vào một User |
| 2026-07-23 | Hạ tầng production triển khai trên AWS |
| 2026-07-23 | Hết giờ chấm đáp án đã autosave kể cả khi mất mạng |
| 2026-07-23 | ZIP tối đa 600 MB và không chứa thư mục con |
| 2026-07-23 | Production dùng AWS Singapore `ap-southeast-1` |
| 2026-07-23 | Mục tiêu 3 tháng: 10.000 account, 200 lượt thi đồng thời, 1.000 đề |
| 2026-07-23 | Mục tiêu uptime 99,5%, RTO 4 giờ, RPO 15 phút |
| 2026-07-23 | Có khoảng 172 USD AWS credit và ưu tiên giảm chi phí nền |
| 2026-07-23 | AI được phép gọi API bên ngoài AWS để tối ưu chi phí |
| 2026-07-23 | Tech stack chính là TypeScript end-to-end và PostgreSQL |
| 2026-07-23 | Worker được hoàn tất auto-submit chậm tối đa 60 giây |
| 2026-07-23 | Database PITR 7 ngày và snapshot hằng ngày giữ 30 ngày |
| 2026-07-23 | Ảnh gốc xóa sau 30 ngày kể từ khi đề bị xóa |
| 2026-07-23 | Staging chỉ tạo khi cần và xóa sau khi test |
| 2026-07-23 | Admin hỗ trợ import/export CSV và JSON |
| 2026-07-23 | AWS credit hết hạn ngày 06/01/2027 |
| 2026-07-23 | Ngân sách AWS mục tiêu 25 USD, bình thường tối đa 40 USD, cao điểm 60 USD |
| 2026-07-23 | Tên sản phẩm được chọn là OnThiLab |
| 2026-07-23 | CSV/JSON dùng template và schema version do hệ thống export |
| 2026-07-23 | MVP có trang roadmap public và form góp ý |
| 2026-07-23 | Domain chính được chọn là `onthilab.vn` |
| 2026-07-23 | Gửi góp ý bắt buộc đăng nhập |
| 2026-07-23 | Roadmap chỉ Admin đăng và MVP không có vote |
| 2026-07-23 | UI MVP dùng tiếng Việt và sẵn sàng i18n tiếng Anh |
| 2026-07-23 | Dashboard có lượt đang thi, môn phù hợp, đề mới, kết quả và thống kê |
| 2026-07-23 | Lịch sử có best/average score, xu hướng và bộ lọc |
| 2026-07-23 | MVP hỗ trợ bookmark đề và câu hỏi |
| 2026-07-23 | Chốt SLO API, ảnh, autosave và Aurora cold start |
| 2026-07-23 | MVP không triển khai MFA |
| 2026-07-23 | Có đủ trang pháp lý và quy trình gỡ nội dung trước khi public |
| 2026-07-23 | Dùng `support@onthilab.vn` cho email hệ thống và hỗ trợ |
| 2026-07-23 | MVP không có leaderboard hoặc streak |
| 2026-07-23 | Chỉ thống kê môn/đề/câu sai; chưa phân tích topic yếu |
| 2026-07-23 | Không gửi thông báo đề mới; chỉ hiển thị trên dashboard |
| 2026-07-23 | Review monetization sau 3 tháng hoặc 1.000 MAU |
| 2026-07-23 | Pro bán theo subscription 1 tháng, 3 tháng và 1 năm |
| 2026-07-23 | Sau thời gian miễn phí, Free tối đa 2 lượt thi/ngày |
| 2026-07-23 | Pro thi không giới hạn và có thống kê nâng cao |
| 2026-07-23 | Chốt bộ chỉ số thành công ba tháng đầu |
| 2026-07-23 | Giá Pro: 29.000₫/tháng, 69.000₫/3 tháng, 199.000₫/năm |
| 2026-07-23 | Dùng payOS với tài khoản cá nhân đã xác minh |
| 2026-07-23 | Subscription không tự gia hạn; mua mới cộng nối tiếp hạn hiện tại |
| 2026-07-23 | Chốt webhook, đối soát 24 giờ và chính sách hoàn tiền |

## 27. Tài liệu kỹ thuật tham chiếu

- [Aurora Serverless v2 auto-pause về 0 ACU](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2-auto-pause.html)
- [RDS Data API cho Aurora](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/data-api.html)
- [AWS Lambda pricing và free tier](https://aws.amazon.com/lambda/pricing/)
- [Lambda xử lý SQS](https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html)
- [Amazon Cognito và social identity provider](https://docs.aws.amazon.com/cognito/latest/developerguide/what-is-amazon-cognito.html)
- [Liên kết federated identity trong Cognito](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-identity-federation-consolidate-users.html)
- [CloudFront Origin Access Control cho S3](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html)
- [Hono trên AWS Lambda](https://hono.dev/docs/getting-started/aws-lambda)
- [Drizzle với AWS Data API PostgreSQL](https://orm.drizzle.team/docs/connect-aws-data-api-pg)
- [Gemini image understanding](https://ai.google.dev/gemini-api/docs/image-understanding)
- [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output)
- [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)

## 28. Tên sản phẩm

Không dùng `FPT` trong tên để tránh tạo cảm giác đây là sản phẩm chính thức của
trường và để sản phẩm có thể mở rộng sau này.

Khả dụng được kiểm tra ngày 2026-07-23; trạng thái có thể thay đổi bất kỳ lúc
nào và chưa thay thế việc kiểm tra nhãn hiệu:

| Tên | Domain khả dụng khi kiểm tra | Nhận xét |
|---|---|---|
| OnThiLab | `onthilab.com`, `onthilab.app`, `onthilab.vn` | Đề xuất số 1; dễ hiểu với sinh viên Việt Nam |
| DeThiLab | `dethilab.com`, `dethilab.app`, `dethilab.vn` | Nhấn mạnh kho đề và quá trình thử nghiệm |
| ThiThuLab | `thithulab.com`, `thithulab.app` | Mô tả đúng trải nghiệm thi thử nhưng dài hơn |
| LuyenDe | `luyende.app` | Ngắn và thuần Việt; `.com` đã được đăng ký |
| UniMock | `unimock.app` | Có khả năng mở rộng ra ngoài FPT; `.com` đã được đăng ký |

Tên được chọn: **OnThiLab**.

Domain chính được chọn: `onthilab.vn`; đăng ký thêm
`onthilab.com` nếu ngân sách cho phép và redirect về domain chính. Việc đăng ký
domain chưa được thực hiện trong phạm vi spec.

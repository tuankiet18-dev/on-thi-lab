# OnThiLab — Giới thiệu dự án

## Dự án là gì?

**OnThiLab** là nền tảng luyện đề thi cuối kỳ (FE/PE) dành riêng cho sinh viên **Đại học FPT**. Thay vì ôn thi bằng cách xem lại slide hay đề cũ chụp tay, sinh viên có thể làm bài trực tiếp trên hệ thống với môi trường giống thi thật: bộ đếm thời gian, tự động nộp bài khi hết giờ, chấm điểm tức thì và xem đáp án chi tiết sau khi nộp.

## Tại sao xây dựng OnThiLab?

Sinh viên FPT thường phải tìm đề cũ qua nhiều nguồn không chính thống, đề thiếu đáp án hoặc đáp án sai, và không có cách nào tự luyện trong điều kiện sát với thực tế thi. OnThiLab giải quyết đúng vấn đề đó:

- **Đề thi được kiểm duyệt** — mỗi đề phải qua bước duyệt đáp án trước khi xuất bản
- **Ưu tiên đúng môn** — hệ thống biết campus, ngành học và ưu tiên đề phù hợp
- **Làm bài như thi thật** — timer, autosave, không xem đáp án trước khi nộp
- **Theo dõi tiến độ** — điểm số, lịch sử, câu đã lưu để ôn lại

## Dành cho ai?

| Đối tượng         | Họ làm gì trên OnThiLab                           |
| ----------------- | ------------------------------------------------- |
| **Sinh viên FPT** | Tìm đề, làm bài thử, xem kết quả, ôn lại câu sai  |
| **Contributor**   | Nhập đề từ file ZIP, duyệt và chỉnh đáp án        |
| **Admin**         | Xuất bản đề, quản lý danh mục môn học, phân quyền |

## Tính năng cốt lõi

- 🔍 **Tìm kiếm thông minh** — tìm theo mã môn (SWD392, PRN222), tên môn, không phân biệt dấu
- 🎓 **Cá nhân hóa** — ưu tiên đề theo campus và ngành học của bạn
- ⏱️ **Exam engine** — timer server-side, autosave mỗi thay đổi, nộp bài idempotent
- 📊 **Thống kê** — điểm trung bình, điểm cao nhất, lịch sử làm bài
- 🔖 **Bookmark** — lưu đề và câu hỏi cần xem lại
- 🤖 **AI suggestions** — gợi ý đáp án bằng AI Vision, người duyệt quyết định áp dụng
- 📦 **Import ZIP** — nhập đề từ file ảnh + metadata, kiểm tra checksum chống trùng

## Stack kỹ thuật tóm tắt

```
Frontend:  React 19 + Vite + TanStack Router + Tailwind CSS v4
Backend:   Hono.js trên AWS Lambda (Node.js 22)
Database:  PostgreSQL (Supabase) + Drizzle ORM
Auth:      AWS Cognito + Google OAuth (PKCE flow)
Infra:     AWS CDK — Lambda, S3, CloudFront, SQS, API Gateway
CI/CD:     GitHub Actions
Testing:   Vitest + Playwright
```

## Trạng thái hiện tại

Dự án đang ở giai đoạn **Closed Beta** trên môi trường Staging tại `staging.onthilab.id.vn`. Các tính năng cốt lõi (auth, import đề, làm bài, chấm điểm) đã hoàn thiện. Mục tiêu ra mắt Production MVP trước **06/01/2027**.

---

> _"Ôn đúng môn. Vào đề ngay."_

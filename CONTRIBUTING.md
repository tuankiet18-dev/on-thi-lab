# Quy trình Git của OnThiLab

OnThiLab dùng GitHub Flow với branch ngắn hạn. `main` luôn phải ở trạng thái có
thể triển khai; không dùng branch `develop` lâu dài.

## Thiết lập một lần trên mỗi máy

```bash
pnpm git:setup
```

Lệnh này bật hook trong `.githooks`:

- `pre-commit` chặn các file credential phổ biến.
- `commit-msg` bắt buộc Conventional Commits.
- `pre-push` chặn push trực tiếp vào `main`, kiểm tra tên branch và chạy
  `pnpm validate`.

## Bắt đầu công việc

```bash
git switch main
git pull --ff-only
git switch -c feat/google-cognito-login
```

Prefix được chấp nhận:

| Prefix      | Khi sử dụng                     |
| ----------- | ------------------------------- |
| `feat/`     | Tính năng mới                   |
| `fix/`      | Sửa lỗi                         |
| `hotfix/`   | Sửa lỗi production khẩn cấp     |
| `refactor/` | Đổi cấu trúc, không đổi hành vi |
| `test/`     | Thêm hoặc sửa kiểm thử          |
| `docs/`     | Chỉ thay đổi tài liệu           |
| `chore/`    | Công việc bảo trì               |
| `ci/`       | Workflow và pipeline            |

Tên sau prefix dùng chữ thường, số, dấu chấm, gạch dưới hoặc gạch ngang.

## Commit và pull request

Commit theo Conventional Commits:

```text
feat(auth): add Google sign-in
fix(exam): prevent duplicate submission
docs: document payOS webhook
```

Đẩy branch và mở pull request:

```bash
git push -u origin feat/google-cognito-login
gh pr create --fill
```

Chỉ merge khi toàn bộ CI đạt. Dùng **Squash and merge** để giữ lịch sử `main`
gọn, sau đó xóa branch.

## Hotfix

Hotfix vẫn phải qua pull request:

```bash
git switch main
git pull --ff-only
git switch -c hotfix/submit-timeout
```

Không bỏ qua CI và không force-push vào `main`.

## Secrets

- Chỉ lưu local trong `.env.local`.
- Không gửi Google, payOS hoặc AWS secret qua commit, PR, issue hay chat.
- Production/staging lưu trong AWS Secrets Manager.
- Nếu secret từng bị commit, xóa file là chưa đủ: phải revoke/rotate secret ngay.

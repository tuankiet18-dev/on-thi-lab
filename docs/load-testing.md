# Load testing OnThiLab

Chỉ chạy load test trên staging. Bộ test mô phỏng đúng đường tải nóng: mở catalog,
tạo hoặc resume attempt, tải session, autosave từng câu và nộp bài.

## Kết quả gần nhất

Ngày 14/08/2026, staging đạt workload 200 sinh viên đồng thời với error rate
0,02%, API p95 173 ms và autosave p95 171 ms. Bài test 300 users có error rate
0,29% nhưng ghi nhận 42 Lambda throttles khi account concurrency chạm quota 10;
vì vậy mốc 300 chưa được coi là đạt. Bảng kết quả đầy đủ và quyết định release
nằm trong `docs/project-status.md`.

## Chuẩn bị

1. Cài [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/) hoặc bật
   Docker. Lệnh của project tự dùng image `grafana/k6` khi `k6` chưa có trong
   `PATH`.
2. Tạo một đề staging đã publish có 50 hoặc 60 câu.
3. Tạo tài khoản Cognito staging riêng cho từng virtual user và hoàn tất profile.
4. Sao chép `load-tests/users.example.json` thành
   `load-tests/users.local.json`, rồi điền ID token còn hạn. File local đã được
   gitignore và tuyệt đối không được commit.

Không dùng lặp lại một token cho nhiều VU: như vậy chỉ đo một user và làm sai
nghiệp vụ attempt.

## Chạy theo từng nấc

```bash
BASE_URL="https://<staging-api-id>.execute-api.ap-southeast-1.amazonaws.com/staging" \
EXAM_ID="<published-exam-uuid>" \
TEST_USERS_FILE="./users.local.json" \
TARGET_VUS=100 \
pnpm test:load:staging
```

Chạy lần lượt `TARGET_VUS=10`, `50`, `100`, `200`, rồi `300`. Mặc định mỗi sinh viên trả
lời một câu sau khoảng 5 giây, tương đương xấp xỉ 60 autosave/giây ở mốc 300
người. Có thể đặt `MAX_QUESTIONS`, `ANSWER_INTERVAL_SECONDS`, `RAMP_UP`, `HOLD`
và `RAMP_DOWN` để tạo một bài test ngắn hoặc một đợt burst có chủ đích.

## Điều kiện đạt

- Tỷ lệ request lỗi dưới 1%.
- p95 toàn API dưới 2 giây.
- p95 autosave dưới 1 giây.
- Submit lỗi dưới 0,1% và không mất đáp án đã nhận HTTP 200.
- Lambda không throttle; concurrency không duy trì trên 32.
- Supabase không cạn connection, CPU/RAM không duy trì trên 70%.

Nếu test thất bại, lưu summary k6 cùng thời gian chạy, xem CloudWatch API
Gateway/Lambda và Supabase Observability trong cùng khoảng thời gian trước khi
nâng compute.

Không xem latency thấp là đạt nếu Lambda có throttle hoặc đáp án HTTP 200 bị
mất. Sau mỗi bài test thay đổi capacity đã công bố, cập nhật
`docs/project-status.md`.

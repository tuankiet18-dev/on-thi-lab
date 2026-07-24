# OnThiLab Staging & Production Runbook

Tài liệu này mô tả quy trình triển khai (Deploy) và phục hồi (Rollback) cho môi trường Staging/Production trên AWS.

## 1. Yêu cầu trước khi triển khai

- Tài khoản AWS có đủ quyền quản trị (AdministratorAccess).
- Đã cấu hình AWS CLI qua `aws configure`.
- Đã cài đặt pnpm và Node.js >= 20.

## 2. Triển khai (Deploy) Môi trường Staging

Môi trường staging giả lập lại toàn bộ các dịch vụ trên production nhưng với quy mô nhỏ hơn (vd: RDS Serverless min 0.5 ACU).

```bash
# B1: Cài đặt dependencies
pnpm install

# B2: Cấu hình biến môi trường
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
export CDK_DEFAULT_REGION="ap-southeast-1"
export ONTHILAB_STAGE="staging"

# B3: Build các package
pnpm build

# B4: Triển khai hạ tầng bằng AWS CDK
cd infra
pnpm cdk deploy --require-approval never
```

## 3. Quy trình Rollback

Trong trường hợp bản triển khai gặp sự cố nghiêm trọng ảnh hưởng đến hệ thống, làm theo các bước sau để rollback.

### Rollback Mã Nguồn & CDK

1. Tìm commit gần nhất hoạt động ổn định.
2. Checkout về commit đó:
   ```bash
   git checkout <stable_commit_hash>
   ```
3. Chạy lại lệnh deploy CDK để CloudFormation đồng bộ lại trạng thái hạ tầng cũ:
   ```bash
   cd infra
   pnpm cdk deploy --require-approval never
   ```
4. Đẩy (push) revert commit lên repository để đồng bộ với team:
   ```bash
   git revert HEAD
   git push origin main
   ```

### Xử lý sự cố Dữ liệu (Database)

- RDS Cluster được backup tự động. Nếu có sự cố xóa nhầm dữ liệu, có thể restore snapshot RDS gần nhất từ AWS Console.

## 4. Theo dõi và Cảnh báo (Monitoring)

- **SQS Dead Letter Queue:** Cảnh báo sẽ kích hoạt nếu có thông báo kẹt trong DLQ (Worker xử lý thất bại sau 3 lần thử lại). Cần truy cập AWS Console -> SQS để kiểm tra nguyên nhân (ví dụ do lỗi API AI, hay ZIP không hợp lệ).
- **SQS Old Message:** Cảnh báo kích hoạt nếu một tin nhắn kẹt ở hàng đợi chính hơn 1 giờ. Cần kiểm tra xem tiến trình Worker chạy trên container/máy ảo có bị crash hay không.
- **AWS Budget:** Có thể thiết lập thêm Budget Alerts trong [AWS Billing Console](https://console.aws.amazon.com/billing/home#/budgets) để nhận cảnh báo qua email khi chi phí vượt ngưỡng 10 USD/tháng cho môi trường Staging.

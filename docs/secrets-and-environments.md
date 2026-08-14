# Secrets và môi trường

## Quy tắc

- Không gửi secret qua chat, issue, email thường hoặc screenshot.
- Không commit `.env.local`, `client_secret.json`, access key hoặc file export từ
  Google/payOS.
- Biến có prefix `VITE_` là public vì được đóng gói vào browser.
- CI hiện chỉ validate/test/build và không có quyền deploy. Deploy staging/prod
  được thực hiện bởi operator đã xác thực AWS CLI; không commit access key hoặc
  tạo key dài hạn cho GitHub Actions.
- Development, staging và production dùng credential khác nhau.

## Development local

Sao chép `.env.example` thành `.env.local` và chỉ điền trên máy:

```bash
cp .env.example .env.local
```

Auth development hiện được cấp phát bởi stack `OnThiLabAuth-dev` ở Singapore.
Stack auth được tách khỏi hạ tầng core để không vô tình tạo Aurora hoặc
CloudFront khi chỉ cấu hình đăng nhập:

```bash
pnpm --filter @onthilab/infra exec cdk deploy OnThiLabAuth-dev \
  -c stage=dev \
  -c cognitoDomainPrefix=onthilab-dev-563702590722
```

Các output cần chép vào `.env.local` là `CognitoDomain`, `UserPoolId` và
`UserPoolClientId`. App client là public SPA client và không có client secret.

Khi tạo Google OAuth Web application, dùng chính xác:

```text
Authorized JavaScript origin:
https://onthilab-dev-563702590722.auth.ap-southeast-1.amazoncognito.com

Authorized redirect URI:
https://onthilab-dev-563702590722.auth.ap-southeast-1.amazoncognito.com/oauth2/idpresponse
```

Google provider đã được cấu hình riêng cho development, staging và production.
Khi thay callback/logout URL phải kiểm tra cả Cognito app client, Google OAuth
client và biến public trong đúng `.env.<mode>`; không dùng URL localhost trong
staging/production.

`pnpm dev` tự nạp `.env.local` cho cả Vite và API development. Browser gửi
Cognito ID token qua bearer header; API dùng `COGNITO_USER_POOL_ID` và
`COGNITO_CLIENT_ID` để xác minh token. Không ghi token vào log.

Kiểm tra trước khi bật flag:

- `FEATURE_GOOGLE_AUTH_ENABLED=true` yêu cầu Cognito IDs.
- `FEATURE_AI_IMPORT_ENABLED=true` yêu cầu `AI_PROVIDER`, `AI_MODEL`,
  `AI_API_KEY` và tùy chọn `AI_BASE_URL`. `AI_SUGGESTION_QUEUE_URL` chuyển API
  từ hàng đợi local sang SQS; chỉ bật khi consumer AWS đã được deploy.
- `FEATURE_MONETIZATION_ENABLED=true` yêu cầu đủ ba payOS key và webhook HTTPS.

## AWS staging/production

Tên secret/parameter trên AWS:

```text
/onthilab/staging/google/client-id
/onthilab/staging/google/client-secret
/onthilab/staging/payos/client-id
/onthilab/staging/payos/api-key
/onthilab/staging/payos/checksum-key
/onthilab/staging/ai/api-key

/onthilab/prod/google/client-id
/onthilab/prod/google/client-secret
/onthilab/prod/payos/client-id
/onthilab/prod/payos/api-key
/onthilab/prod/payos/checksum-key
/onthilab/prod/ai/api-key
```

Database connection string dùng SSM Parameter Store `SecureString` tier
`Standard` để tránh phí lưu secret cố định:

```text
/onthilab/staging/database
/onthilab/prod/database
```

Secret được tham chiếu bằng ARN/name trong CDK, không đọc rồi ghi lại vào
CloudFormation output.

Google OAuth dùng hai SSM Parameter Store Standard `String` parameters
(`client-id` và `client-secret`) vì CloudFormation Cognito không hỗ trợ
`ssm-secure` dynamic reference cho Google provider. Chỉ deploy operator được
đọc các parameter này; giá trị không đi vào output của CloudFormation hoặc
browser. Nếu yêu cầu mã hóa at-rest, giữ client secret trong Secrets Manager
hoặc triển khai custom resource Cognito riêng.

Supabase connection string cũng được lưu server-side trong Parameter Store,
chỉ cho Lambda đọc:

```json
{
  "connectionString": "postgresql://..."
}
```

Không dùng Supabase service role key và không đưa `DATABASE_URL` hoặc bất kỳ
Supabase key nào vào biến `VITE_*`.

## Environment status

Trạng thái không nhạy cảm được ghi ở đây; không ghi giá trị parameter hoặc ARN.

| Hệ thống                     | Development        | Staging                  | Production       |
| ---------------------------- | ------------------ | ------------------------ | ---------------- |
| Cognito User Pool/App Client | Active             | Active                   | Active           |
| Google OAuth                 | Active             | Active                   | Active           |
| Database parameter           | Local `.env.local` | SSM + Supabase           | SSM + Supabase   |
| AI/OCR worker                | Optional           | Active                   | Active           |
| payOS                        | Local/configurable | Feature disabled         | Feature disabled |
| Public domain                | `localhost:5173`   | `staging.onthilab.id.vn` | `onthilab.id.vn` |

Sau khi rotate credential, deploy đúng stack/môi trường và smoke test login hoặc
worker tương ứng. Trạng thái phát hành tổng thể nằm trong
`docs/project-status.md`.

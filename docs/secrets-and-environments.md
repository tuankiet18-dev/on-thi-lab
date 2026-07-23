# Secrets và môi trường

## Quy tắc

- Không gửi secret qua chat, issue, email thường hoặc screenshot.
- Không commit `.env.local`, `client_secret.json`, access key hoặc file export từ
  Google/payOS.
- Biến có prefix `VITE_` là public vì được đóng gói vào browser.
- Production dùng GitHub Actions OIDC; không tạo AWS access key dài hạn cho CI.
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

Google provider development đã được thêm vào Cognito. Local có thể bật
`FEATURE_GOOGLE_AUTH_ENABLED=true`; staging/production vẫn giữ tắt cho tới khi
có credential riêng và đăng nhập end-to-end thành công.

`pnpm dev` tự nạp `.env.local` cho cả Vite và API development. Browser gửi
Cognito ID token qua bearer header; API dùng `COGNITO_USER_POOL_ID` và
`COGNITO_CLIENT_ID` để xác minh token. Không ghi token vào log.

Kiểm tra trước khi bật flag:

- `FEATURE_GOOGLE_AUTH_ENABLED=true` yêu cầu Cognito IDs.
- `FEATURE_AI_IMPORT_ENABLED=true` yêu cầu AI provider/model/key phù hợp.
- `FEATURE_MONETIZATION_ENABLED=true` yêu cầu đủ ba payOS key và webhook HTTPS.

## AWS staging/production

Tên secret dự kiến:

```text
/onthilab/staging/google/oauth
/onthilab/staging/payos/client-id
/onthilab/staging/payos/api-key
/onthilab/staging/payos/checksum-key
/onthilab/staging/ai/api-key

/onthilab/prod/google/oauth
/onthilab/prod/payos/client-id
/onthilab/prod/payos/api-key
/onthilab/prod/payos/checksum-key
/onthilab/prod/ai/api-key
```

Secret được tham chiếu bằng ARN/name trong CDK, không đọc rồi ghi lại vào
CloudFormation output.

Google OAuth dùng một JSON secret để giảm số secret phải trả phí:

```json
{
  "clientId": "...",
  "clientSecret": "..."
}
```

## Credential checklist

| Hệ thống                     | Development | Staging        | Production            |
| ---------------------------- | ----------- | -------------- | --------------------- |
| AWS account/role             | Active      | Pending        | Pending               |
| Google OAuth client          | Active      | Pending        | Pending               |
| Cognito User Pool/App Client | Provisioned | Pending        | Pending               |
| AI Vision provider           | Pending     | Pending        | Pending               |
| payOS channel                | Local, tắt  | Pending        | Pending               |
| Domain và DNS                | Không cần   | CloudFront URL | `onthilab.vn`         |
| Support mailbox              | Gmail tạm   | Gmail tạm      | `support@onthilab.vn` |

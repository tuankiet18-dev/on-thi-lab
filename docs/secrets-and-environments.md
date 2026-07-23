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

Kiểm tra trước khi bật flag:

- `FEATURE_GOOGLE_AUTH_ENABLED=true` yêu cầu Cognito IDs.
- `FEATURE_AI_IMPORT_ENABLED=true` yêu cầu AI provider/model/key phù hợp.
- `FEATURE_MONETIZATION_ENABLED=true` yêu cầu đủ ba payOS key và webhook HTTPS.

## AWS staging/production

Tên secret dự kiến:

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

Secret được tham chiếu bằng ARN/name trong CDK, không đọc rồi ghi lại vào
CloudFormation output.

## Credential checklist

| Hệ thống                     | Development | Staging        | Production            |
| ---------------------------- | ----------- | -------------- | --------------------- |
| AWS account/role             | Pending     | Pending        | Pending               |
| Google OAuth client          | Pending     | Pending        | Pending               |
| Cognito User Pool/App Client | Scaffold    | Pending        | Pending               |
| AI Vision provider           | Pending     | Pending        | Pending               |
| payOS channel                | Không bật   | Pending        | Pending               |
| Domain và DNS                | Không cần   | CloudFront URL | `onthilab.vn`         |
| Support mailbox              | Gmail tạm   | Gmail tạm      | `support@onthilab.vn` |

"""Compact profile for LinkedIn: main flows only (no Route 53, Groq, option-count queue, SSM, CloudWatch)."""
S, GRAY, PINK, BLUE = "#475569", "#9ca3af", "#db2777", "#2563eb"  # same palette as onthilab_diagram.py
TITLE = "OnThiLab: serverless on AWS"
SUBTITLE = "Simplified view of the production architecture (ap-southeast-1)"
OUT = "onthilab-short"
W, H = 1600, 800
ICON_SZ = 96
N = {
    "user": (110, 420, "browser", ["Browser", "Student / Admin"]),
    "cf": (380, 210, "cf", ["CloudFront x2", "web app + question images"]),
    "s3": (680, 210, "s3", ["S3 x2", "web files + question images"]),
    "cognito": (380, 420, "cognito", ["Cognito", "Google sign-in"]),
    "google": (680, 420, "google", ["Google", "identity provider"]),
    "apigw": (380, 630, "apigw", ["API Gateway", "rate limited"]),
    "api": (680, 630, "lambda", ["API Lambda", "Node 22, Hono", "+ AI hints via Groq"]),
    "ocrq": (1000, 260, "sqs", ["OCR queue", "SQS"]),
    "ocrdlq": (1000, 430, "sqs", ["Dead-letter queue", "after 3 failures"]),
    "worker": (1250, 260, "lambda", ["OCR worker", "idempotent claim"]),
    "textocr": (1500, 260, "lambda", ["Text OCR", "Tesseract + PaddleOCR"]),
    "db": (1000, 630, "supabase", ["Supabase Postgres", "transaction pooler"]),
}
BANDS = [
    (300, 110, 780, 310, "Edge: static web + images"),
    (300, 320, 780, 520, "Authentication"),
    (300, 530, 780, 755, "API"),
    (900, 110, 1580, 545, "Background jobs"),
]
TOPLABEL = {"ocrq", "worker", "textocr"}
E = [
    (["user", "cf"], "HTTPS", S, 0), (["cf", "s3"], "OAC", S, 0),
    (["user", "cognito"], "login (PKCE)", BLUE, 0), (["cognito", "google"], "OAuth 2.0", BLUE, 0),
    (["user", "apigw"], "Bearer token", S, 0), (["apigw", "api"], "", S, 0),
    (["api", "cognito"], "verify JWT", BLUE, 1),
    (["api", "db"], "SQL", S, 0),
    ([(734, 600), (850, 600), (850, 260), ("ocrq", "l")], "enqueue", PINK, 1),
    (["ocrq", "worker"], "", PINK, 1), (["worker", "textocr"], "invoke", S, 0),
    (["ocrq", "ocrdlq"], "", GRAY, 1),
    ([("worker", "b"), (1250, 630), ("db", "r")], "save result", S, 0),
]

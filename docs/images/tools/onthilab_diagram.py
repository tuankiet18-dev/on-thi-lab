"""Hand-placed architecture diagram. Run: uv run --with diagrams python onthilab_diagram.py && python3 render.py"""
import base64, os, sys, diagrams

R = os.path.join(os.path.dirname(diagrams.__file__), "..", "resources")
HERE = os.path.dirname(os.path.abspath(__file__))
ICON = {
    "browser": f"{R}/onprem/client/users.png",
    "r53": f"{R}/aws/network/route-53.png",
    "cf": f"{R}/aws/network/cloudfront.png",
    "s3": f"{R}/aws/storage/simple-storage-service-s3-bucket.png",
    "cognito": f"{R}/aws/security/cognito.png",
    "apigw": f"{R}/aws/network/api-gateway.png",
    "lambda": f"{R}/aws/compute/lambda.png",
    "sqs": f"{R}/aws/integration/simple-queue-service-sqs.png",
    "ssm": f"{R}/aws/management/systems-manager-parameter-store.png",
    "cw": f"{R}/aws/management/cloudwatch.png",
    "google": f"{HERE}/google.png",
    "supabase": f"{HERE}/supabase.png",
    "groq": f"{HERE}/groq.png",
}
def b64(p): return "data:image/png;base64," + base64.b64encode(open(p, "rb").read()).decode()

N = {  # id: (x, y, icon, label lines)
    "user": (130, 540, "browser", ["Browser", "Student / Contributor / Admin"]),
    "r53": (130, 230, "r53", ["Route 53", "onthilab.id.vn", "auth.onthilab.id.vn"]),
    "cfweb": (450, 260, "cf", ["CloudFront", "Web SPA"]),
    "s3web": (850, 260, "s3", ["S3 web bucket", "private, OAC"]),
    "cfimg": (450, 400, "cf", ["CloudFront", "question images, cache 1y"]),
    "s3img": (850, 400, "s3", ["S3 question images", "OAC, also ZIP upload (presigned PUT)"]),
    "cognito": (450, 605, "cognito", ["Cognito User Pool", "Managed Login, PKCE"]),
    "google": (850, 605, "google", ["Google", "identity provider"]),
    "apigw": (450, 815, "apigw", ["API Gateway", "80 rps, burst 160"]),
    "api": (850, 815, "lambda", ["API Lambda", "Node 22, Hono, x86_64"]),
    "ocrq": (1250, 340, "sqs", ["OCR queue", "visibility 180 s"]),
    "ocrdlq": (1250, 530, "sqs", ["OCR DLQ", "keeps 14 days"]),
    "worker": (1480, 340, "lambda", ["OCR worker", "Node 22, arm64"]),
    "textocr": (1750, 340, "lambda", ["Text OCR", "Python container,", "Tesseract + PaddleOCR"]),
    "optq": (1250, 740, "sqs", ["Option-count queue", "visibility 180 s"]),
    "optdlq": (1250, 890, "sqs", ["Option-count DLQ", "keeps 14 days"]),
    "optw": (1480, 740, "lambda", ["Option-count worker", "Python container, RapidOCR"]),
    "groq": (2100, 170, "groq", ["Groq API", "AI Vision answer hints"]),
    "db": (2100, 740, "supabase", ["Supabase Postgres", "transaction pooler"]),
    "ssm": (820, 1160, "ssm", ["SSM Parameter Store", "DB URL, AI API key"]),
    "cw": (450, 1160, "cw", ["CloudWatch", "12 alarms (no notification yet)"]),
}
BANDS = [  # x0, y0, x1, y1, title
    (330, 175, 1000, 490, "Edge: static web and question images"),
    (330, 505, 1000, 685, "Auth stack (OnThiLabAuth)"),
    (330, 715, 1000, 915, "API"),
    (1100, 190, 1900, 985, "Background jobs (SQS + Lambda, batch 1, max 3 concurrent)"),
    (1950, 60, 2250, 860, "Outside AWS"),
    (330, 1070, 1000, 1270, "Config and monitoring"),
]
S, GRAY, PINK, BLUE = "#475569", "#9ca3af", "#db2777", "#2563eb"
# (path of points or two node ids, label, colour, dashed)
E = [
    ([("user", "r"), (398, 280)], "HTTPS", S, 0), (["user", "cfimg"], "images", S, 0),
    (["user", "cognito"], "login (PKCE)", BLUE, 0),
    (["user", "apigw"], "Bearer ID token", S, 0),
    ([("r53", "r"), (398, 240)], "alias", GRAY, 1),
    (["cfweb", "s3web"], "", S, 0), (["cfimg", "s3img"], "", S, 0),
    (["cognito", "google"], "OAuth 2.0", BLUE, 0),
    (["apigw", "api"], "", S, 0),
    (["api", "cognito"], "verify JWT", BLUE, 1),
    ([("api", "r"), (1030, 815), (1030, 340), ("ocrq", "l")], "enqueue", PINK, 1),
    ([(1030, 740), ("optq", "l")], "enqueue", PINK, 1),
    ([(1030, 170), ("groq", "l")], "answer hints (HTTPS, 20 s timeout)", S, 0),
    (["ocrq", "worker"], "", PINK, 1), (["optq", "optw"], "", PINK, 1),
    (["ocrq", "ocrdlq"], "after 3 receives", GRAY, 1), (["optq", "optdlq"], "after 3 receives", GRAY, 1),
    (["worker", "textocr"], "invoke", S, 0),
    ([("worker", "b"), (1480, 560), (2100, 560), ("db", "t")], "claim + save result (SQL)", S, 0), (["optw", "db"], "save option count (SQL)", S, 0),
    ([(880, 867), (880, 1020), (2200, 1020), (2200, 740), ("db", "r")], "SQL", S, 0),
    ([("ssm", "t"), (820, 867)], "read at cold start", GRAY, 1),
]
NOTES = [  # tags under nodes that read S3 images (kept off the canvas to avoid crossing arrows)
    ("api", 98, "also reads/writes S3 images"),
    ("textocr", 112, "reads image from S3"),
    ("optw", 98, "reads image from S3"),
]
TOPLABEL = {"api", "ocrq", "worker", "textocr", "optq", "optw"}
ICON_SZ = 96
def anchor(n, side=None, to=None):
    x, y = N[n][0], N[n][1]
    h = ICON_SZ / 2 + 4
    if side == "r": return (x + h, y)
    if side == "l": return (x - h, y)
    if side == "t": return (x, y - h)
    if side == "b": return (x, y + h)
    tx, ty = N[to][0], N[to][1]
    if abs(tx - x) >= abs(ty - y): return (x + (h if tx > x else -h), y)
    return (x, y + (h if ty > y else -h))

TITLE = "OnThiLab: production architecture on AWS"
SUBTITLE = "Region ap-southeast-1. Solid = request path, pink dashed = queue job, blue = authentication, gray dotted = config or failure path."
OUT = "onthilab"
W, H = 2300, 1310
if len(sys.argv) > 1 and sys.argv[1] == "short":  # compact version for social media
    from short_profile import *  # noqa: F401,F403
out = []
out.append(f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{W}" height="{H}" font-family="Noto Sans, Helvetica, Arial, sans-serif">')
out.append('<defs>' + ''.join(f'<marker id="m{i}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0L10 5L0 10z" fill="{c}"/></marker>' for i, c in enumerate([S, GRAY, PINK, BLUE])) + '</defs>')
out.append(f'<rect width="{W}" height="{H}" fill="#fff"/>')
out.append(f'<text x="60" y="52" font-size="34" font-weight="700" fill="#0f172a">{TITLE}</text>')
out.append(f'<text x="60" y="82" font-size="18" fill="#475569">{SUBTITLE}</text>')
for x0, y0, x1, y1, t in BANDS:
    out.append(f'<rect x="{x0}" y="{y0}" width="{x1-x0}" height="{y1-y0}" rx="18" fill="#eff6ff" stroke="#bfdbfe" stroke-width="2"/>')
    out.append(f'<text x="{x0+18}" y="{y0+28}" font-size="18" font-weight="600" fill="#1e3a8a">{t}</text>')
cmap = {S: 0, GRAY: 1, PINK: 2, BLUE: 3}
labels = []
for pts, label, col, dashed in E:
    P = []
    for i, p in enumerate(pts):
        if isinstance(p, str):
            nxt = pts[i + 1] if i + 1 < len(pts) else pts[i - 1]
            to = nxt if isinstance(nxt, str) else (nxt[0] if isinstance(nxt, tuple) and isinstance(nxt[0], str) else None)
            if to is None:
                # next is a coordinate: anchor on the side facing it
                tx, ty = nxt
                x, y = N[p][0], N[p][1]
                side = ("r" if tx > x else "l") if abs(tx - x) >= abs(ty - y) else ("b" if ty > y else "t")
                P.append(anchor(p, side))
            else:
                P.append(anchor(p, to=to))
        elif isinstance(p[0], str):
            P.append(anchor(p[0], p[1]))
        else:
            P.append(p)
    # fix last point when it is a bare node id: anchor facing the previous point
    if isinstance(pts[-1], str) and len(P) > 1:
        px, py = P[-2]; x, y = N[pts[-1]][:2]
        side = ("l" if px < x else "r") if abs(px - x) >= abs(py - y) else ("t" if py < y else "b")
        P[-1] = anchor(pts[-1], side)
    d = "M" + " L".join(f"{x:.0f} {y:.0f}" for x, y in P)
    dash = ' stroke-dasharray="9 7"' if dashed else ""
    out.append(f'<path d="{d}" fill="none" stroke="{col}" stroke-width="2.5"{dash} marker-end="url(#m{cmap[col]})"/>')
    if label:
        # put the label on the longest segment
        seg = max(range(len(P) - 1), key=lambda i: abs(P[i+1][0]-P[i][0]) + abs(P[i+1][1]-P[i][1]))
        f = 0.5
        lx, ly = P[seg][0] + (P[seg+1][0] - P[seg][0]) * f, P[seg][1] + (P[seg+1][1] - P[seg][1]) * f
        labels.append((lx, ly, label))
for lx, ly, t in labels:
    w = len(t) * 8.2 + 14
    out.append(f'<rect x="{lx-w/2:.0f}" y="{ly-13:.0f}" width="{w:.0f}" height="24" rx="6" fill="#fff" fill-opacity="0.95"/>')
    out.append(f'<text x="{lx:.0f}" y="{ly+5:.0f}" font-size="15" fill="#334155" text-anchor="middle">{t}</text>')
for k, (x, y, ic, lab) in N.items():
    out.append(f'<image x="{x-ICON_SZ/2}" y="{y-ICON_SZ/2}" width="{ICON_SZ}" height="{ICON_SZ}" href="{b64(ICON[ic])}"/>')
    for i, t in enumerate(lab):
        ty = y - ICON_SZ/2 - 12 - (len(lab) - 1 - i) * 19 if k in TOPLABEL else y + ICON_SZ/2 + 22 + i * 19
        out.append(f'<text x="{x}" y="{ty}" font-size="{17 if i==0 else 14}" font-weight="{600 if i==0 else 400}" fill="{"#0f172a" if i==0 else "#475569"}" text-anchor="middle">{t}</text>')
out.append('</svg>')
svg = "\n".join(out)
open(f"{HERE}/{OUT}.svg", "w").write(svg)

---
name: docker-devops
description: >-
  Use this skill when writing Dockerfiles, docker-compose setups, container hardening,
  multi-stage builds, CI/CD automation pipelines (GitHub Actions), and deployment scripts.
---

# Docker & DevOps Best Practices

Production guidelines for creating minimal, secure, and fast Docker containers and deployment automation.

---

## 1. Multi-Stage Dockerfile Best Practices

```dockerfile
# syntax=docker/dockerfile:1.4
# Stage 1: Build & Dependencies
FROM node:22-alpine AS builder
WORKDIR /app

# Enable pnpm / corepack
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy dependency manifests for layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/database/package.json ./packages/database/

RUN pnpm install --frozen-lockfile

# Copy source code and build
COPY . .
RUN pnpm build

# Stage 2: Production Runner
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Security: Run as non-root user
USER node

COPY --from=builder --chown=node:node /app/apps/api/dist ./dist
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json ./package.json

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
```

---

## 2. Container Security Checklist

1. **Non-Root Execution**: Never run application processes as `root` in containers. Always declare `USER node` or `USER 1001`.
2. **Minimal Base Images**: Prefer `alpine` or `distroless` images to minimize CVE vulnerability surface.
3. **No Secrets in Images**: Never use `ENV` or `ARG` to pass production API keys, passwords, or certificates during build. Inject secrets via environment variables or secret managers at runtime.
4. **`.dockerignore`**: Always exclude `.git`, `node_modules`, `.env*`, `coverage`, and build logs from build context.

---

## 3. Docker Compose Local Dev Pattern

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-onthilab}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
      POSTGRES_DB: ${POSTGRES_DB:-onthilab}
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    ports:
      - "6379:6379"

volumes:
  pgdata:
```

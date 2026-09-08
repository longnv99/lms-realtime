# LMS Realtime P5 Docker & CI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the LMS Realtime app build, run, and verify as a production-like Docker stack with GitHub Actions CI.

**Architecture:** Keep npm workspaces as the single build surface and add production containers around the existing backend, frontend, shared package, Postgres, Redis, and MinIO services. Serve the frontend through Nginx and proxy `/api` plus `/socket.io` to the NestJS backend so browser REST and WebSocket traffic use the same origin in production. CI should reuse the same scripts where possible: install, typecheck, lint, test, build, Docker build, then run Playwright against an ephemeral stack.

**Tech Stack:** Docker, Docker Compose, Nginx, Node.js 20, npm 10 workspaces, NestJS 10, Prisma 7, PostgreSQL 16, Redis 7, MinIO, Vite 5, React 18, Vitest, Jest, Playwright, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-26-lms-realtime-design.md`

**Dependencies:** P2 backend core, P3 realtime async, P3b media/progress backend, P4a frontend core UI, and P4b media/progress frontend are merged into `main`.

## Global Constraints

- Frontend dev port is `5173`; backend dev port is `4000`.
- Production Docker stack must expose the frontend/Nginx entrypoint and keep backend private on the Compose network unless explicitly mapped for debugging.
- Nginx must proxy `/api` to backend port `4000`.
- Nginx must proxy `/socket.io` to backend port `4000` with WebSocket upgrade headers.
- Postgres image remains `postgres:16-alpine`.
- Redis image remains `redis:7-alpine`.
- MinIO remains the S3-compatible object store.
- Root package manager remains npm workspaces; do not introduce pnpm, yarn, turbo, or nx.
- `db:seed` must remain safe/upsert. Database clearing is only allowed through explicit reset scripts against disposable local or CI databases.
- Runtime secrets must not be committed. Add examples only.
- After each implementation task, run the relevant build check. For Docker-facing changes, run Docker build or Compose validation in the same task.

---

## Current Audit Findings

- Root scripts already provide `build:shared`, `build:backend`, `build:frontend`, `build`, `test:backend`, `test:frontend`, `test`, `lint`, `db:seed`, `db:seed:reset`, and Playwright scripts.
- No production Docker artifacts exist yet: no `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx.conf`, `.dockerignore`, `docker-compose.prod.yml`, or `.github/workflows/ci.yml`.
- Existing dev infrastructure is `docker-compose.infra.yml` with Postgres, Redis, and MinIO only.
- Backend env validation requires `DATABASE_URL`, `JWT_ACCESS_SECRET`, and `JWT_REFRESH_SECRET`; other settings have defaults.
- Backend uses Prisma 7 with `generator client { provider = "prisma-client"; output = "../src/generated/prisma" }`, so Docker builds must run `prisma generate` before compiling or starting compiled code.
- Frontend REST client defaults to `VITE_API_BASE_URL=/api`, which fits Nginx same-origin proxy.
- Frontend Socket.IO client uses `VITE_SOCKET_URL`; when empty it connects to the current origin namespace. Production should build with `VITE_SOCKET_URL=`.
- Playwright config already starts local dev servers on `4000` and `5173`; P5 should add a production-stack E2E path rather than replacing the dev E2E path.
- Existing full backend e2e can reset data and should run only against disposable CI databases, not the user's local seeded database.

---

## File Structure

```text
.
  .dockerignore
  .env.prod.example
  docker-compose.prod.yml
  package.json
  README.md
  .github/
    workflows/
      ci.yml
  backend/
    Dockerfile
    docker-entrypoint.sh
    .env.production.example
    package.json
  frontend/
    Dockerfile
    nginx.conf
    .env.production.example
    .env.example
    package.json
  tests/
    e2e/
      p5-production-stack.spec.ts
```

---

### Task 1: Deployment Surface Audit

**Files:**
- Create: `docs/superpowers/plans/2026-09-08-lms-realtime-p5-docker-ci.md`

**Interfaces:**
- Produces: A checked audit section that later Docker and CI tasks consume.
- Consumes: `package.json`, `backend/package.json`, `frontend/package.json`, `shared/package.json`, `.env.example`, `backend/.env.example`, `frontend/.env.example`, `frontend/vite.config.ts`, `frontend/src/api/client.ts`, `frontend/src/lib/realtime.ts`, `backend/src/config/env.ts`, `backend/prisma/schema.prisma`, `docker-compose.infra.yml`, `playwright.config.ts`.

- [x] **Step 1: Inspect git base**

Run:

```bash
git fetch github
git switch main
git pull --ff-only github main
git switch -c p5-docker-ci
```

Expected: Work starts from `main` after the P4 merge. If `git switch -c` reports a partial branch creation, run `git switch p5-docker-ci` and confirm with `git status --short --branch`.

- [x] **Step 2: Inventory deploy files**

Run:

```bash
rg --files -g "*Dockerfile*" -g "docker-compose*.yml" -g "docker-compose*.yaml" -g ".github/workflows/*" -g "nginx*" -g "*.conf" -g "package.json" -g ".env.example"
```

Expected: Only package/env files and `docker-compose.infra.yml` exist before P5 implementation.

- [x] **Step 3: Inspect runtime config**

Run:

```bash
Get-Content backend/src/config/env.ts
Get-Content frontend/src/api/client.ts
Get-Content frontend/src/lib/realtime.ts
Get-Content backend/prisma/schema.prisma
```

Expected: Backend requires database and JWT secrets, frontend REST can use `/api`, Socket.IO can use same-origin when `VITE_SOCKET_URL` is empty, and Prisma generate output is `backend/src/generated/prisma`.

- [x] **Step 4: Record audit findings**

Add the findings above to this plan before any Docker or CI implementation.

Expected: Later tasks reference concrete files, ports, scripts, and env names.

---

### Task 2: Workspace Typecheck Scripts

**Files:**
- Modify: `package.json`
- Modify: `backend/package.json`
- Modify: `frontend/package.json`

**Interfaces:**
- Produces: Root scripts `typecheck`, `typecheck:backend`, `typecheck:frontend`, and `typecheck:shared`.
- Consumes: Existing TypeScript configs in `backend/tsconfig.json`, `frontend/tsconfig.json`, and `shared/tsconfig.json`.

- [x] **Step 1: Add failing script expectation**

Run:

```bash
npm.cmd run typecheck
```

Expected before implementation: FAIL with missing script `typecheck`.

- [x] **Step 2: Add package scripts**

Update root `package.json` scripts to include:

```json
{
  "typecheck:shared": "npm run typecheck --workspace=shared",
  "typecheck:backend": "npm run typecheck --workspace=backend",
  "typecheck:frontend": "npm run typecheck --workspace=frontend",
  "typecheck": "npm run typecheck:shared && npm run typecheck:backend && npm run typecheck:frontend"
}
```

Update `backend/package.json` scripts to include:

```json
{
  "typecheck": "tsc -p tsconfig.json --noEmit"
}
```

Update `frontend/package.json` scripts to include:

```json
{
  "typecheck": "tsc -p tsconfig.json --noEmit && tsc -p tsconfig.node.json --noEmit"
}
```

- [x] **Step 3: Verify typecheck**

Run:

```bash
npm.cmd run typecheck
```

Expected: PASS for shared, backend, and frontend.

- [x] **Step 4: Verify existing builds still pass**

Run:

```bash
npm.cmd run build:backend
npm.cmd run build:frontend
```

Expected: Both builds pass. Frontend may keep the existing Vite chunk-size warning.

- [x] **Step 5: Commit**

Run:

```bash
git add package.json backend/package.json frontend/package.json package-lock.json
git commit -m "chore(ci): add workspace typecheck scripts"
```

---

### Task 3: Backend Production Docker Image

**Files:**
- Create: `.dockerignore`
- Create: `backend/Dockerfile`
- Create: `backend/docker-entrypoint.sh`
- Create: `backend/.env.production.example`
- Modify: `backend/package.json`

**Interfaces:**
- Produces: Docker image target that starts with `npm run start:prod --workspace=backend`.
- Produces: Backend entrypoint that runs `npx prisma migrate deploy --schema backend/prisma/schema.prisma` before starting the app.
- Consumes: Root `package-lock.json`, npm workspaces, `backend/prisma`, generated Prisma client output, `shared/dist`, and backend `dist`.

- [ ] **Step 1: Add failing Docker build check**

Run:

```bash
docker build -f backend/Dockerfile -t lms-backend:local .
```

Expected before implementation: FAIL because `backend/Dockerfile` does not exist.

- [ ] **Step 2: Add Docker ignore rules**

Create `.dockerignore` with:

```dockerignore
.git
.github
node_modules
**/node_modules
dist
**/dist
build
coverage
.env
.env.*
!.env.example
!.env.prod.example
!backend/.env.production.example
!frontend/.env.production.example
*.log
*.tsbuildinfo
playwright-report
test-results
blob-report
```

- [ ] **Step 3: Add backend entrypoint**

Create `backend/docker-entrypoint.sh` with:

```sh
#!/bin/sh
set -eu

npx prisma migrate deploy --schema backend/prisma/schema.prisma
exec "$@"
```

- [ ] **Step 4: Add backend Dockerfile**

Create `backend/Dockerfile` with:

```dockerfile
# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY shared/package.json shared/package.json
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run build:shared
RUN npm run db:generate --workspace=backend
RUN npm run build --workspace=backend
RUN npm prune --omit=dev

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S lms && adduser -S lms -G lms
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/prisma ./backend/prisma
COPY --from=build /app/backend/src/generated ./backend/src/generated
COPY --from=build /app/shared/package.json ./shared/package.json
COPY --from=build /app/shared/dist ./shared/dist
COPY backend/docker-entrypoint.sh ./backend/docker-entrypoint.sh
RUN chmod +x ./backend/docker-entrypoint.sh && chown -R lms:lms /app
USER lms
EXPOSE 4000
ENTRYPOINT ["./backend/docker-entrypoint.sh"]
CMD ["npm", "run", "start:prod", "--workspace=backend"]
```

- [ ] **Step 5: Add production env example**

Create `backend/.env.production.example` with:

```dotenv
PORT=4000
NODE_ENV=production
CORS_ORIGIN=http://localhost:8080
LOG_LEVEL=info
DATABASE_URL=postgresql://lms:lms_prod_password@postgres:5432/lms?schema=public
REDIS_URL=redis://redis:6379
JWT_ACCESS_SECRET=replace_with_at_least_16_chars_access_secret
JWT_REFRESH_SECRET=replace_with_at_least_16_chars_refresh_secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN_DAYS=30
BREVO_API_KEY=
EMAIL_FROM=no-reply@lms-realtime.local
NOTIFICATIONS_MOCK_MODE=true
S3_ENDPOINT=http://minio:9000
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=lms
S3_SECRET_ACCESS_KEY=lms_prod_password
S3_BUCKET=lms-media
S3_FORCE_PATH_STYLE=true
MEDIA_UPLOAD_TTL_SECONDS=900
MEDIA_PLAYBACK_TTL_SECONDS=1800
```

- [ ] **Step 6: Verify backend image build**

Run:

```bash
docker build -f backend/Dockerfile -t lms-backend:local .
```

Expected: Docker image builds successfully.

- [ ] **Step 7: Verify backend build still passes outside Docker**

Run:

```bash
npm.cmd run build:backend
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add .dockerignore backend/Dockerfile backend/docker-entrypoint.sh backend/.env.production.example backend/package.json package-lock.json
git commit -m "build(backend): add production docker image"
```

---

### Task 4: Frontend Nginx Production Image

**Files:**
- Create: `frontend/Dockerfile`
- Create: `frontend/nginx.conf`
- Create: `frontend/.env.production.example`
- Modify: `frontend/.env.example`

**Interfaces:**
- Produces: Frontend image serving static Vite output through Nginx.
- Produces: Nginx routes `/api/*` and `/socket.io/*` to `http://backend:4000`.
- Consumes: `VITE_API_BASE_URL=/api` and empty `VITE_SOCKET_URL` for production same-origin sockets.

- [ ] **Step 1: Add failing Docker build check**

Run:

```bash
docker build -f frontend/Dockerfile -t lms-frontend:local .
```

Expected before implementation: FAIL because `frontend/Dockerfile` does not exist.

- [ ] **Step 2: Add Nginx config**

Create `frontend/nginx.conf` with:

```nginx
server {
  listen 80;
  server_name _;

  root /usr/share/nginx/html;
  index index.html;

  location /api/ {
    proxy_pass http://backend:4000/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /socket.io/ {
    proxy_pass http://backend:4000/socket.io/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 60s;
    proxy_send_timeout 60s;
  }

  location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    try_files $uri =404;
  }

  location / {
    try_files $uri /index.html;
    add_header Cache-Control "no-store";
  }
}
```

- [ ] **Step 3: Add frontend Dockerfile**

Create `frontend/Dockerfile` with:

```dockerfile
# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY shared/package.json shared/package.json
RUN npm ci

FROM deps AS build
WORKDIR /app
ARG VITE_API_BASE_URL=/api
ARG VITE_SOCKET_URL=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL
COPY . .
RUN npm run build:shared
RUN npm run build --workspace=frontend

FROM nginx:1.27-alpine AS runtime
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
```

- [ ] **Step 4: Update frontend env examples**

Update `frontend/.env.example` so dev still works and production intent is clear:

```dotenv
VITE_API_BASE_URL=/api
VITE_SOCKET_URL=http://localhost:4000
```

Create `frontend/.env.production.example` with:

```dotenv
VITE_API_BASE_URL=/api
VITE_SOCKET_URL=
```

- [ ] **Step 5: Verify frontend image build**

Run:

```bash
docker build -f frontend/Dockerfile -t lms-frontend:local .
```

Expected: Docker image builds successfully.

- [ ] **Step 6: Verify frontend build still passes outside Docker**

Run:

```bash
npm.cmd run build:frontend
```

Expected: PASS. Existing Vite chunk-size warning is acceptable.

- [ ] **Step 7: Commit**

Run:

```bash
git add frontend/Dockerfile frontend/nginx.conf frontend/.env.example frontend/.env.production.example
git commit -m "build(frontend): add nginx production image"
```

---

### Task 5: Production Compose Stack

**Files:**
- Create: `.env.prod.example`
- Create: `docker-compose.prod.yml`
- Modify: `README.md`

**Interfaces:**
- Produces: `docker compose --env-file .env.prod.example -f docker-compose.prod.yml config` as the validation path.
- Produces: Production-like stack with services `postgres`, `redis`, `minio`, `backend`, and `frontend`.
- Consumes: `backend/Dockerfile`, `frontend/Dockerfile`, backend env schema, frontend Nginx proxy.

- [ ] **Step 1: Add failing compose validation**

Run:

```bash
docker compose --env-file .env.prod.example -f docker-compose.prod.yml config
```

Expected before implementation: FAIL because `.env.prod.example` and `docker-compose.prod.yml` do not exist.

- [ ] **Step 2: Add root production env example**

Create `.env.prod.example` with:

```dotenv
POSTGRES_USER=lms
POSTGRES_PASSWORD=lms_prod_password
POSTGRES_DB=lms
POSTGRES_PORT=5432
REDIS_PORT=6379
MINIO_ROOT_USER=lms
MINIO_ROOT_PASSWORD=lms_prod_password
MINIO_API_PORT=9000
MINIO_CONSOLE_PORT=9001
APP_PORT=8080
BACKEND_PORT=4000
JWT_ACCESS_SECRET=replace_with_at_least_16_chars_access_secret
JWT_REFRESH_SECRET=replace_with_at_least_16_chars_refresh_secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN_DAYS=30
BREVO_API_KEY=
EMAIL_FROM=no-reply@lms-realtime.local
NOTIFICATIONS_MOCK_MODE=true
S3_BUCKET=lms-media
MEDIA_UPLOAD_TTL_SECONDS=900
MEDIA_PLAYBACK_TTL_SECONDS=1800
```

- [ ] **Step 3: Add production compose file**

Create `docker-compose.prod.yml` with:

```yaml
name: lms-prod

services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
    volumes:
      - postgres_prod_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    ports:
      - "${REDIS_PORT:-6379}:6379"
    volumes:
      - redis_prod_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 10

  minio:
    image: minio/minio:latest
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
    ports:
      - "${MINIO_API_PORT:-9000}:9000"
      - "${MINIO_CONSOLE_PORT:-9001}:9001"
    volumes:
      - minio_prod_data:/data
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:9000/minio/health/live || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 10

  backend:
    build:
      context: .
      dockerfile: backend/Dockerfile
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 4000
      CORS_ORIGIN: http://localhost:${APP_PORT:-8080}
      LOG_LEVEL: info
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?schema=public
      REDIS_URL: redis://redis:6379
      JWT_ACCESS_SECRET: ${JWT_ACCESS_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      JWT_ACCESS_EXPIRES_IN: ${JWT_ACCESS_EXPIRES_IN:-15m}
      JWT_REFRESH_EXPIRES_IN_DAYS: ${JWT_REFRESH_EXPIRES_IN_DAYS:-30}
      BREVO_API_KEY: ${BREVO_API_KEY:-}
      EMAIL_FROM: ${EMAIL_FROM:-no-reply@lms-realtime.local}
      NOTIFICATIONS_MOCK_MODE: ${NOTIFICATIONS_MOCK_MODE:-true}
      S3_ENDPOINT: http://minio:9000
      S3_REGION: us-east-1
      S3_ACCESS_KEY_ID: ${MINIO_ROOT_USER}
      S3_SECRET_ACCESS_KEY: ${MINIO_ROOT_PASSWORD}
      S3_BUCKET: ${S3_BUCKET:-lms-media}
      S3_FORCE_PATH_STYLE: "true"
      MEDIA_UPLOAD_TTL_SECONDS: ${MEDIA_UPLOAD_TTL_SECONDS:-900}
      MEDIA_PLAYBACK_TTL_SECONDS: ${MEDIA_PLAYBACK_TTL_SECONDS:-1800}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      minio:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:4000/api/health || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 12

  frontend:
    build:
      context: .
      dockerfile: frontend/Dockerfile
      args:
        VITE_API_BASE_URL: /api
        VITE_SOCKET_URL: ""
    restart: unless-stopped
    ports:
      - "${APP_PORT:-8080}:80"
    depends_on:
      backend:
        condition: service_healthy

volumes:
  postgres_prod_data:
  redis_prod_data:
  minio_prod_data:
```

- [ ] **Step 4: Validate compose config**

Run:

```bash
docker compose --env-file .env.prod.example -f docker-compose.prod.yml config
```

Expected: PASS and show resolved services.

- [ ] **Step 5: Build compose services**

Run:

```bash
docker compose --env-file .env.prod.example -f docker-compose.prod.yml build
```

Expected: Backend and frontend images build successfully.

- [ ] **Step 6: Verify local builds still pass**

Run:

```bash
npm.cmd run build:backend
npm.cmd run build:frontend
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add .env.prod.example docker-compose.prod.yml README.md
git commit -m "build(docker): add production compose stack"
```

---

### Task 6: Production Stack Smoke And Playwright Coverage

**Files:**
- Create: `tests/e2e/p5-production-stack.spec.ts`
- Modify: `package.json`
- Modify: `playwright.config.ts`
- Modify: `README.md`

**Interfaces:**
- Produces: Root script `test:e2e:prod`.
- Produces: Playwright support for `E2E_BASE_URL=http://localhost:8080` and `E2E_SKIP_WEBSERVER=1`.
- Consumes: `docker-compose.prod.yml`, seeded demo accounts from `backend/prisma/seeds/data.ts`, existing Playwright helpers in `tests/e2e/helpers`.

- [ ] **Step 1: Add failing production E2E command**

Run:

```bash
npm.cmd run test:e2e:prod
```

Expected before implementation: FAIL with missing script `test:e2e:prod`.

- [ ] **Step 2: Add production smoke spec**

Create `tests/e2e/p5-production-stack.spec.ts` with:

```ts
import { expect, test } from '@playwright/test';
import { DEMO_USERS } from './helpers/demo-data';
import { loginAs } from './helpers/auth';

test('production stack serves app, api, and authenticated dashboard', async ({ page, request }) => {
  const health = await request.get('/api/health');
  expect(health.ok()).toBe(true);

  await loginAs(page, DEMO_USERS.admin);
  await expect(page).toHaveURL(/\/courses$/);
  await expect(page.getByRole('heading', { name: /courses/i })).toBeVisible();
});
```

- [ ] **Step 3: Add Playwright webServer skip**

Modify `playwright.config.ts` so `webServer` is omitted when `E2E_SKIP_WEBSERVER=1`:

```ts
const shouldStartWebServers = process.env.E2E_SKIP_WEBSERVER !== '1';

export default defineConfig({
  // existing config
  webServer: shouldStartWebServers
    ? [
        {
          command: 'npm run dev:backend',
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          url: backendHealthUrl,
        },
        {
          command: 'npm run dev:frontend',
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          url: frontendUrl,
        },
      ]
    : undefined,
});
```

- [ ] **Step 4: Add root production E2E script**

Update root `package.json` scripts:

```json
{
  "test:e2e:prod": "cross-env E2E_SKIP_WEBSERVER=1 E2E_BASE_URL=http://localhost:8080 E2E_BACKEND_HEALTH_URL=http://localhost:8080/api/health playwright test tests/e2e/p5-production-stack.spec.ts"
}
```

If `cross-env` is not present, add it as a dev dependency so the script works on Windows and Linux.

- [ ] **Step 5: Start production stack**

Run:

```bash
docker compose --env-file .env.prod.example -f docker-compose.prod.yml up -d --build
```

Expected: All services start and backend healthcheck becomes healthy.

- [ ] **Step 6: Seed production local stack**

Run:

```bash
docker compose --env-file .env.prod.example -f docker-compose.prod.yml exec backend npm run db:seed --workspace=backend
```

Expected: Seed completes without clearing existing data.

- [ ] **Step 7: Verify health through Nginx**

Run:

```bash
curl.exe -f http://localhost:8080/api/health
```

Expected: HTTP 200 with health response.

- [ ] **Step 8: Verify production E2E**

Run:

```bash
npm.cmd run test:e2e:prod
```

Expected: PASS.

- [ ] **Step 9: Verify local builds still pass**

Run:

```bash
npm.cmd run build:backend
npm.cmd run build:frontend
```

Expected: PASS.

- [ ] **Step 10: Stop production stack without deleting volumes**

Run:

```bash
docker compose --env-file .env.prod.example -f docker-compose.prod.yml down
```

Expected: Containers stop. Named volumes remain.

- [ ] **Step 11: Commit**

Run:

```bash
git add package.json package-lock.json playwright.config.ts tests/e2e/p5-production-stack.spec.ts README.md
git commit -m "test(e2e): add production stack smoke coverage"
```

---

### Task 7: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `README.md`

**Interfaces:**
- Produces: CI jobs for quality checks, Docker builds, backend e2e, and Playwright e2e.
- Consumes: npm scripts, Dockerfiles, `docker-compose.infra.yml`, `docker-compose.prod.yml`, Playwright config, safe seed script.

- [ ] **Step 1: Add CI workflow**

Create `.github/workflows/ci.yml` with:

```yaml
name: CI

on:
  pull_request:
  push:
    branches:
      - main

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run test:frontend
      - run: npm run test:backend
      - run: npm run build

  docker-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - run: docker build -f backend/Dockerfile -t lms-backend:ci .
      - run: docker build -f frontend/Dockerfile -t lms-frontend:ci .

  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: cp .env.prod.example .env.prod
      - run: docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
      - run: docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T backend npm run db:seed --workspace=backend
      - run: npm run test:e2e:prod
      - if: always()
        run: docker compose --env-file .env.prod -f docker-compose.prod.yml logs
      - if: always()
        run: docker compose --env-file .env.prod -f docker-compose.prod.yml down -v
```

- [ ] **Step 2: Validate workflow file exists**

Run:

```bash
Test-Path .github/workflows/ci.yml
```

Expected: `True`.

- [ ] **Step 3: Run local CI equivalent**

Run:

```bash
npm.cmd ci
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:frontend
npm.cmd run test:backend
npm.cmd run build
docker build -f backend/Dockerfile -t lms-backend:ci-local .
docker build -f frontend/Dockerfile -t lms-frontend:ci-local .
```

Expected: All commands pass. If `npm.cmd ci` modifies `package-lock.json`, inspect and commit only intentional lockfile changes.

- [ ] **Step 4: Run production E2E local equivalent**

Run:

```bash
docker compose --env-file .env.prod.example -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.prod.example -f docker-compose.prod.yml exec backend npm run db:seed --workspace=backend
npm.cmd run test:e2e:prod
docker compose --env-file .env.prod.example -f docker-compose.prod.yml down
```

Expected: Production stack E2E passes and volumes are preserved locally.

- [ ] **Step 5: Commit**

Run:

```bash
git add .github/workflows/ci.yml README.md
git commit -m "ci: add docker and e2e workflow"
```

---

### Task 8: Production Run Documentation

**Files:**
- Modify: `README.md`

**Interfaces:**
- Produces: README instructions that let a new developer run dev infra, seed, production Docker stack, and Playwright checks.
- Consumes: `.env.example`, `.env.prod.example`, `backend/.env.production.example`, `frontend/.env.production.example`, npm scripts, Docker Compose files.

- [ ] **Step 1: Inspect current README sections**

Run:

```bash
Get-Content README.md
```

Expected: Current dev setup exists and needs a P5 production section.

- [ ] **Step 2: Document production local setup**

Add a `Production-like Docker` section with these commands:

```bash
cp .env.prod.example .env.prod
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.prod -f docker-compose.prod.yml exec backend npm run db:seed --workspace=backend
curl http://localhost:8080/api/health
```

- [ ] **Step 3: Document production verification**

Add a `Production verification` section with:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:e2e:prod
docker compose --env-file .env.prod -f docker-compose.prod.yml down
```

- [ ] **Step 4: Document reset boundary**

Add explicit copy:

```text
Use `npm run db:seed` for safe demo data upserts. Use `npm run db:seed:reset` only for disposable local or CI databases because it clears tables before seeding.
```

- [ ] **Step 5: Verify docs commands still match scripts**

Run:

```bash
npm.cmd run typecheck
npm.cmd run build:backend
npm.cmd run build:frontend
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add README.md
git commit -m "docs: add production docker runbook"
```

---

### Task 9: Final P5 Verification And Plan Closeout

**Files:**
- Modify: `docs/superpowers/plans/2026-09-08-lms-realtime-p5-docker-ci.md`

**Interfaces:**
- Produces: Completed P5 checklist and verification summary.
- Consumes: All artifacts from Tasks 2-8.

- [ ] **Step 1: Run full non-destructive verification**

Run:

```bash
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:frontend
npm.cmd run test:backend
npm.cmd run build:backend
npm.cmd run build:frontend
docker build -f backend/Dockerfile -t lms-backend:p5-final .
docker build -f frontend/Dockerfile -t lms-frontend:p5-final .
docker compose --env-file .env.prod.example -f docker-compose.prod.yml config
```

Expected: PASS. Do not run local reset scripts.

- [ ] **Step 2: Run production stack verification**

Run:

```bash
docker compose --env-file .env.prod.example -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.prod.example -f docker-compose.prod.yml exec backend npm run db:seed --workspace=backend
curl.exe -f http://localhost:8080/api/health
npm.cmd run test:e2e:prod
docker compose --env-file .env.prod.example -f docker-compose.prod.yml down
```

Expected: PASS. Stop containers but preserve local volumes.

- [ ] **Step 3: Update this plan checklist**

Mark completed task steps with `[x]` and add a short verification note under this task with exact commands and outcomes.

- [ ] **Step 4: Inspect git diff**

Run:

```bash
git status --short
git diff --stat
```

Expected: Only P5 files are modified.

- [ ] **Step 5: Commit closeout**

Run:

```bash
git add docs/superpowers/plans/2026-09-08-lms-realtime-p5-docker-ci.md
git commit -m "docs(plan): add p5 docker ci plan"
```

If the plan was already committed earlier, amend only when no other user changes are present.

---

## Self-Review

- Spec coverage: P5 spec requires multi-stage backend Dockerfile, frontend Nginx Dockerfile, production Compose with Nginx reverse proxy and WebSocket upgrade, GitHub Actions lint/typecheck/test/build image/e2e, and Playwright. Tasks 2-9 cover those items.
- Placeholder scan: This plan intentionally avoids unresolved marker words and vague implementation steps. Each task includes concrete files, commands, expected results, and content snippets.
- Type and script consistency: Root scripts introduced in Task 2 are consumed by CI and docs. `test:e2e:prod` introduced in Task 6 is consumed by CI and final verification. Dockerfiles consume npm workspaces and the existing Prisma output path.
- Risk callout: Backend e2e and production compose can clear or create data only in disposable environments. Local verification uses safe seed and `docker compose down` without `-v`.

## Suggested Next Plans

- **P6 Learning UX:** lesson completion controls, notes, captions, transcripts, and quiz-to-lesson review flows.

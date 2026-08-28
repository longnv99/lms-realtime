# LMS Realtime

Learning Management System with realtime chat and quiz features.

## Quick Start

```bash
npm install
npm.cmd run infra:up
npm.cmd run db:migrate --workspace=backend
npm.cmd run db:seed --workspace=backend
npm.cmd run dev:backend
```

In another terminal:

```bash
npm.cmd run dev:frontend
```

Frontend: http://localhost:5173
Backend: http://localhost:4000
Swagger API docs: http://localhost:4000/api/docs
MinIO console: http://localhost:9001

## Seed Users

```text
admin@example.com / Password123!
instructor@example.com / Password123!
student@example.com / Password123!
student2@example.com / Password123!
```

## Realtime Namespaces

```text
/sessions        auth.handshake.token, events: session:join, chat:send
/quiz            auth.handshake.token, events: quiz:join, quiz:answer
/notifications   auth.handshake.token, event: notification:new
```

## Verification

```bash
npm.cmd run test:e2e --workspace=backend
npm.cmd run build:backend
npm.cmd run build:frontend
npm.cmd run test:frontend
```

## Local API Smoke

```bash
curl -s http://localhost:4000/api/health
curl -s -X POST http://localhost:4000/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"student@example.com\",\"password\":\"Password123!\"}"
```

Both responses should include `"success":true`.

## Structure

- `backend/` - NestJS modular monolith
- `frontend/` - Vite + React
- `shared/` - shared TypeScript contracts
- `docker-compose.infra.yml` - Postgres, Redis, and MinIO

See `docs/superpowers/specs/2026-08-26-lms-realtime-design.md` for the project design.

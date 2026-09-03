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

## Frontend Smoke

1. Start infra, migrate, seed, and run backend:

```bash
npm.cmd run infra:up
npm.cmd run db:migrate --workspace=backend
npm.cmd run db:seed --workspace=backend
npm.cmd run dev:backend
```

2. In another terminal, run frontend:

```bash
npm.cmd run dev:frontend
```

3. Open http://localhost:5173 and login as `instructor@example.com / Password123!`.
4. Open `Realtime LMS Foundations`, confirm the seeded `Live intro session`, then enter the live room.
5. In another browser profile, login as `student@example.com / Password123!` and enter the same live room.
6. Verify chat messages appear in both profiles.
7. As instructor, use quiz controls to open a question, close it, reveal it, and finish the quiz run.
8. As student, answer a quiz question and confirm the leaderboard updates.
9. Confirm the notification button shows unread count and the drawer can mark a notification read.

## Structure

- `backend/` - NestJS modular monolith
- `frontend/` - Vite + React
- `shared/` - shared TypeScript contracts
- `docker-compose.infra.yml` - Postgres, Redis, and MinIO

See `docs/superpowers/specs/2026-08-26-lms-realtime-design.md` for the project design.

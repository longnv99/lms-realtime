# LMS Realtime

Learning Management System với chat/quiz realtime (portfolio project).

## Quick start

```bash
npm install
cp .env.example .env
npm run infra:up
npm run dev
```

Frontend: http://localhost:5173 — Backend: http://localhost:4000 — MinIO console: http://localhost:9001

## Structure

- `backend/` — NestJS monolith
- `frontend/` — Vite + React
- `shared/` — TypeScript types dùng chung BE-FE
- `docker-compose.infra.yml` — postgres + redis + minio

Xem chi tiết ở `docs/superpowers/specs/2026-08-26-lms-realtime-design.md`.

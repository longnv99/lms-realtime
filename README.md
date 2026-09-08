# LMS Realtime

Learning Management System with realtime chat and quiz features.

## Quick Start

```bash
npm install
npm.cmd run infra:up
npm.cmd run db:migrate --workspace=backend
npm.cmd run db:seed
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
MinIO credentials: `lms / lms_dev_password`

## Seed Users

```text
admin@example.com / Password123!
instructor@example.com / Password123!
student@example.com / Password123!
student2@example.com / Password123!
```

The default seed is safe to rerun. It upserts one published course, four lessons,
two enrolled students, uploaded demo media asset records, one live session, one
intro quiz, and sample learner progress rows.

Use reset mode only when you intentionally want to recreate the local demo
dataset:

```bash
npm.cmd run db:seed:reset
```

The seeded media keys are `videos/seed-demo-intro.mp4`,
`videos/seed-demo-realtime-room.mp4`, `videos/seed-demo-quiz.mp4`, and
`videos/seed-demo-progress.mp4`. Uploading matching objects to MinIO is optional
for local playback smoke tests.

## Local Environment

Backend auth tokens use these local development defaults:

```env
JWT_ACCESS_SECRET=dev_access_secret_change_me
JWT_REFRESH_SECRET=dev_refresh_secret_change_me
JWT_ACCESS_EXPIRES_IN=8h
JWT_REFRESH_EXPIRES_IN_DAYS=30
```

The local access token TTL is intentionally set to `8h` for Swagger and manual
testing. Use a shorter value such as `15m` for production deployments.

Backend media uploads use a private MinIO/S3-compatible bucket:

```env
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=lms
S3_SECRET_ACCESS_KEY=lms_dev_password
S3_BUCKET=lms-media
S3_FORCE_PATH_STYLE=true
MEDIA_UPLOAD_TTL_SECONDS=900
MEDIA_PLAYBACK_TTL_SECONDS=1800
```

Create the `lms-media` bucket in the MinIO console before testing upload
completion against real objects.

## Realtime Namespaces

```text
/sessions        auth.handshake.token, events: session:join, chat:send, progress:heartbeat, progress:updated
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

## Media And Progress Smoke

Create an upload URL as `instructor@example.com` or `admin@example.com`:

```bash
curl -s -X POST http://localhost:4000/api/media/uploads ^
  -H "Authorization: Bearer %TOKEN%" ^
  -H "Content-Type: application/json" ^
  -d "{\"fileName\":\"lesson.mp4\",\"contentType\":\"video/mp4\",\"sizeBytes\":5000000}"
```

Upload the file directly to the returned `uploadUrl`, then mark the asset
complete:

```bash
curl -s -X POST http://localhost:4000/api/media/uploads/%ASSET_ID%/complete ^
  -H "Authorization: Bearer %TOKEN%"
```

Playback URLs are authenticated and presigned:

```bash
curl -s http://localhost:4000/api/media/assets/%ASSET_ID%/playback ^
  -H "Authorization: Bearer %TOKEN%"
```

Student progress:

```bash
curl -s http://localhost:4000/api/me/courses/%COURSE_ID%/progress ^
  -H "Authorization: Bearer %TOKEN%"
```

Instructor progress:

```bash
curl -s http://localhost:4000/api/courses/%COURSE_ID%/progress ^
  -H "Authorization: Bearer %TOKEN%"
```

Realtime progress uses the `/sessions` namespace. Join a live session first,
then emit:

```json
{
  "event": "progress:heartbeat",
  "payload": {
    "lessonId": "LESSON_ID",
    "positionSeconds": 120
  }
}
```

The backend stores the latest heartbeat in Redis immediately, debounces a
PostgreSQL flush through BullMQ, and emits `progress:updated` to instructors
when a student newly completes a lesson.

## Frontend Smoke

1. Start infra, migrate, seed, and run backend:

```bash
npm.cmd run infra:up
npm.cmd run db:migrate --workspace=backend
npm.cmd run db:seed
npm.cmd run dev:backend
```

2. In another terminal, run frontend:

```bash
npm.cmd run dev:frontend
```

3. Open http://localhost:5173 and login as `instructor@example.com / Password123!`.
4. Open `Realtime LMS Foundations`, confirm the seeded `Live intro session`, then upload an MP4 or WebM from the lesson list if the seeded lesson object is not available in MinIO.
5. Enter the live room from the course sessions panel.
6. In another browser profile, login as `student@example.com / Password123!` and enter the same live room from the course detail page.
7. Play the lesson video for at least 10 seconds and confirm the student course detail shows course percent plus per-lesson progress.
8. As instructor, return to course detail and confirm learner progress shows the student's completed count, percent, and last watched time.
9. Verify chat messages appear in both profiles.
10. As instructor, use quiz controls to open a question, close it, reveal it, and finish the quiz run.
11. As student, answer a quiz question and confirm the leaderboard updates.
12. Confirm the notification button shows unread count and the drawer can mark a notification read.

## Structure

- `backend/` - NestJS modular monolith
- `frontend/` - Vite + React
- `shared/` - shared TypeScript contracts
- `docker-compose.infra.yml` - Postgres, Redis, and MinIO

See `docs/superpowers/specs/2026-08-26-lms-realtime-design.md` for the project design.

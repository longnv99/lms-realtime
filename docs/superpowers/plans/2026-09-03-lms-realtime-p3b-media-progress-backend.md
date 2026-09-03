# LMS Realtime P3b Media & Progress Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add backend support for private lesson video uploads/playback through MinIO plus lesson progress REST and realtime heartbeat persistence.

**Architecture:** Keep the existing NestJS modular monolith and Prisma schema. Reuse the existing `MediaAsset` and `LessonProgress` models, add a MinIO-compatible S3 service, expose media/progress REST modules, and extend the `/sessions` gateway with `progress:heartbeat`. Progress heartbeat writes the latest state to Redis immediately and flushes to PostgreSQL through BullMQ debounce jobs.

**Tech Stack:** NestJS 10, TypeScript strict mode, Prisma ORM 7, PostgreSQL 16, Redis 7, MinIO/S3 via AWS SDK v3, BullMQ, Socket.IO, Jest + Supertest + socket.io-client.

**Spec:** `docs/superpowers/specs/2026-08-26-lms-realtime-design.md`

## Global Constraints

- Backend dev port is `4000`; frontend dev port is `5173`; Postgres is `5432`; Redis is `6379`; MinIO is `9000/9001`.
- REST uses prefix `/api` and response envelope `{ success, data, error, meta }`.
- Swagger UI is served at `/api/docs`; OpenAPI JSON is served at `/api/docs-json`.
- Upload flow is private bucket only: backend returns presigned URLs, client uploads directly to MinIO.
- Accepted media types are exactly `video/mp4` and `video/webm`.
- Maximum upload size is `2GB`.
- Upload presigned URL TTL is `15 minutes`; playback presigned URL TTL is `30 minutes`.
- Lesson can attach only `MediaAsset.status = UPLOADED`.
- Progress position must never move backwards.
- Course progress percent is computed from completed lessons at read time, not stored as a course-level column.
- `progress:updated` is sent to instructor course room only when a student newly completes a lesson.

---

## File Structure

```text
backend/
  package.json
  .env.example
  src/
    app.module.ts
    config/env.ts
    media/
      dto/complete-upload.dto.ts
      dto/create-upload.dto.ts
      media.controller.ts
      media.module.ts
      media.service.ts
      s3-storage.service.ts
    modules/
      sessions/
        dto/progress-heartbeat.dto.ts
        sessions.gateway.ts
        sessions.realtime.service.ts
      progress/
      dto/progress-heartbeat.dto.ts
      progress.controller.ts
      progress.module.ts
        progress.processor.ts
        progress.service.ts
    queue/
      queue.constants.ts
      queue.module.ts
  test/
    media.e2e-spec.ts
    progress.e2e-spec.ts
    progress-realtime.e2e-spec.ts
shared/
  src/
    media.ts
    progress.ts
    realtime.ts
    errors.ts
    index.ts
```

---

### Task 1: MinIO/S3 Configuration Foundation

**Files:**
- Modify: `backend/package.json`
- Modify: `backend/.env.example`
- Modify: `backend/src/config/env.ts`
- Create: `backend/src/media/s3-storage.service.ts`
- Create: `backend/src/media/media.module.ts`
- Modify: `backend/src/app.module.ts`
- Modify: `shared/src/media.ts`
- Modify: `shared/src/index.ts`

**Interfaces:**
- Produces: `S3StorageService.createUploadUrl(key, contentType): Promise<string>`.
- Produces: `S3StorageService.createPlaybackUrl(key): Promise<string>`.
- Produces: `S3StorageService.headObject(key): Promise<{ contentLength: number; contentType: string | null } | null>`.
- Produces: shared `CreateMediaUploadResponse` and `MediaPlaybackResponse`.
- Consumes: `env.S3_ENDPOINT`, `env.S3_REGION`, `env.S3_ACCESS_KEY_ID`, `env.S3_SECRET_ACCESS_KEY`, `env.S3_BUCKET`, `env.S3_FORCE_PATH_STYLE`.

- [x] **Step 1.1: Install AWS SDK dependencies**

Run:

```bash
npm.cmd install --workspace=backend @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

Expected: `backend/package.json` and `package-lock.json` update.

- [x] **Step 1.2: Add MinIO env values**

Add to `backend/.env.example`:

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

Add the same keys to local `backend/.env` if it exists. Keep `backend/.env` ignored.

- [x] **Step 1.3: Validate S3 env values**

Extend `backend/src/config/env.ts` with the same keys and defaults. `MEDIA_UPLOAD_TTL_SECONDS` must default to `900`; `MEDIA_PLAYBACK_TTL_SECONDS` must default to `1800`.

- [x] **Step 1.4: Add shared media response types**

Create `shared/src/media.ts`:

```ts
export interface CreateMediaUploadResponse {
  assetId: string;
  key: string;
  uploadUrl: string;
  expiresInSeconds: number;
}

export interface MediaPlaybackResponse {
  assetId: string;
  playbackUrl: string;
  expiresInSeconds: number;
}
```

Export it from `shared/src/index.ts`.

- [x] **Step 1.5: Implement S3 storage service and module**

Create `S3StorageService` using `S3Client`, `PutObjectCommand`, `GetObjectCommand`, `HeadObjectCommand`, and `getSignedUrl`. Use `forcePathStyle` for MinIO. `headObject()` must return `null` when S3 responds with `NotFound`.

- [x] **Step 1.6: Register MediaModule**

Create `MediaModule` with `S3StorageService` as a provider/export and import it in `AppModule`.

- [x] **Step 1.7: Verify foundation builds**

Run:

```bash
npm.cmd run build:shared
npm.cmd run build:backend
```

Expected: both builds pass.

---

### Task 2: Media Upload, Complete, and Playback REST API

**Files:**
- Create: `backend/src/media/dto/create-upload.dto.ts`
- Create: `backend/src/media/dto/complete-upload.dto.ts`
- Create: `backend/src/media/media.controller.ts`
- Modify: `backend/src/media/media.module.ts`
- Modify: `backend/src/media/media.service.ts`
- Create: `backend/test/media.e2e-spec.ts`

**Interfaces:**
- Produces: `POST /api/media/uploads`.
- Produces: `POST /api/media/uploads/:id/complete`.
- Produces: `GET /api/media/assets/:id/playback`.
- Consumes: `S3StorageService`, `JwtAuthGuard`, `RolesGuard`, Prisma `MediaAsset`.

- [x] **Step 2.1: Write media e2e tests**

Mock `S3StorageService` in the test module and verify:
- instructor can create upload for `video/mp4`.
- non-video content type returns `MEDIA_INVALID_TYPE`.
- file size greater than `2GB` returns `MEDIA_TOO_LARGE`.
- complete rejects mismatched object size with `MEDIA_SIZE_MISMATCH`.
- complete updates status to `UPLOADED` when size/type match.
- playback returns a presigned URL only after `UPLOADED`.

- [x] **Step 2.2: Run media tests to verify failure**

Run:

```bash
npm.cmd run test:e2e --workspace=backend -- media.e2e-spec.ts
```

Expected: fail before implementation because routes do not exist.

- [x] **Step 2.3: Implement media DTOs**

`CreateUploadDto` has `fileName`, `contentType`, `sizeBytes`; `CompleteUploadDto` is an empty class to preserve explicit body validation.

- [x] **Step 2.4: Implement media service**

Generate object keys as `videos/{crypto.randomUUID()}.{mp4|webm}`. Create `MediaAsset` as `PENDING`, return presigned upload URL. On complete, call `headObject()`, compare content length and content type, then mark `UPLOADED`. Playback rejects missing/PENDING assets with `LESSON_MEDIA_NOT_READY`.

- [x] **Step 2.5: Implement media controller**

Protect upload and complete with `JwtAuthGuard`, `RolesGuard`, roles `ADMIN` and `INSTRUCTOR`. Protect playback with `JwtAuthGuard`; authorization to lesson-level playback is handled in P4b when attached lesson context is available.

- [x] **Step 2.6: Verify media API**

Run:

```bash
npm.cmd run test:e2e --workspace=backend -- media.e2e-spec.ts
npm.cmd run build:backend
```

Expected: tests and backend build pass.

---

### Task 3: Progress REST Service

**Files:**
- Create: `shared/src/progress.ts`
- Modify: `shared/src/index.ts`
- Create: `backend/src/modules/progress/dto/progress-heartbeat.dto.ts`
- Create: `backend/src/modules/progress/progress.controller.ts`
- Create: `backend/src/modules/progress/progress.service.ts`
- Create: `backend/src/modules/progress/progress.module.ts`
- Create: `backend/test/progress.e2e-spec.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Produces: `ProgressService.recordHeartbeat(user, lessonId, positionSeconds): Promise<LessonProgressResponse>`.
- Produces: `GET /api/me/courses/:courseId/progress`.
- Produces: `GET /api/courses/:courseId/progress`.
- Consumes: Prisma `LessonProgress`, enrollment checks, instructor ownership checks.

- [x] **Step 3.1: Write progress e2e tests**

Verify:
- enrolled student sees own course progress.
- `recordHeartbeat()` never decreases `positionSeconds`.
- a lesson becomes complete when `positionSeconds >= durationSeconds`.
- instructor sees per-student course progress.
- unenrolled student cannot read course progress.

- [x] **Step 3.2: Run progress tests to verify failure**

Run:

```bash
npm.cmd run test:e2e --workspace=backend -- progress.e2e-spec.ts
```

Expected: fail before progress module exists.

- [x] **Step 3.3: Add shared progress types**

Create `shared/src/progress.ts` with `LessonProgressResponse`, `CourseProgressResponse`, and `InstructorCourseProgressResponse`.

- [x] **Step 3.4: Implement ProgressService**

Use upsert on `(userId, lessonId)`. Store `Math.max(existing.positionSeconds, incomingPositionSeconds)`. Set `completedAt` only once when lesson duration is positive and stored position reaches duration.

- [x] **Step 3.5: Implement progress controllers and module**

Expose authenticated REST read endpoints for student and instructor views. Register `ProgressModule` in `AppModule`.

- [x] **Step 3.6: Verify progress REST**

Run:

```bash
npm.cmd run test:e2e --workspace=backend -- progress.e2e-spec.ts
npm.cmd run build:backend
npm.cmd run build:shared
```

Expected: tests and builds pass.

---

### Task 4: Realtime Progress Heartbeat and Debounced DB Flush

**Files:**
- Modify: `shared/src/realtime.ts`
- Modify: `backend/src/queue/queue.constants.ts`
- Modify: `backend/src/queue/queue.module.ts`
- Modify: `backend/src/modules/sessions/dto/progress-heartbeat.dto.ts`
- Modify: `backend/src/modules/sessions/sessions.gateway.ts`
- Modify: `backend/src/modules/sessions/sessions.realtime.service.ts`
- Create: `backend/src/modules/progress/progress.processor.ts`
- Modify: `backend/src/modules/progress/progress.module.ts`
- Create: `backend/test/progress-realtime.e2e-spec.ts`

**Interfaces:**
- Produces: `/sessions` event `progress:heartbeat`.
- Produces: `/sessions` event `progress:updated` for instructor course room.
- Produces: BullMQ job `progress-flush`.
- Consumes: `ProgressService.recordHeartbeat()`, Redis hash `progress:{userId}:{lessonId}`.

- [ ] **Step 4.1: Write realtime progress e2e tests**

Verify:
- enrolled student emits `progress:heartbeat` and Redis receives latest position.
- lower subsequent position does not move Redis state backwards.
- instructor socket receives `progress:updated` when completion occurs.

- [ ] **Step 4.2: Run realtime tests to verify failure**

Run:

```bash
$env:REDIS_URL='redis://:123456@localhost:6379'; npm.cmd run test:e2e --workspace=backend -- progress-realtime.e2e-spec.ts
```

Expected: fail before event handler exists.

- [ ] **Step 4.3: Add shared realtime progress contracts**

Add `ProgressHeartbeatPayload` and `ProgressUpdatedPayload` to `shared/src/realtime.ts`.

- [ ] **Step 4.4: Add heartbeat handler**

Validate `lessonId` and `positionSeconds`. Reuse existing session namespace auth. Ensure the student can access the lesson's course. Store Redis hash fields `positionSeconds`, `updatedAt`, `courseId`, and `sessionId`.

- [ ] **Step 4.5: Add debounced progress flush job**

Queue job id must be `progress:flush:{userId}:{lessonId}` with 60s delay. Remove the previous delayed job before adding a new one. Processor reads Redis, calls `ProgressService.recordHeartbeat()`, and deletes the hash only after a successful DB write.

- [ ] **Step 4.6: Emit instructor progress updates**

When `recordHeartbeat()` creates a new completion, emit `progress:updated` to `course:{courseId}:instructors`.

- [ ] **Step 4.7: Verify realtime progress**

Run:

```bash
$env:REDIS_URL='redis://:123456@localhost:6379'; npm.cmd run test:e2e --workspace=backend -- progress-realtime.e2e-spec.ts
npm.cmd run build:backend
npm.cmd run build:shared
```

Expected: tests and builds pass.

---

### Task 5: Seed, README, Swagger, and Final Verification

**Files:**
- Modify: `backend/prisma/seed.ts`
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-09-03-lms-realtime-p3b-media-progress-backend.md`

**Interfaces:**
- Produces: seeded uploaded media asset attached to a lesson.
- Produces: local smoke docs for MinIO upload/playback and progress heartbeat.
- Consumes: all P3b modules.

- [ ] **Step 5.1: Upgrade seed data**

Create one `MediaAsset` with status `UPLOADED` and attach it to the first seeded lesson. The object key may point to `videos/seed-demo.mp4`; actual MinIO object upload is documented as optional local smoke.

- [ ] **Step 5.2: Update README**

Document env keys, MinIO console credentials, media upload flow, playback endpoint, student progress endpoints, and realtime `progress:heartbeat`.

- [ ] **Step 5.3: Run final verification**

Run:

```bash
npm.cmd run test:e2e --workspace=backend
npm.cmd run build
npm.cmd run test:frontend
```

Expected: all backend e2e tests, backend/shared/frontend builds, and frontend tests pass.

- [ ] **Step 5.4: Seed local DB**

Run:

```bash
npm.cmd run db:seed --workspace=backend
```

Expected: seed prints demo credentials and creates at least one uploaded media asset.

- [ ] **Step 5.5: Mark plan complete**

After all verification passes, check off every completed task in this plan.

---

## P3b Acceptance Checklist

- [x] Backend validates MinIO/S3 env values.
- [x] Instructor/admin can create presigned upload URLs for `video/mp4` and `video/webm`.
- [x] Upload create rejects invalid type and files larger than `2GB`.
- [x] Upload complete verifies object existence, content length, and content type.
- [x] Playback endpoint returns a private presigned URL only for uploaded assets.
- [x] Student course progress endpoint computes percent from completed lessons.
- [x] Instructor course progress endpoint returns per-student progress.
- [x] Progress position never decreases.
- [x] Lesson completion sets `completedAt` only once.
- [ ] `/sessions` accepts `progress:heartbeat`.
- [ ] Redis stores latest heartbeat immediately.
- [ ] BullMQ flush persists heartbeat to PostgreSQL after debounce.
- [ ] Instructor course room receives `progress:updated` on new completion.
- [ ] Backend e2e tests pass.
- [ ] Backend, shared, and frontend builds pass.

## Out of Scope for P3b

- Frontend video upload UI.
- Frontend video playback UI.
- Frontend progress dashboard UI.
- HLS transcoding.
- Public object buckets.
- Production Docker and CI.

## Suggested Next Plans

- **P4b Media & Progress Frontend:** video upload controls, playback shell, progress heartbeat client, student progress display, instructor progress visibility.
- **P5 Docker & CI:** production Dockerfiles, Nginx reverse proxy with WS upgrade, GitHub Actions, Playwright e2e.

## Self-Review

- [x] **Spec coverage:** Covers MinIO presigned upload/complete/playback and heartbeat progress requirements from sections 5.3 and 5.4.
- [x] **Scope control:** Frontend video/progress UI remains split into P4b because it depends on these backend APIs.
- [x] **Placeholder scan:** No TBD/TODO placeholders remain; every task has concrete files, behavior, and verification commands.
- [x] **Type consistency:** Shared response names and service method names are defined before later tasks consume them.
- [x] **Verification discipline:** Each implementation task ends with focused e2e/build verification.

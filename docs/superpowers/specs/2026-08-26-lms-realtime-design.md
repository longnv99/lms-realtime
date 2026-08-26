# LMS Realtime — Design Spec

- **Ngày:** 2026-08-26
- **Trạng thái:** Đã duyệt qua brainstorming — chờ user review
- **Phạm vi:** Toàn bộ dự án lms-realtime (backend + frontend + infra)

## 1. Mục tiêu & bối cảnh

Xây dựng ứng dụng LMS (Learning Management System) realtime theo mô hình **modular monolith** làm dự án **học tập/portfolio**. Ưu tiên: làm đúng chuẩn, đủ tính năng nổi bật (realtime chat, quiz đồng bộ, leaderboard), không cần scale thật.

### Quyết định đã chốt trong brainstorming

| # | Quyết định | Lý do |
|---|---|---|
| 1 | Mục đích: học tập/portfolio | Không đầu tư scale/observability nặng nề |
| 2 | Chỉ BullMQ + Redis, **bỏ RabbitMQ** khỏi infra | Một pattern queue duy nhất, ít service hơn |
| 3 | **Live class là trọng tâm** — entity `Session` + `QuizRun` | Chat/quiz realtime gắn với buổi học theo lịch |
| 4 | Không thanh toán — enrollment miễn phí | YAGNI, mở rộng sau dễ |
| 5 | Testing phương án B — test song song phần lõi (auth, quiz scoring, progress, chat gateway), bỏ test UI thuần | Cân bằng tốc độ/chất lượng |
| 6 | Monolith 1 process: REST + WS + BullMQ worker inline | Deploy 1 container, ít moving parts |

### Giả định quan trọng

Buổi live **không có streaming A/V thật** (không WebRTC/RTMP). "Live" = đồng thời: học viên vào cùng room realtime, chat tức thì, instructor điều khiển quiz đồng bộ, xem video lesson song song. Video phục vụ qua MinIO presigned URL.

## 2. Kiến trúc tổng thể

### 2.1 Cấu trúc dự án

```
lms/                                   # root (npm workspaces)
├── backend/                           # NestJS monolith
│   ├── prisma/
│   │   ├── schema/                    # multi-file Prisma (single Postgres schema `public`)
│   │   │   ├── user.prisma
│   │   │   ├── course.prisma
│   │   │   ├── session.prisma
│   │   │   ├── quiz.prisma
│   │   │   ├── media.prisma
│   │   │   └── progress.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   ├── src/
│   │   ├── main.ts                    # bootstrap: env validation, Swagger, CORS
│   │   ├── app.module.ts
│   │   ├── common/                    # guards (jwt, roles, ws-jwt), filters, interceptors, decorators
│   │   ├── config/                    # env validation (zod), jwt/redis/minio/brevo config
│   │   ├── prisma/                    # PrismaModule (Global) + PrismaService
│   │   ├── queue/                     # BullMQ setup toàn cục
│   │   ├── realtime/                  # Redis adapter + WS auth guard chia sẻ
│   │   │   ├── realtime.module.ts
│   │   │   └── redis-io.adapter.ts
│   │   └── modules/
│   │       ├── auth/
│   │       ├── users/
│   │       ├── courses/
│   │       ├── lessons/
│   │       ├── enrollments/
│   │       ├── sessions/              # buổi học live (mới — tách riêng)
│   │       ├── media/
│   │       ├── progress/
│   │       ├── chat/                  # WS gateway /sessions
│   │       ├── quiz/                  # WS gateway /quiz + REST quản trị quiz
│   │       └── notifications/         # BullMQ consumer
│   ├── test/                          # jest + supertest e2e
│   ├── Dockerfile (multi-stage)
│   ├── Dockerfile.dev
│   └── .env.example
├── frontend/                          # Vite + React + TS
│   ├── src/
│   │   ├── main.tsx, App.tsx
│   │   ├── api/                       # axios client + react-query hooks
│   │   ├── features/{auth,courses,lessons,chat,quiz}/
│   │   ├── components/, pages/, routes/, hooks/
│   │   ├── lib/                       # utils, constants, socket client
│   │   ├── store/                     # zustand
│   │   └── types/
│   ├── Dockerfile
│   └── nginx.conf                     # SPA + proxy /api + /socket.io
├── shared/                            # package @lms/shared — types/events dùng chung
│   └── types/
├── docker-compose.infra.yml           # dev local: postgres, redis, minio (KHÔNG rabbitmq)
├── docker-compose.prod.yml
├── .github/workflows/ci.yml
└── README.md
```

Mỗi feature module backend theo chuẩn: `dto/` (create, update, index), `*.controller.ts`, `*.service.ts`, `*.module.ts`, `*.gateway.ts` (nếu realtime), `*.controller.spec.ts`.

### 2.2 Stack công nghệ

| Thành phần | Công nghệ |
|---|---|
| Backend framework | NestJS 10+ |
| ORM | Prisma (schema multi-file) |
| Database | PostgreSQL 16 |
| Cache/queue/realtime backbone | Redis 7 |
| Job queue | BullMQ qua `@nestjs/bullmq` (worker inline) |
| WebSocket | Socket.IO + `@socket.io/redis-adapter` |
| Object storage | MinIO (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`) |
| Auth | `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`, bcrypt |
| Email | Brevo API (có mock mode khi chưa có API key) |
| Validation | class-validator + class-transformer (REST + WS pipe) |
| Env validation | zod, fail fast lúc startup |
| Frontend | Vite + React + TypeScript |
| Data fetching | TanStack Query (react-query) + axios |
| State | Zustand |
| E2E FE | Playwright |

### 2.3 Nguyên tắc kiến trúc

- **`shared/` là nguồn chân lý** cho Socket.IO event payload + response shape. BE typing gateway, FE typing socket client — một định nghĩa duy nhất (`@lms/shared`).
- **npm workspaces** tại root. Không pnpm/turbo.
- **Redis adapter cho Socket.IO cấu hình từ ngày đầu** — emit qua room, không bao giờ trực tiếp socketId.
- **BullMQ processor inline** trong process NestJS, đăng ký trong feature module tương ứng.
- Ports dev: BE **4000**, FE **5173**, MinIO 9000/9001, Postgres 5432, Redis 6379. Port 4000 phải đồng nhất giữa `backend/.env` (`PORT`), `frontend/vite.config.ts` (proxy target), `docker-compose.prod.yml` (Nginx upstream), `frontend/nginx.conf`. Đặt vào `.env.example` ở mỗi app, không hardcode.

## 3. Data model (Prisma)

### 3.1 Các entity chính

```
User 1──* Course (instructorId)
User *──* Course          qua Enrollment (unique userId+courseId)
Course 1──* Lesson        (lesson.order sắp thứ tự)
Course 1──* Session       ← buổi học live
Lesson 1──1 MediaAsset?   (nullable, attach sau khi upload xong)
Session 1──* ChatMessage  (index sessionId+createdAt)
Lesson 1──* Quiz
Quiz 1──* Question        (options + correctOptionId lưu JSON)
Session 1──* QuizRun      ← một quiz được chạy trong buổi nào
QuizRun 1──* QuizAnswer   (unique runId+questionId+userId)
User 1──* LessonProgress  (unique userId+lessonId)
User 1──* RefreshToken    (tokenHash, expiresAt, revokedAt)
User 1──* Notification    (in-app)
```

### 3.2 Entity Session (buổi học live)

```
Session: id, courseId, title, startsAt, endsAt,
         status: SCHEDULED → LIVE → ENDED | CANCELLED
QuizRun: id, quizId, sessionId, currentQuestionIndex,
         status: PENDING → OPEN → CLOSED → REVEALED
```

- `Session` là "phòng" realtime: room Socket.IO `session:<id>`. Status chuyển qua REST (instructor start/end) + broadcast event.
- `QuizRun` tách khỏi `Quiz`: nội dung quiz là data tĩnh, QuizRun là một lần chạy cụ thể trong session — instructor điều khiển `currentQuestionIndex` (mở/đóng/reveal), mọi thay đổi broadcast đến room. Leaderboard tính từ Redis sorted set; `QuizAnswer` persist xuống DB.

### 3.3 Quyết định data model

1. **Question.options là JSON** (`{id, text}[]` + `correctOptionId`): không tách bảng Option.
2. **MediaAsset status** `PENDING → UPLOADED`: presigned flow 2 bước. Lesson chỉ attach asset `UPLOADED`.
3. **LessonProgress**: `positionSeconds + lastWatchedAt + completedAt`. Heartbeat cập nhật position (không cho lùi). % hoàn thành = số lesson có `completedAt` / tổng lesson — tính lúc GET, không lưu dần.
4. **RefreshToken bảng riêng, lưu hash** — rotation khi refresh + revoke khi logout.
5. **Không có** Order/Payment, không moderation chat (xóa tin nhắn) — phase sau nếu cần.

## 4. API surface & realtime contract

### 4.1 REST API (prefix `/api`, envelope thống nhất `{success, data, error, meta}`)

| Module | Endpoints chính |
|---|---|
| Auth | POST /auth/register, /auth/login, /auth/refresh, /auth/logout |
| Users | GET /users/me, PATCH /users/me; GET /users, PATCH /users/:id, DELETE /users/:id (admin, phân trang) |
| Courses | GET /courses (public, filter status/keyword), POST /courses, GET/PATCH/DELETE /courses/:id, POST /courses/:id/publish, /:id/unpublish |
| Lessons | POST /courses/:courseId/lessons, GET /courses/:courseId/lessons, PATCH/DELETE /lessons/:id, PATCH /courses/:courseId/lessons/reorder |
| Enrollments | POST /courses/:courseId/enroll (self), DELETE /courses/:courseId/enroll (hủy), GET /courses/:courseId/enrollments (instructor), GET /me/enrollments |
| Sessions | POST /courses/:courseId/sessions, PATCH/DELETE /sessions/:id, POST /sessions/:id/start, /:id/end (instructor) |
| Media | POST /media/uploads (tạo MediaAsset PENDING → presigned PUT), POST /media/uploads/:id/complete |
| Progress | GET /me/courses/:courseId/progress, GET /courses/:courseId/progress (instructor view) |
| Notifications | GET /me/notifications, PATCH /me/notifications/:id/read |
| Quizzes | POST /lessons/:lessonId/quizzes, PATCH/DELETE /quizzes/:id (REST chỉ quản trị) |
| Quiz runs | POST /sessions/:sessionId/quiz-runs (instructor chọn quiz), POST /quiz-runs/:id/questions/next, /:id/questions/close, /:id/reveal, /:id/finish; **GET /quiz-runs/:id/state** (resync sau reconnect) |
| Sessions state | **GET /sessions/:id/state** (status + participantCount, resync cho chat) |

Sessions và QuizRun tách module riêng (không nhét Lessons/Quiz). Câu trả lời học viên đi qua **Socket.IO**, không REST.

### 4.2 Realtime contract — 3 namespace, room = `session:<id>` / `quiz-run:<id>` / `user:<id>`

**Namespace `/sessions`** (chat + presence + sync trạng thái buổi):

| Hướng | Event | Payload |
|---|---|---|
| C→S | session:join | `{ sessionId }` — kiểm enrollment + session LIVE |
| S→C | session:state | `{ status, participantCount }` khi start/end |
| C→S | chat:send | `{ sessionId, content }` — validate, persist, broadcast |
| S→C | chat:message | `{ id, sessionId, userId, name, content, createdAt }` |
| C→S | progress:heartbeat | `{ lessonId, positionSeconds }` — throttled 10s |
| S→C | progress:updated | `{ courseId, lessonId, userId?, percent }` |

**Namespace `/quiz`** (room = `quiz-run:<id>`):

| Hướng | Event | Payload |
|---|---|---|
| C→S | quiz:join | `{ quizRunId }` |
| C→S | quiz:answer | `{ quizRunId, questionId, optionId }` — chỉ nhận khi status OPEN |
| S→C | quiz:question | `{ currentQuestionIndex, question: {id, text, options} }` — KHÔNG có correctOptionId |
| S→C | quiz:question:closed | `{ questionId, answerCount }` |
| S→C | quiz:reveal | `{ questionId, correctOptionId, correctCount }` |
| S→C | quiz:leaderboard | `{ entries: [{userId, name, score, rank}] }` top 10 + rank của mình |
| S→C | quiz:finished | `{ summaryUrl }` |

**Namespace `/notifications`** (room `user:<id>`): S→C `notification:new` `{ id, type, title, body }`.

**Quy tắc chung:**
- Module name trong NestJS (`chat/`, `quiz/`) là tổ chức code, **không trùng** với namespace Socket.IO. Chat dùng namespace `/sessions` vì chat gắn với buổi học.
- Room convention: `/sessions` → `session:<sessionId>`; `/quiz` → `quiz-run:<quizRunId>`; `/notifications` → `user:<userId>`.
- Auth JWT trong `handshake.auth.token` (WS guard dùng chung logic REST guard).
- Mọi event validate payload bằng class-validator.
- Server emit qua room, không bao giờ trực tiếp socketId (scale-ready với Redis adapter).
- Client reconnect với backoff + resync qua REST khi mất kết nối.
- `progress:updated` **không broadcast đại trà** — chỉ gửi về instructor qua channel riêng (`course:<courseId>:instructors`) khi một học viên đạt 100% lesson mới; học viên tự fetch progress qua REST.

## 5. Luồng dữ liệu chính

### 5.1 Publish khóa học → email async

1. Instructor POST /courses/:id/publish
2. CoursesService: transaction Prisma (status=PUBLISHED, ghi publishedAt)
3. Sau khi transaction commit → producer.add('course-published', {courseId}, {jobId: `course-published:${courseId}:${version}`})
4. BullMQ worker trong cùng process:
   - Fetch course + danh sách enrollment (batch 100)
   - Với mỗi batch: gọi Brevo API (concurrency 5) + insert Notification in-app
5. Thất bại → BullMQ exponential backoff (3 lần: 10s/1m/10m)

JobId có version → publish/unpublish/publish lại không mất job, không gửi trùng.

### 5.2 Quiz flow end-to-end (realtime lõi)

1. Instructor POST /quiz-runs/:id/questions/next → cập nhật `currentQuestionIndex`, status=OPEN, ghi `questionOpenedAt` → emit `quiz:question` (payload KHÔNG chứa đáp án) tới room `quiz-run:<id>`.
2. Client emit `quiz:answer` → WS guard: enrolled + run OPEN + chưa trả lời câu này (check `QuizAnswer` DB) → trong **một transaction Prisma**: insert `QuizAnswer` row (`{runId, questionId, userId, selectedOptionId, isCorrect, answeredAt}`) với unique constraint `(runId, questionId, userId)` để chống double-submit race. Sau khi commit: `ZADD quiz-run:<id>:leaderboard <score> <userId>` (Redis chỉ là live index, có thể rebuild lại từ DB nếu mất). `INCR quiz-run:<id>:q:<n>:count`. Không broadcast từng answer.
3. Instructor close → đọc `answerCount` từ Redis → emit `quiz:question:closed`.
4. Instructor reveal → fetch `correctOptionId` từ DB, emit `quiz:reveal`.
5. Instructor finish → cleanup Redis keys (`DEL quiz-run:<id>:leaderboard`, `DEL quiz-run:<id>:q:*:count`) + emit `quiz:finished`. **Không persist gì thêm** — toàn bộ câu trả lời đã có trong DB từ bước 2.

**Score formula (chính xác):** `score = (isCorrect ? 100 : 0) + max(0, 50 - Math.floor(elapsedSeconds))`, với `elapsedSeconds = (answeredAt - questionOpenedAt) / 1000`. Câu đúng tối đa 150 điểm, câu sai 0 điểm; ai trả lời sớm nhất được bonus lớn nhất.

**Crash safety:** Server crash giữa buổi học → toàn bộ câu trả lời vẫn còn trong DB (đã insert ở bước 2). Khi restart, leaderboard Redis có thể rebuild bằng `ZADD` lại từ `SELECT userId, SUM(score) FROM QuizAnswer WHERE runId=?`. Tổng kết GET summary = `SELECT ... FROM QuizAnswer` + group, không cần entity riêng.

### 5.3 Presigned upload (MinIO)

1. POST /media/uploads `{fileName, contentType, sizeBytes}` → validate mime ∈ {video/mp4, video/webm}, size ≤ 2GB → tạo MediaAsset(PENDING, key=`videos/{uuid}.{ext}`) → trả `{assetId, uploadUrl (PUT, TTL 15 phút), key}`.
2. Client PUT trực tiếp lên MinIO (không qua BE).
3. POST /media/uploads/:id/complete → BE `HeadObject` MinIO kiểm tra: object tồn tại, `Content-Length` khớp `sizeBytes` đã khai báo, `Content-Type` khớp. Bất kỳ mismatch nào → reject với `MEDIA_SIZE_MISMATCH` / `MEDIA_INVALID_TYPE`. Match hết → status=UPLOADED.

Playback: GET presigned URL TTL 30 phút — bucket không public; chỉ instructor mới có quyền upload qua endpoint.

### 5.4 Heartbeat progress

**FE:** emit `progress:heartbeat` mỗi 10s khi video đang phát (lắng nghe `timeupdate` + interval) + 1 lần khi `pause` / `seeked` / `unmount` (visibilitychange cũng gửi).

**BE:** nhận heartbeat qua WS → cập nhật Redis hash `progress:{userId}:{lessonId}` `{positionSeconds, updatedAt}` (live state, instructor có thể xem tức thì, client reconnect dùng làm fallback). DB write **debounced**:
- ngay lập tức khi nhận event `pause` / `seeked` / `unmount` (force flush),
- hoặc mỗi **60 giây** một lần qua BullMQ delayed job (jobId `progress:flush:{userId}:{lessonId}`, khi heartbeat tiếp theo đến thì xóa job cũ + tạo job mới với delay 60s).
- Khi `positionSeconds ≥ 95% duration` → set `completedAt` luôn (không debounce).
- Logic DB: `positionSeconds = max(old, new)` (không cho lùi), upsert một row.

**Lý do:** 10s DB write × 100 concurrent user = 10 writes/sec — không tốiưu. Redis làm buffer giảm xuống ~1.7 writes/sec (debounce 60s) mà vẫn có live state qua Redis. Khi scale hơn nữa có thể BatchObserver gộp nhiều user vào một transaction.

### 5.5 Auth & refresh rotation

Access token 15 phút, refresh token 30 ngày (hash lưu DB). POST /auth/refresh → validate refresh (tồn tại + chưa revoked + chưa hết hạn) → **rotation**: revoke cái cũ, phát cặp mới. **Reuse refresh token đã revoked = nghi ngờ bị đánh cắp → revoke toàn bộ token của user đó** (fallback an toàn, không cần device management phức tạp).

### 5.6 Error handling

- BE filter toàn cục `AllExceptionsFilter` → envelope `{ success: false, error: { code, message, details } }`. Lỗi Prisma map: P2002→409, P2025→404, P2003→400.
- FE axios interceptor: 401 → thử refresh (1 request refresh chung, queue các request khác) → thất bại → logout; network/5xx → toast thân thiện + log context.
- WS errors: emit `error` event có `code` thay vì throw (mất client). Client hiển thị + tự resync qua REST.
- Validation: class-validator global pipe + whitelist + transform (REST) / custom WS pipe (socket) — payload lạ chặn tại cửa.

**Error codes chuẩn** (FE dùng để i18n + toast tương ứng):

| Domain | Code | HTTP | Mô tả |
|---|---|---|---|
| Auth | `AUTH_INVALID_CREDENTIALS` | 401 | Sai email/password |
| Auth | `AUTH_REFRESH_REUSED` | 401 | Refresh token đã revoke → đã logout toàn bộ session |
| Auth | `AUTH_FORBIDDEN` | 403 | Không đủ role |
| Auth | `AUTH_UNAUTHENTICATED` | 401 | Thiếu/không hợp lệ JWT |
| Course | `COURSE_NOT_PUBLISHED` | 400 | Học viên cố enroll khóa DRAFT |
| Course | `COURSE_SLUG_TAKEN` | 409 | Slug trùng |
| Enrollment | `ENROLL_ALREADY` | 409 | Đã ghi danh rồi |
| Lesson | `LESSON_MEDIA_NOT_READY` | 400 | Attach MediaAsset còn PENDING |
| Quiz | `QUIZ_NOT_OPEN` | 400 | Trả lời khi question không OPEN |
| Quiz | `QUIZ_ALREADY_ANSWERED` | 409 | Đã submit câu này (unique constraint) |
| Quiz | `QUIZ_RUN_LOCKED` | 400 | QuizRun đã ENDED |
| Media | `MEDIA_INVALID_TYPE` | 400 | Không phải video/mp4 hoặc video/webm |
| Media | `MEDIA_TOO_LARGE` | 413 | > 2GB |
| Media | `MEDIA_SIZE_MISMATCH` | 400 | Content-Length sau upload khác size khai báo |
| Validation | `VALIDATION_FAILED` | 400 | class-validator fail (kèm `details: [{field, constraints}]`) |
| Generic | `INTERNAL_ERROR` | 500 | Lỗi không phân loại — log server-side đầy đủ |

Codes định nghĩa trong `@lms/shared/errors` để BE + FE cùng import.

## 6. Testing strategy

| Layer | Phạm vi | Công cụ |
|---|---|---|
| BE unit | AuthService (hash, rotation, reuse-detect), QuizService (scoring, speed bonus), ProgressService (max-position, completedAt), CoursesService (publish flow) | Jest + mock PrismaService |
| BE realtime | ChatGateway + QuizGateway: join/answer/broadcast, từ chối khi không enrolled hoặc question CLOSED | socket.io-client chạy ngược gateway instance |
| BE e2e | Auth flow, courses CRUD + publish → notification, enroll → progress | Jest + supertest, DB test riêng (`lms_test`) |
| FE | hooks + stores (auth store, quiz store, socket client reconnect), query hooks với MSW | Vitest + Testing Library |
| E2E toàn hệ | Login → enroll → vào session live → chat → quiz → thấy leaderboard | Playwright chạy trong CI |

Bỏ test UI thuần (button render...). Bắt buộc test cho auth, quiz scoring, progress, chat gateway — chỗ có logic thật. Coverage ≥80% cho backend; FE không ép coverage cứng.

## 7. Seeding & dữ liệu mẫu

`prisma/seed.ts`: 3 role users (admin + 2 instructor + 5 student), 2 khóa học (1 PUBLISHED với 3 lesson + video demo nhỏ, 1 DRAFT), mỗi khóa 2 session (1 SCHEDULED hôm sau, 1 sẵn bật LIVE), quiz 5 câu gắn lesson, enrollment mẫu. Lệnh: `docker compose -f docker-compose.infra.yml up -d` → `npm run db:seed` → `npm run dev`.

## 8. Env & config

- `.env.example` tại root + backend + frontend, tất cả biến bắt buộc validate bằng zod lúc startup (fail fast).
- Dev compose: Postgres 5432, Redis 6379, MinIO 9000/9001. BE 4000, FE 5173.

## 9. Roadmap thực thi (khớp Gantt, điều chỉnh nhẹ theo chốt hạ)

| Phase | Nội dung | Điều chỉnh so với bản gốc |
|---|---|---|
| P1 Infra & Setup | Repo + NestJS + Vite + npm workspaces + shared/ + docker compose (3 service) | Bỏ RabbitMQ khỏi compose. Thêm npm workspaces + shared/ ngay từ đầu |
| P2 Backend Core | Prisma schema multi-file + Session/QuizRun entity mới, Auth có refresh rotation + reuse-detect, User/Course/Lesson CRUD | |
| P3 Realtime & Async | WebSocket gateways (chat + quiz + notifications), BullMQ producer/worker, Brevo integration (có mock mode khi chưa có API key) | Quiz gateway là phần lớn nhất (~5 ngày) |
| P4 Frontend | Auth flow + protected routes, courses/lessons UI + TanStack Query, realtime chat/quiz UI, upload video qua presigned URL. Trang Session live = màn hình "demo" chính của portfolio | |
| P5 Docker & CI | Multi-stage BE Dockerfile, FE nginx Dockerfile, docker-compose.prod + Nginx reverse proxy (WS upgrade), GitHub Actions (lint + typecheck + test song song matrix, build 2 image, e2e Playwright) | |

Mỗi phase kết thúc = demo chạy được tương ứng, không sang phase mới khi phase cũ chưa có gì chạy. Tổng ~13 tuần part-time.

## 10. Tiêu chí nghiệm thu

- Backend build + lint + typecheck + test pass trong CI.
- FE build + lint + typecheck + test pass trong CI.
- Playwright e2e chạy xanh (login → enroll → session live → chat + quiz).
- 2 Docker image build thành công, `docker compose -f docker-compose.prod.yml up` chạy được full stack.
- README đủ rõ để người lạ clone về chạy được trong 5 phút.

## 11. Ngoài phạm vi (YAGNI)

- Thanh toán / Order / Payment
- WebRTC/RTMP streaming A/V
- Moderation chat (xóa tin nhắn, ban user)
- Multi-tenant / nhiều tổ chức
- OAuth2 (Google/Facebook login)
- HLS transcoding video
- Notification push (web push, mobile push)
- i18n đa ngôn ngữ UI (chỉ tiếng Việt)

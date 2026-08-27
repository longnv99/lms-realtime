# LMS Realtime P2 Backend Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build the backend core for LMS Realtime: Prisma persistence, env validation, auth with refresh-token rotation, role guards, and REST CRUD for users, courses, enrollments, lessons, sessions, quizzes, and quiz runs.

**Architecture:** Keep the NestJS app as a modular monolith. Add a global Prisma module, small feature modules under `backend/src/modules/*`, shared response/error contracts in `@lms/shared`, and focused Jest e2e tests that run against a local Postgres database. Realtime gateways, BullMQ jobs, MinIO upload endpoints, progress heartbeat, Brevo, and frontend product UI stay out of P2.

**Tech Stack:** NestJS 10, TypeScript strict mode, Prisma ORM 7, PostgreSQL 16, Zod env validation, `@nestjs/jwt`, `passport-jwt`, bcrypt, Jest + Supertest.

**Spec:** `docs/superpowers/specs/2026-08-26-lms-realtime-design.md`

**External Reference Checked:** Prisma official schema location docs: https://www.prisma.io/docs/orm/v6/prisma-schema/overview/location. Multi-file schemas are GA since Prisma 6.7; Prisma 7 should point `prisma.config.ts` at the schema directory, not only one `.prisma` file.

## Global Constraints

- Use npm workspaces at root. Do not add pnpm, yarn, turbo, or nx.
- Backend dev port is `4000`; frontend dev port is `5173`; Postgres is `5432`; Redis is `6379`; MinIO is `9000/9001`.
- REST uses prefix `/api` and response envelope `{ success, data, error, meta }`.
- Local frontend proxy should call backend `/api/*` without stripping `/api`.
- Keep RabbitMQ out of the project. P3 queues use BullMQ on Redis.
- Auth uses access token TTL 15 minutes and refresh token TTL 30 days.
- Refresh tokens are stored only as hashes in Postgres.
- Reuse of a revoked refresh token revokes every active refresh token for the same user.
- No payments, orders, OAuth, real A/V streaming, chat moderation, or multi-tenant logic in P2.
- Use class-validator DTOs for REST input. Keep `whitelist`, `forbidNonWhitelisted`, and `transform` enabled globally.
- Add tests before implementation for each behavior-bearing task.

---

## File Structure

P2 creates or modifies these areas:

```text
backend/
  package.json                         # P2 scripts and dependencies
  .env.example                         # DATABASE_URL, JWT secrets, token TTLs
  prisma.config.ts                     # Prisma 7 config, schema directory, migrations path
  prisma/
    schema.prisma                      # generator + datasource provider
    models/
      user.prisma
      course.prisma
      session.prisma
      quiz.prisma
      media.prisma
      progress.prisma
      notification.prisma
    seed.ts
  src/
    app.module.ts
    main.ts
    config/
      env.ts
      env.module.ts
    prisma/
      prisma.module.ts
      prisma.service.ts
    common/
      decorators/current-user.decorator.ts
      decorators/roles.decorator.ts
      errors/app-error.ts
      filters/all-exceptions.filter.ts
      guards/jwt-auth.guard.ts
      guards/roles.guard.ts
      types/authenticated-request.ts
      utils/pagination.ts
    modules/
      auth/
      users/
      courses/
      lessons/
      enrollments/
      sessions/
      quizzes/
  test/
    auth.e2e-spec.ts
    courses.e2e-spec.ts
    lessons.e2e-spec.ts
    sessions-quizzes.e2e-spec.ts
    helpers/
      app.ts
      auth.ts
      db.ts

shared/
  src/
    api.ts
    errors.ts
    auth.ts
    users.ts
    courses.ts
    lessons.ts
    sessions.ts
    quizzes.ts
    index.ts
```

Note: The original spec sketch placed Prisma files under `backend/prisma/schema/*.prisma`. Use `backend/prisma/schema.prisma` plus `backend/prisma/models/*.prisma` for Prisma 7 compatibility while preserving the same domain split.

---

### Task 1: Shared Backend Contracts

**Files:**
- Create: `shared/src/api.ts`
- Create: `shared/src/errors.ts`
- Create: `shared/src/auth.ts`
- Create: `shared/src/users.ts`
- Create: `shared/src/courses.ts`
- Create: `shared/src/lessons.ts`
- Create: `shared/src/sessions.ts`
- Create: `shared/src/quizzes.ts`
- Modify: `shared/src/index.ts`

**Interfaces:**
- Produces: `ApiEnvelope<T>`, `ApiErrorCode`, `UserRole`, `AuthTokensResponse`, `CourseStatus`, `SessionStatus`, `QuizRunStatus`.
- Consumes: existing `HealthResponse`.

- [x] **Step 1.1: Add shared response and error contracts**

Create `shared/src/api.ts`:

```ts
export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  error: ApiError | null;
  meta: null | {
    page?: number;
    limit?: number;
    total?: number;
  };
}
```

Create `shared/src/errors.ts`:

```ts
export const API_ERROR_CODES = {
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_REFRESH_REUSED: 'AUTH_REFRESH_REUSED',
  AUTH_FORBIDDEN: 'AUTH_FORBIDDEN',
  AUTH_UNAUTHENTICATED: 'AUTH_UNAUTHENTICATED',
  COURSE_NOT_PUBLISHED: 'COURSE_NOT_PUBLISHED',
  COURSE_SLUG_TAKEN: 'COURSE_SLUG_TAKEN',
  ENROLL_ALREADY: 'ENROLL_ALREADY',
  LESSON_MEDIA_NOT_READY: 'LESSON_MEDIA_NOT_READY',
  QUIZ_NOT_OPEN: 'QUIZ_NOT_OPEN',
  QUIZ_ALREADY_ANSWERED: 'QUIZ_ALREADY_ANSWERED',
  QUIZ_RUN_LOCKED: 'QUIZ_RUN_LOCKED',
  MEDIA_INVALID_TYPE: 'MEDIA_INVALID_TYPE',
  MEDIA_TOO_LARGE: 'MEDIA_TOO_LARGE',
  MEDIA_SIZE_MISMATCH: 'MEDIA_SIZE_MISMATCH',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];
```

- [x] **Step 1.2: Add shared domain types**

Create `shared/src/auth.ts`:

```ts
export type UserRole = 'ADMIN' | 'INSTRUCTOR' | 'STUDENT';

export interface AuthUserResponse {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface AuthTokensResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUserResponse;
}
```

Create `shared/src/courses.ts`:

```ts
export type CourseStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface CourseResponse {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  status: CourseStatus;
  instructorId: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```

Create `shared/src/lessons.ts`:

```ts
export interface LessonResponse {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  order: number;
  durationSeconds: number;
  mediaAssetId: string | null;
  createdAt: string;
  updatedAt: string;
}
```

Create `shared/src/sessions.ts`:

```ts
export type SessionStatus = 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED';

export interface SessionResponse {
  id: string;
  courseId: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
}
```

Create `shared/src/quizzes.ts`:

```ts
export type QuizRunStatus = 'PENDING' | 'OPEN' | 'CLOSED' | 'REVEALED' | 'FINISHED';

export interface QuizOption {
  id: string;
  text: string;
}

export interface QuizQuestionResponse {
  id: string;
  text: string;
  options: QuizOption[];
}

export interface QuizResponse {
  id: string;
  lessonId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuizRunResponse {
  id: string;
  quizId: string;
  sessionId: string;
  currentQuestionIndex: number | null;
  status: QuizRunStatus;
  questionOpenedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```

- [x] **Step 1.3: Export all shared contracts**

Modify `shared/src/index.ts`:

```ts
export * from './api';
export * from './auth';
export * from './courses';
export * from './errors';
export * from './health';
export * from './lessons';
export * from './quizzes';
export * from './sessions';
```

- [x] **Step 1.4: Verify shared typecheck**

Run: `npm.cmd run typecheck --workspace=shared`

Expected: exit code 0.

- [x] **Step 1.5: Commit**

```bash
git add shared/src
git commit -m "feat(shared): add backend core API contracts"
```

---

### Task 2: Backend Dependencies, Env Validation, API Prefix, and Error Mapping

**Files:**
- Modify: `backend/package.json`
- Modify: `backend/.env.example`
- Create: `backend/src/config/env.ts`
- Create: `backend/src/config/env.module.ts`
- Create: `backend/src/common/errors/app-error.ts`
- Modify: `backend/src/common/filters/all-exceptions.filter.ts`
- Modify: `backend/src/main.ts`
- Modify: `backend/test/app.e2e-spec.ts`
- Create: `backend/test/helpers/app.ts`

**Interfaces:**
- Produces: `env` object with `PORT`, `DATABASE_URL`, JWT settings.
- Produces: `AppError` for domain-specific HTTP errors.
- Produces: `createTestApp()` helper used by later e2e tests.

- [x] **Step 2.1: Install backend dependencies**

Run from repo root:

```bash
npm.cmd install --workspace=backend @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt zod dotenv @prisma/client
npm.cmd install --workspace=backend --save-dev prisma tsx @types/bcrypt @types/passport-jwt
```

Expected: `backend/package.json` and root `package-lock.json` update.

- [x] **Step 2.2: Add backend env example values**

Modify `backend/.env.example`:

```env
PORT=4000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
LOG_LEVEL=debug

DATABASE_URL=postgresql://lms:lms_dev_password@localhost:5432/lms?schema=public
JWT_ACCESS_SECRET=dev_access_secret_change_me
JWT_REFRESH_SECRET=dev_refresh_secret_change_me
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN_DAYS=30
```

Create a local uncommitted env file for development and e2e:

```powershell
Copy-Item backend\.env.example backend\.env
```

Expected: `backend/.env` exists locally and remains ignored by Git.

- [x] **Step 2.3: Add env validation**

Create `backend/src/config/env.ts`:

```ts
import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z.string().default('debug'),
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN_DAYS: z.coerce.number().int().positive().default(30),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
```

Create `backend/src/config/env.module.ts`:

```ts
import { Global, Module } from '@nestjs/common';

@Global()
@Module({})
export class EnvModule {}
```

- [x] **Step 2.4: Add AppError**

Create `backend/src/common/errors/app-error.ts`:

```ts
import { HttpException, HttpStatus } from '@nestjs/common';
import type { ApiErrorCode } from '@lms/shared';

export class AppError extends HttpException {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    status: HttpStatus,
    public readonly details?: unknown,
  ) {
    super(message, status);
  }
}
```

- [x] **Step 2.5: Improve global error mapping**

Modify `backend/src/common/filters/all-exceptions.filter.ts` so:

```ts
import { API_ERROR_CODES } from '@lms/shared';
import { AppError } from '../errors/app-error';
```

Then in `catch()`:

```ts
const appError = exception instanceof AppError ? exception : null;
const status =
  exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
const code = appError?.code ?? this.mapHttpStatusToCode(status);
const message =
  exception instanceof HttpException ? exception.message : 'Loi may chu noi bo';
const details = appError?.details;

response.status(status).json({
  success: false,
  data: null,
  error: details ? { code, message, details } : { code, message },
  meta: null,
});
```

Update `mapHttpStatusToCode()` to return values from `API_ERROR_CODES`:

```ts
case HttpStatus.BAD_REQUEST:
  return API_ERROR_CODES.VALIDATION_FAILED;
case HttpStatus.UNAUTHORIZED:
  return API_ERROR_CODES.AUTH_UNAUTHENTICATED;
case HttpStatus.FORBIDDEN:
  return API_ERROR_CODES.AUTH_FORBIDDEN;
case HttpStatus.NOT_FOUND:
  return API_ERROR_CODES.NOT_FOUND;
case HttpStatus.CONFLICT:
  return API_ERROR_CODES.CONFLICT;
default:
  return status >= 500 ? API_ERROR_CODES.INTERNAL_ERROR : `HTTP_${status}`;
```

- [x] **Step 2.6: Align backend with `/api` prefix**

Modify `backend/src/main.ts`:

```ts
import { env } from './config/env';
```

Use:

```ts
const port = env.PORT;
const corsOrigin = env.CORS_ORIGIN;
app.setGlobalPrefix('api');
```

Keep CORS, global pipe, filter, and interceptor.

- [x] **Step 2.7: Add reusable test app helper**

Create `backend/test/helpers/app.ts`:

```ts
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { EnvelopeInterceptor } from '../../src/common/interceptors/envelope.interceptor';

export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new EnvelopeInterceptor());
  await app.init();
  return app;
}
```

- [x] **Step 2.8: Update health e2e paths**

Modify `backend/test/app.e2e-spec.ts` to use `createTestApp()` and paths:

```ts
.get('/api/health')
.get('/api/unknown')
```

- [x] **Step 2.9: Update frontend proxy for API prefix**

Modify `frontend/vite.config.ts` by removing the `rewrite` entry for `/api`.

Expected proxy block:

```ts
'/api': {
  target: 'http://localhost:4000',
  changeOrigin: true,
},
```

- [x] **Step 2.10: Verify health e2e**

Run: `npm.cmd run test:e2e --workspace=backend -- app.e2e-spec.ts`

Expected: 3 tests pass, including `GET /api/health`.

- [x] **Step 2.11: Commit**

```bash
git add backend frontend/vite.config.ts package-lock.json
git commit -m "feat(backend): add env validation and api error mapping"
```

---

### Task 3: Prisma Schema, Client, and Database Test Helpers

**Files:**
- Create: `backend/prisma.config.ts`
- Create: `backend/prisma/schema.prisma`
- Create: `backend/prisma/models/user.prisma`
- Create: `backend/prisma/models/course.prisma`
- Create: `backend/prisma/models/session.prisma`
- Create: `backend/prisma/models/quiz.prisma`
- Create: `backend/prisma/models/media.prisma`
- Create: `backend/prisma/models/progress.prisma`
- Create: `backend/prisma/models/notification.prisma`
- Create: `backend/src/prisma/prisma.service.ts`
- Create: `backend/src/prisma/prisma.module.ts`
- Modify: `backend/src/app.module.ts`
- Modify: `backend/package.json`
- Create: `backend/test/helpers/db.ts`

**Interfaces:**
- Produces: `PrismaService extends PrismaClient`.
- Produces: Prisma models required by Auth, Users, Courses, Lessons, Sessions, Quizzes, later P3/P4 modules.
- Consumes: `env.DATABASE_URL`.

- [x] **Step 3.1: Add Prisma scripts**

Modify `backend/package.json` scripts:

```json
"db:generate": "prisma generate",
"db:migrate": "prisma migrate dev",
"db:reset": "prisma migrate reset --force",
"db:seed": "tsx prisma/seed.ts"
```

Add top-level seed config:

```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
}
```

- [x] **Step 3.2: Add Prisma config**

Create `backend/prisma.config.ts`:

```ts
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
```

- [x] **Step 3.3: Add base Prisma schema**

Create `backend/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
}
```

- [x] **Step 3.4: Add user schema**

Create `backend/prisma/models/user.prisma`:

```prisma
enum UserRole {
  ADMIN
  INSTRUCTOR
  STUDENT
}

model User {
  id           String         @id @default(uuid())
  email        String         @unique
  passwordHash String
  name         String
  role         UserRole       @default(STUDENT)
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt

  refreshTokens RefreshToken[]
  courses       Course[]       @relation("CourseInstructor")
  enrollments   Enrollment[]
  lessonProgress LessonProgress[]
  chatMessages  ChatMessage[]
  quizAnswers   QuizAnswer[]
  notifications Notification[]
}

model RefreshToken {
  id        String    @id @default(uuid())
  userId    String
  tokenHash String    @unique
  expiresAt DateTime
  revokedAt DateTime?
  createdAt DateTime  @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
}
```

- [x] **Step 3.5: Add course, enrollment, and lesson schema**

Create `backend/prisma/models/course.prisma`:

```prisma
enum CourseStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

model Course {
  id           String       @id @default(uuid())
  title        String
  slug         String       @unique
  description  String?
  status       CourseStatus @default(DRAFT)
  instructorId String
  publishedAt  DateTime?
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt

  instructor  User         @relation("CourseInstructor", fields: [instructorId], references: [id])
  lessons     Lesson[]
  enrollments Enrollment[]
  sessions    Session[]

  @@index([status])
  @@index([instructorId])
}

model Enrollment {
  id        String   @id @default(uuid())
  userId    String
  courseId  String
  createdAt DateTime @default(now())

  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  course Course @relation(fields: [courseId], references: [id], onDelete: Cascade)

  @@unique([userId, courseId])
  @@index([courseId])
}

model Lesson {
  id              String   @id @default(uuid())
  courseId        String
  title           String
  description     String?
  order           Int
  durationSeconds Int      @default(0)
  mediaAssetId    String?  @unique
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  course         Course           @relation(fields: [courseId], references: [id], onDelete: Cascade)
  mediaAsset     MediaAsset?      @relation(fields: [mediaAssetId], references: [id])
  quizzes        Quiz[]
  lessonProgress LessonProgress[]

  @@unique([courseId, order])
  @@index([courseId])
}
```

- [x] **Step 3.6: Add session and chat schema**

Create `backend/prisma/models/session.prisma`:

```prisma
enum SessionStatus {
  SCHEDULED
  LIVE
  ENDED
  CANCELLED
}

model Session {
  id        String        @id @default(uuid())
  courseId  String
  title     String
  startsAt  DateTime
  endsAt    DateTime?
  status    SessionStatus @default(SCHEDULED)
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt

  course       Course        @relation(fields: [courseId], references: [id], onDelete: Cascade)
  chatMessages ChatMessage[]
  quizRuns     QuizRun[]

  @@index([courseId])
  @@index([status])
}

model ChatMessage {
  id        String   @id @default(uuid())
  sessionId String
  userId    String
  content   String
  createdAt DateTime @default(now())

  session Session @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([sessionId, createdAt])
}
```

- [x] **Step 3.7: Add quiz schema**

Create `backend/prisma/models/quiz.prisma`:

```prisma
enum QuizRunStatus {
  PENDING
  OPEN
  CLOSED
  REVEALED
  FINISHED
}

model Quiz {
  id        String   @id @default(uuid())
  lessonId  String
  title     String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  lesson    Lesson     @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  questions Question[]
  quizRuns  QuizRun[]

  @@index([lessonId])
}

model Question {
  id              String @id @default(uuid())
  quizId          String
  text            String
  options         Json
  correctOptionId String
  order           Int

  quiz        Quiz         @relation(fields: [quizId], references: [id], onDelete: Cascade)
  quizAnswers QuizAnswer[]

  @@unique([quizId, order])
}

model QuizRun {
  id                   String        @id @default(uuid())
  quizId               String
  sessionId            String
  currentQuestionIndex Int?
  status               QuizRunStatus @default(PENDING)
  questionOpenedAt     DateTime?
  createdAt            DateTime      @default(now())
  updatedAt            DateTime      @updatedAt

  quiz    Quiz         @relation(fields: [quizId], references: [id], onDelete: Cascade)
  session Session      @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  answers QuizAnswer[]

  @@index([sessionId])
  @@index([status])
}

model QuizAnswer {
  id               String   @id @default(uuid())
  runId            String
  questionId       String
  userId           String
  selectedOptionId String
  isCorrect        Boolean
  score            Int
  answeredAt       DateTime @default(now())

  run      QuizRun  @relation(fields: [runId], references: [id], onDelete: Cascade)
  question Question @relation(fields: [questionId], references: [id], onDelete: Cascade)
  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([runId, questionId, userId])
  @@index([runId])
  @@index([userId])
}
```

- [x] **Step 3.8: Add media, progress, and notification schema**

Create `backend/prisma/models/media.prisma`:

```prisma
enum MediaAssetStatus {
  PENDING
  UPLOADED
}

model MediaAsset {
  id          String           @id @default(uuid())
  key         String           @unique
  fileName    String
  contentType String
  sizeBytes   BigInt
  status      MediaAssetStatus @default(PENDING)
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt

  lesson Lesson?
}
```

Create `backend/prisma/models/progress.prisma`:

```prisma
model LessonProgress {
  id              String    @id @default(uuid())
  userId          String
  lessonId        String
  positionSeconds Int       @default(0)
  lastWatchedAt   DateTime  @default(now())
  completedAt     DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  lesson Lesson @relation(fields: [lessonId], references: [id], onDelete: Cascade)

  @@unique([userId, lessonId])
  @@index([lessonId])
}
```

Create `backend/prisma/models/notification.prisma`:

```prisma
model Notification {
  id        String    @id @default(uuid())
  userId    String
  type      String
  title     String
  body      String
  readAt    DateTime?
  createdAt DateTime  @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, readAt])
}
```

- [x] **Step 3.9: Add Prisma service and module**

Create `backend/src/prisma/prisma.service.ts`:

```ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
```

Create `backend/src/prisma/prisma.module.ts`:

```ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

Modify `backend/src/app.module.ts`:

```ts
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, HealthModule],
})
export class AppModule {}
```

- [x] **Step 3.10: Add DB test helper**

Create `backend/test/helpers/db.ts`:

```ts
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export async function cleanDatabase(): Promise<void> {
  await prisma.quizAnswer.deleteMany();
  await prisma.quizRun.deleteMany();
  await prisma.question.deleteMany();
  await prisma.quiz.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.session.deleteMany();
  await prisma.lessonProgress.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.mediaAsset.deleteMany();
  await prisma.course.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.user.deleteMany();
}
```

- [x] **Step 3.11: Generate Prisma client**

Run from `backend/`:

```bash
npm.cmd run db:generate --workspace=backend
```

Expected: Prisma client generated with all models.

- [x] **Step 3.12: Create migration**

Run infra if needed:

```bash
npm.cmd run infra:up
npm.cmd run db:migrate --workspace=backend -- --name p2_backend_core
```

Expected: migration created under `backend/prisma/migrations/*_p2_backend_core` and applied to local Postgres.

- [x] **Step 3.13: Verify backend build**

Run: `npm.cmd run build:backend`

Expected: exit code 0.

- [x] **Step 3.14: Commit**

```bash
git add backend/prisma backend/src/prisma backend/src/app.module.ts backend/package.json package-lock.json
git commit -m "feat(backend): add prisma schema and service"
```

---

### Task 4: Auth Module with Refresh Rotation

**Files:**
- Create: `backend/src/modules/auth/dto/register.dto.ts`
- Create: `backend/src/modules/auth/dto/login.dto.ts`
- Create: `backend/src/modules/auth/dto/refresh.dto.ts`
- Create: `backend/src/modules/auth/auth.service.ts`
- Create: `backend/src/modules/auth/auth.controller.ts`
- Create: `backend/src/modules/auth/auth.module.ts`
- Create: `backend/src/modules/auth/jwt.strategy.ts`
- Create: `backend/src/common/types/authenticated-request.ts`
- Create: `backend/src/common/decorators/current-user.decorator.ts`
- Create: `backend/src/common/guards/jwt-auth.guard.ts`
- Modify: `backend/src/app.module.ts`
- Create: `backend/test/auth.e2e-spec.ts`
- Create: `backend/test/helpers/auth.ts`

**Interfaces:**
- Produces: `POST /api/auth/register`, `/login`, `/refresh`, `/logout`.
- Produces: `JwtAuthGuard` and `@CurrentUser()` for later modules.
- Consumes: `PrismaService`, `AppError`, shared auth types.

- [x] **Step 4.1: Write auth e2e tests**

Create `backend/test/auth.e2e-spec.ts` with these cases:

```ts
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import { cleanDatabase, prisma } from './helpers/db';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('registers a student and returns tokens without passwordHash', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'student@example.com', password: 'Password123!', name: 'Student One' })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.refreshToken).toEqual(expect.any(String));
    expect(res.body.data.user).toMatchObject({
      email: 'student@example.com',
      name: 'Student One',
      role: 'STUDENT',
    });
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it('rejects invalid credentials', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'missing@example.com', password: 'Password123!' })
      .expect(401)
      .expect((res) => {
        expect(res.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
      });
  });

  it('rotates refresh tokens and rejects reuse', async () => {
    const registered = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'reuse@example.com', password: 'Password123!', name: 'Reuse User' })
      .expect(201);

    const oldRefresh = registered.body.data.refreshToken;
    const refreshed = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: oldRefresh })
      .expect(201);

    expect(refreshed.body.data.refreshToken).not.toBe(oldRefresh);

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: oldRefresh })
      .expect(401)
      .expect((res) => {
        expect(res.body.error.code).toBe('AUTH_REFRESH_REUSED');
      });

    const activeTokens = await prisma.refreshToken.findMany({ where: { revokedAt: null } });
    expect(activeTokens).toHaveLength(0);
  });
});
```

- [x] **Step 4.2: Run auth tests to verify failure**

Run: `npm.cmd run test:e2e --workspace=backend -- auth.e2e-spec.ts`

Expected: FAIL because `/api/auth/register` does not exist.

- [x] **Step 4.3: Add auth DTOs**

Use class-validator:

```ts
// register.dto.ts
import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @MinLength(2)
  name!: string;
}
```

`LoginDto` has `email` and `password`. `RefreshDto` has `refreshToken: string`.

- [x] **Step 4.4: Add JWT request types, decorator, and guard**

Create `backend/src/common/types/authenticated-request.ts`:

```ts
import type { Request } from 'express';
import type { UserRole } from '@lms/shared';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
```

Create `current-user.decorator.ts`:

```ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../types/authenticated-request';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    return ctx.switchToHttp().getRequest().user;
  },
);
```

Create `jwt-auth.guard.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

- [x] **Step 4.5: Implement AuthService**

Required methods:

```ts
register(dto: RegisterDto): Promise<AuthTokensResponse>
login(dto: LoginDto): Promise<AuthTokensResponse>
refresh(refreshToken: string): Promise<AuthTokensResponse>
logout(userId: string, refreshToken: string): Promise<{ revoked: true }>
```

Implementation rules:

```ts
private async issueTokenPair(user: User): Promise<AuthTokensResponse> {
  const accessToken = await this.jwtService.signAsync(
    { sub: user.id, email: user.email, role: user.role },
    { secret: env.JWT_ACCESS_SECRET, expiresIn: env.JWT_ACCESS_EXPIRES_IN },
  );
  const refreshToken = randomBytes(48).toString('base64url');
  const tokenHash = await bcrypt.hash(refreshToken, 12);
  const expiresAt = new Date(
    Date.now() + env.JWT_REFRESH_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000,
  );
  await this.prisma.refreshToken.create({ data: { userId: user.id, tokenHash, expiresAt } });
  return { accessToken, refreshToken, user: this.toAuthUser(user) };
}
```

For refresh validation, fetch non-expired tokens by user only after decoding or scan non-expired tokens and compare with `bcrypt.compare`. Because dev scale is small, use:

```ts
const candidates = await this.prisma.refreshToken.findMany({
  where: { expiresAt: { gt: new Date() } },
  include: { user: true },
});
const matched = await this.findMatchingRefreshToken(refreshToken, candidates);
```

If `matched.revokedAt` is not null:

```ts
await this.prisma.refreshToken.updateMany({
  where: { userId: matched.userId, revokedAt: null },
  data: { revokedAt: new Date() },
});
throw new AppError('AUTH_REFRESH_REUSED', 'Refresh token da bi thu hoi', HttpStatus.UNAUTHORIZED);
```

If active, rotate inside transaction:

```ts
await this.prisma.refreshToken.update({
  where: { id: matched.id },
  data: { revokedAt: now },
});
return this.issueTokenPair(matched.user);
```

- [x] **Step 4.6: Implement JwtStrategy**

Create strategy that validates access token payload:

```ts
async validate(payload: { sub: string; email: string; role: UserRole }): Promise<AuthenticatedUser> {
  return { id: payload.sub, email: payload.email, role: payload.role };
}
```

- [x] **Step 4.7: Implement AuthController and module**

Controller routes:

```ts
@Post('register')
register(@Body() dto: RegisterDto)

@Post('login')
login(@Body() dto: LoginDto)

@Post('refresh')
refresh(@Body() dto: RefreshDto)

@UseGuards(JwtAuthGuard)
@Post('logout')
logout(@CurrentUser() user: AuthenticatedUser, @Body() dto: RefreshDto)
```

Module imports: `JwtModule.register({})`, `PassportModule`.

- [x] **Step 4.8: Add auth test helper**

Create `backend/test/helpers/auth.ts`:

```ts
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';

export async function registerAndLogin(
  app: INestApplication,
  role: 'ADMIN' | 'INSTRUCTOR' | 'STUDENT' = 'STUDENT',
): Promise<{ accessToken: string; refreshToken: string; userId: string }> {
  const email = `${role.toLowerCase()}-${Date.now()}-${Math.random()}@example.com`;
  const registered = await request(app.getHttpServer())
    .post('/api/auth/register')
    .send({ email, password: 'Password123!', name: `${role} User` })
    .expect(201);

  if (role !== 'STUDENT') {
    await import('./db').then(({ prisma }) =>
      prisma.user.update({ where: { id: registered.body.data.user.id }, data: { role } }),
    );
  }

  const loggedIn = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password: 'Password123!' })
    .expect(201);

  return {
    accessToken: loggedIn.body.data.accessToken,
    refreshToken: loggedIn.body.data.refreshToken,
    userId: registered.body.data.user.id,
  };
}
```

- [x] **Step 4.9: Register AuthModule**

Modify `backend/src/app.module.ts` imports: `AuthModule`.

- [x] **Step 4.10: Verify auth tests pass**

Run: `npm.cmd run test:e2e --workspace=backend -- auth.e2e-spec.ts`

Expected: 3 tests pass.

- [x] **Step 4.11: Commit**

```bash
git add backend/src backend/test backend/package.json package-lock.json
git commit -m "feat(auth): add jwt auth with refresh rotation"
```

---

### Task 5: Users Module and Role Guards

**Files:**
- Create: `backend/src/common/decorators/roles.decorator.ts`
- Create: `backend/src/common/guards/roles.guard.ts`
- Create: `backend/src/modules/users/dto/update-me.dto.ts`
- Create: `backend/src/modules/users/dto/list-users-query.dto.ts`
- Create: `backend/src/modules/users/users.service.ts`
- Create: `backend/src/modules/users/users.controller.ts`
- Create: `backend/src/modules/users/users.module.ts`
- Modify: `backend/src/app.module.ts`
- Create: `backend/test/users.e2e-spec.ts`

**Interfaces:**
- Produces: `GET /api/users/me`, `PATCH /api/users/me`, `GET /api/users`, `PATCH /api/users/:id`, `DELETE /api/users/:id`.
- Produces: `RolesGuard` and `@Roles(...roles)`.
- Consumes: `JwtAuthGuard`, `PrismaService`.

- [x] **Step 5.1: Write users e2e tests**

Create tests for:

```ts
it('returns current user via GET /api/users/me')
it('updates current user name via PATCH /api/users/me')
it('forbids student from GET /api/users')
it('allows admin to list users with pagination meta')
```

Expected assertion for forbidden:

```ts
expect(res.body.error.code).toBe('AUTH_FORBIDDEN');
```

- [x] **Step 5.2: Run users tests to verify failure**

Run: `npm.cmd run test:e2e --workspace=backend -- users.e2e-spec.ts`

Expected: FAIL because users routes do not exist.

- [x] **Step 5.3: Add Roles decorator and guard**

`roles.decorator.ts`:

```ts
import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@lms/shared';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
```

`roles.guard.ts`:

```ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@lms/shared';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;
    const user = context.switchToHttp().getRequest().user;
    return Boolean(user && required.includes(user.role));
  }
}
```

- [x] **Step 5.4: Implement UsersService**

Methods:

```ts
findMe(userId: string)
updateMe(userId: string, dto: UpdateMeDto)
listUsers(query: ListUsersQueryDto)
updateUser(id: string, dto: UpdateUserDto)
deleteUser(id: string)
```

Always select:

```ts
const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
  updatedAt: true,
};
```

- [x] **Step 5.5: Implement UsersController**

Use:

```ts
@UseGuards(JwtAuthGuard)
@Controller('users')
```

Admin routes:

```ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Get()
```

- [x] **Step 5.6: Register UsersModule**

Modify `backend/src/app.module.ts` imports: `UsersModule`.

- [x] **Step 5.7: Verify users tests pass**

Run: `npm.cmd run test:e2e --workspace=backend -- users.e2e-spec.ts`

Expected: all tests pass.

- [x] **Step 5.8: Commit**

```bash
git add backend/src backend/test
git commit -m "feat(users): add profile and admin user APIs"
```

---

### Task 6: Courses and Enrollments

**Files:**
- Create: `backend/src/modules/courses/dto/create-course.dto.ts`
- Create: `backend/src/modules/courses/dto/update-course.dto.ts`
- Create: `backend/src/modules/courses/dto/list-courses-query.dto.ts`
- Create: `backend/src/modules/courses/courses.service.ts`
- Create: `backend/src/modules/courses/courses.controller.ts`
- Create: `backend/src/modules/courses/courses.module.ts`
- Create: `backend/src/modules/enrollments/enrollments.service.ts`
- Create: `backend/src/modules/enrollments/enrollments.controller.ts`
- Create: `backend/src/modules/enrollments/enrollments.module.ts`
- Modify: `backend/src/app.module.ts`
- Create: `backend/test/courses.e2e-spec.ts`

**Interfaces:**
- Produces: public `GET /api/courses`, `GET /api/courses/:id`.
- Produces: instructor/admin course create/update/delete/publish/unpublish.
- Produces: student self-enrollment routes.
- Consumes: `RolesGuard`, `CurrentUser`, `PrismaService`.

- [x] **Step 6.1: Write courses e2e tests**

Cover:

```ts
it('allows instructor to create a draft course')
it('rejects duplicate slug with COURSE_SLUG_TAKEN')
it('publishes and unpublishes a course')
it('allows student to enroll only in published courses')
it('rejects duplicate enrollment with ENROLL_ALREADY')
```

- [x] **Step 6.2: Run courses tests to verify failure**

Run: `npm.cmd run test:e2e --workspace=backend -- courses.e2e-spec.ts`

Expected: FAIL because routes do not exist.

- [x] **Step 6.3: Add course DTOs**

`CreateCourseDto`:

```ts
title: string min 3
slug: string min 3 matches /^[a-z0-9]+(?:-[a-z0-9]+)*$/
description?: string
```

`ListCoursesQueryDto`:

```ts
status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
keyword?: string
page?: number default 1
limit?: number default 20 max 100
```

- [x] **Step 6.4: Implement CoursesService**

Required methods:

```ts
create(instructorId: string, dto: CreateCourseDto)
findMany(query: ListCoursesQueryDto)
findOne(id: string)
update(id: string, actor: AuthenticatedUser, dto: UpdateCourseDto)
remove(id: string, actor: AuthenticatedUser)
publish(id: string, actor: AuthenticatedUser)
unpublish(id: string, actor: AuthenticatedUser)
```

Duplicate slug handling:

```ts
catch (error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new AppError('COURSE_SLUG_TAKEN', 'Slug khoa hoc da ton tai', HttpStatus.CONFLICT);
  }
  throw error;
}
```

Instructor ownership rule:

```ts
if (actor.role !== 'ADMIN' && course.instructorId !== actor.id) {
  throw new AppError('AUTH_FORBIDDEN', 'Khong co quyen thao tac khoa hoc nay', HttpStatus.FORBIDDEN);
}
```

- [x] **Step 6.5: Implement EnrollmentsService**

Required methods:

```ts
enroll(courseId: string, userId: string)
unenroll(courseId: string, userId: string)
listCourseEnrollments(courseId: string, actor: AuthenticatedUser)
listMyEnrollments(userId: string)
```

Rules:

```ts
if (course.status !== 'PUBLISHED') {
  throw new AppError('COURSE_NOT_PUBLISHED', 'Chi co the ghi danh khoa da publish', HttpStatus.BAD_REQUEST);
}
```

Map unique `(userId, courseId)` to `ENROLL_ALREADY`.

- [x] **Step 6.6: Implement controllers and register modules**

Routes:

```text
GET    /api/courses
POST   /api/courses
GET    /api/courses/:id
PATCH  /api/courses/:id
DELETE /api/courses/:id
POST   /api/courses/:id/publish
POST   /api/courses/:id/unpublish
POST   /api/courses/:courseId/enroll
DELETE /api/courses/:courseId/enroll
GET    /api/courses/:courseId/enrollments
GET    /api/me/enrollments
```

- [x] **Step 6.7: Verify courses tests pass**

Run: `npm.cmd run test:e2e --workspace=backend -- courses.e2e-spec.ts`

Expected: all tests pass.

- [x] **Step 6.8: Commit**

```bash
git add backend/src backend/test
git commit -m "feat(courses): add course publishing and enrollment APIs"
```

---

### Task 7: Lessons CRUD and Reorder

**Files:**
- Create: `backend/src/modules/lessons/dto/create-lesson.dto.ts`
- Create: `backend/src/modules/lessons/dto/update-lesson.dto.ts`
- Create: `backend/src/modules/lessons/dto/reorder-lessons.dto.ts`
- Create: `backend/src/modules/lessons/lessons.service.ts`
- Create: `backend/src/modules/lessons/lessons.controller.ts`
- Create: `backend/src/modules/lessons/lessons.module.ts`
- Modify: `backend/src/app.module.ts`
- Create: `backend/test/lessons.e2e-spec.ts`

**Interfaces:**
- Produces: `POST /api/courses/:courseId/lessons`, `GET /api/courses/:courseId/lessons`, `PATCH /api/lessons/:id`, `DELETE /api/lessons/:id`, `PATCH /api/courses/:courseId/lessons/reorder`.
- Consumes: `CoursesService` ownership pattern, `PrismaService`.

- [x] **Step 7.1: Write lessons e2e tests**

Cover:

```ts
it('allows course instructor to create lessons with sequential order')
it('lists lessons ordered by order asc')
it('reorders lessons atomically')
it('forbids another instructor from editing a lesson')
```

- [x] **Step 7.2: Run lessons tests to verify failure**

Run: `npm.cmd run test:e2e --workspace=backend -- lessons.e2e-spec.ts`

Expected: FAIL because routes do not exist.

- [x] **Step 7.3: Add lesson DTOs**

`CreateLessonDto`:

```ts
title: string min 3
description?: string
durationSeconds: number min 0 default 0
mediaAssetId?: string
```

`ReorderLessonsDto`:

```ts
items: { id: string; order: number }[]
```

- [x] **Step 7.4: Implement LessonsService**

Rules:

```ts
const max = await prisma.lesson.aggregate({
  where: { courseId },
  _max: { order: true },
});
const nextOrder = (max._max.order ?? 0) + 1;
```

If `mediaAssetId` is present, fetch the asset and require `status === 'UPLOADED'`; otherwise throw `LESSON_MEDIA_NOT_READY`.

Reorder in a transaction:

```ts
await this.prisma.$transaction(
  dto.items.map((item) =>
    this.prisma.lesson.update({
      where: { id: item.id },
      data: { order: item.order },
    }),
  ),
);
```

Before transaction, verify every item belongs to `courseId`.

- [x] **Step 7.5: Implement LessonsController and register module**

Use instructor/admin guard on create/update/delete/reorder. Allow public `GET /courses/:courseId/lessons`.

- [x] **Step 7.6: Verify lessons tests pass**

Run: `npm.cmd run test:e2e --workspace=backend -- lessons.e2e-spec.ts`

Expected: all tests pass.

- [x] **Step 7.7: Commit**

```bash
git add backend/src backend/test
git commit -m "feat(lessons): add lesson CRUD and reorder"
```

---

### Task 8: Sessions REST Module

**Files:**
- Create: `backend/src/modules/sessions/dto/create-session.dto.ts`
- Create: `backend/src/modules/sessions/dto/update-session.dto.ts`
- Create: `backend/src/modules/sessions/sessions.service.ts`
- Create: `backend/src/modules/sessions/sessions.controller.ts`
- Create: `backend/src/modules/sessions/sessions.module.ts`
- Modify: `backend/src/app.module.ts`
- Create: `backend/test/sessions-quizzes.e2e-spec.ts`

**Interfaces:**
- Produces: `POST /api/courses/:courseId/sessions`, `PATCH /api/sessions/:id`, `DELETE /api/sessions/:id`, `POST /api/sessions/:id/start`, `POST /api/sessions/:id/end`, `GET /api/sessions/:id/state`.
- Consumes: `SessionStatus`.

- [x] **Step 8.1: Write sessions tests**

Cover:

```ts
it('allows instructor to create a scheduled session')
it('starts a scheduled session and returns LIVE status')
it('ends a live session and returns ENDED status with endsAt')
it('returns session state with participantCount 0 in P2')
```

- [x] **Step 8.2: Run sessions tests to verify failure**

Run: `npm.cmd run test:e2e --workspace=backend -- sessions-quizzes.e2e-spec.ts`

Expected: FAIL because session routes do not exist.

- [x] **Step 8.3: Add session DTOs**

`CreateSessionDto`:

```ts
title: string min 3
startsAt: ISO date string
```

`UpdateSessionDto`:

```ts
title?: string min 3
startsAt?: ISO date string
status?: 'SCHEDULED' | 'CANCELLED'
```

- [x] **Step 8.4: Implement SessionsService**

State transitions:

```ts
start(id): SCHEDULED -> LIVE
end(id): LIVE -> ENDED with endsAt = now
cancel/update status: only SCHEDULED -> CANCELLED
```

Invalid transition:

```ts
throw new AppError('CONFLICT', 'Trang thai session khong hop le', HttpStatus.CONFLICT);
```

`getState(id)` returns:

```ts
{
  id,
  status,
  participantCount: 0,
}
```

- [x] **Step 8.5: Implement controller and register module**

All write routes require instructor/admin ownership. `GET /sessions/:id/state` requires authenticated enrolled user or course instructor/admin. In P2, implement this by allowing admin/instructor and enrolled students through Prisma checks.

- [x] **Step 8.6: Verify sessions tests pass**

Run: `npm.cmd run test:e2e --workspace=backend -- sessions-quizzes.e2e-spec.ts`

Expected: session tests pass; quiz tests are added in Task 9.

- [x] **Step 8.7: Commit**

```bash
git add backend/src backend/test
git commit -m "feat(sessions): add live session REST state"
```

---

### Task 9: Quizzes and QuizRun Core

**Files:**
- Create: `backend/src/modules/quizzes/dto/create-quiz.dto.ts`
- Create: `backend/src/modules/quizzes/dto/update-quiz.dto.ts`
- Create: `backend/src/modules/quizzes/dto/create-quiz-run.dto.ts`
- Create: `backend/src/modules/quizzes/quizzes.service.ts`
- Create: `backend/src/modules/quizzes/quizzes.controller.ts`
- Create: `backend/src/modules/quizzes/quizzes.module.ts`
- Modify: `backend/src/app.module.ts`
- Modify: `backend/test/sessions-quizzes.e2e-spec.ts`

**Interfaces:**
- Produces: `POST /api/lessons/:lessonId/quizzes`, `PATCH /api/quizzes/:id`, `DELETE /api/quizzes/:id`.
- Produces: `POST /api/sessions/:sessionId/quiz-runs`, `GET /api/quiz-runs/:id/state`.
- Leaves `questions/next`, `close`, `reveal`, `finish`, WS answer flow, scoring, and Redis leaderboard for P3.

- [x] **Step 9.1: Add quiz e2e tests**

Append to `sessions-quizzes.e2e-spec.ts`:

```ts
it('allows instructor to create a quiz with questions')
it('creates a quiz run for a session in PENDING status')
it('returns quiz run state without correctOptionId')
```

For the state assertion:

```ts
expect(JSON.stringify(res.body.data)).not.toContain('correctOptionId');
```

- [x] **Step 9.2: Run quiz tests to verify failure**

Run: `npm.cmd run test:e2e --workspace=backend -- sessions-quizzes.e2e-spec.ts`

Expected: FAIL because quiz routes do not exist.

- [x] **Step 9.3: Add quiz DTOs**

`CreateQuizDto`:

```ts
title: string min 3
questions: {
  text: string min 1
  options: { id: string; text: string }[] min 2
  correctOptionId: string
}[] min 1
```

Validation rule in service: every `correctOptionId` must match one option id in that question.

- [x] **Step 9.4: Implement QuizzesService**

Create quiz transaction:

```ts
return this.prisma.quiz.create({
  data: {
    lessonId,
    title: dto.title,
    questions: {
      create: dto.questions.map((question, index) => ({
        text: question.text,
        options: question.options,
        correctOptionId: question.correctOptionId,
        order: index + 1,
      })),
    },
  },
  include: { questions: { orderBy: { order: 'asc' } } },
});
```

Create quiz run:

```ts
return this.prisma.quizRun.create({
  data: { quizId: dto.quizId, sessionId },
});
```

State response must include current question without correct answer:

```ts
const question = run.currentQuestionIndex
  ? run.quiz.questions[run.currentQuestionIndex - 1]
  : null;

return {
  id: run.id,
  status: run.status,
  currentQuestionIndex: run.currentQuestionIndex,
  question: question
    ? { id: question.id, text: question.text, options: question.options }
    : null,
};
```

- [x] **Step 9.5: Implement QuizzesController and register module**

Routes:

```text
POST   /api/lessons/:lessonId/quizzes
PATCH  /api/quizzes/:id
DELETE /api/quizzes/:id
POST   /api/sessions/:sessionId/quiz-runs
GET    /api/quiz-runs/:id/state
```

Instructor/admin ownership checks follow course ownership through lesson/session relations.

- [x] **Step 9.6: Verify sessions and quiz tests pass**

Run: `npm.cmd run test:e2e --workspace=backend -- sessions-quizzes.e2e-spec.ts`

Expected: all tests pass.

- [x] **Step 9.7: Commit**

```bash
git add backend/src backend/test
git commit -m "feat(quizzes): add quiz and quiz run core APIs"
```

---

### Task 10: Seed Data and P2 Final Verification

**Files:**
- Create: `backend/prisma/seed.ts`
- Modify: `README.md`
- Modify: `backend/package.json`

**Interfaces:**
- Produces: sample users, courses, lessons, sessions, quiz data for manual P2 verification.
- Consumes: Prisma schema and auth password hashing.

- [x] **Step 10.1: Add seed script**

Create `backend/prisma/seed.ts` with:

```ts
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.quizAnswer.deleteMany();
  await prisma.quizRun.deleteMany();
  await prisma.question.deleteMany();
  await prisma.quiz.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.session.deleteMany();
  await prisma.lessonProgress.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.mediaAsset.deleteMany();
  await prisma.course.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash('Password123!', 12);

  const admin = await prisma.user.create({
    data: { email: 'admin@example.com', name: 'Admin', passwordHash, role: 'ADMIN' },
  });
  const instructor = await prisma.user.create({
    data: { email: 'instructor@example.com', name: 'Instructor', passwordHash, role: 'INSTRUCTOR' },
  });
  const student = await prisma.user.create({
    data: { email: 'student@example.com', name: 'Student', passwordHash, role: 'STUDENT' },
  });

  const course = await prisma.course.create({
    data: {
      title: 'Realtime LMS Foundations',
      slug: 'realtime-lms-foundations',
      description: 'Seed course for local P2 testing',
      status: 'PUBLISHED',
      instructorId: instructor.id,
      publishedAt: new Date(),
    },
  });

  const lesson = await prisma.lesson.create({
    data: {
      courseId: course.id,
      title: 'Intro lesson',
      description: 'First seed lesson',
      order: 1,
      durationSeconds: 600,
    },
  });

  const session = await prisma.session.create({
    data: {
      courseId: course.id,
      title: 'Live intro session',
      startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: 'SCHEDULED',
    },
  });

  await prisma.enrollment.create({ data: { courseId: course.id, userId: student.id } });

  const quiz = await prisma.quiz.create({
    data: {
      lessonId: lesson.id,
      title: 'Intro quiz',
      questions: {
        create: [
          {
            text: 'Which service stores relational LMS data?',
            options: [
              { id: 'a', text: 'PostgreSQL' },
              { id: 'b', text: 'Redis' },
            ],
            correctOptionId: 'a',
            order: 1,
          },
        ],
      },
    },
  });

  await prisma.quizRun.create({ data: { quizId: quiz.id, sessionId: session.id } });

  console.log({ admin: admin.email, instructor: instructor.email, student: student.email });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    process.exit(1);
  });
```

- [x] **Step 10.2: Update README P2 quickstart**

Add:

```bash
npm.cmd run infra:up
npm.cmd run db:migrate --workspace=backend
npm.cmd run db:seed --workspace=backend
npm.cmd run dev:backend
```

Document seed credentials:

```text
admin@example.com / Password123!
instructor@example.com / Password123!
student@example.com / Password123!
```

- [x] **Step 10.3: Run all backend e2e tests**

Run: `npm.cmd run test:e2e --workspace=backend`

Expected:

```text
PASS test/app.e2e-spec.ts
PASS test/auth.e2e-spec.ts
PASS test/users.e2e-spec.ts
PASS test/courses.e2e-spec.ts
PASS test/lessons.e2e-spec.ts
PASS test/sessions-quizzes.e2e-spec.ts
```

- [x] **Step 10.4: Run builds and frontend smoke test**

Run:

```bash
npm.cmd run build:backend
npm.cmd run build:frontend
npm.cmd run test:frontend
```

Expected: all commands exit 0.

- [x] **Step 10.5: Manual local API smoke**

Run backend:

```bash
npm.cmd run dev:backend
```

In another terminal:

```bash
curl -s http://localhost:4000/api/health
curl -s -X POST http://localhost:4000/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"student@example.com\",\"password\":\"Password123!\"}"
```

Expected: both responses have `"success":true`.

- [x] **Step 10.6: Commit**

```bash
git add backend/prisma/seed.ts README.md backend/package.json
git commit -m "chore(seed): add backend core seed data"
```

---

## P2 Acceptance Checklist

- [x] Prisma multi-file schema loads every model and generates Prisma Client.
- [x] Local migration applies to Postgres from `docker-compose.infra.yml`.
- [x] `/api/health` returns existing health envelope.
- [x] Auth register/login/refresh/logout works.
- [x] Refresh rotation revokes old token and reuse revokes all active tokens for that user.
- [x] Role guard blocks student access to admin/instructor routes.
- [x] Users profile and admin list endpoints work.
- [x] Course create/update/delete/publish/unpublish works.
- [x] Enrollment only allows published courses and blocks duplicates.
- [x] Lesson create/list/update/delete/reorder works.
- [x] Session create/update/start/end/state works.
- [x] Quiz create/update/delete and QuizRun create/state works without exposing `correctOptionId`.
- [x] Backend e2e tests pass.
- [x] Backend and frontend builds pass.
- [x] Frontend smoke tests pass.

## Out of Scope for P2

- Socket.IO namespaces and gateways.
- Redis adapter.
- BullMQ processors.
- Quiz answer submission, scoring, leaderboard, and reveal flow.
- MinIO presigned upload endpoints.
- Lesson progress heartbeat and debounced persistence.
- Brevo email and notifications worker.
- Frontend auth/course UI.
- Production Docker images and GitHub Actions.

## Self-Review

- [x] **Spec coverage:** P2 spec items are covered: Prisma multi-file schema, Session/QuizRun entities, Auth with refresh rotation and reuse detection, User/Course/Lesson CRUD. Enrollments and Quiz CRUD are included because the P2 APIs need them to make courses/sessions/quiz runs testable.
- [x] **Scope control:** P3 realtime/async, P4 frontend, and P5 Docker/CI work are explicitly excluded.
- [x] **Placeholder scan:** No deferred implementation markers remain. Each behavior-bearing task has tests, implementation interfaces, verify commands, and a commit.
- [x] **Type consistency:** Shared `UserRole`, `CourseStatus`, `SessionStatus`, and `QuizRunStatus` names match Prisma enum values and controller/service expectations.
- [x] **API prefix consistency:** P2 moves backend routes to `/api/*` and updates Vite proxy to stop stripping `/api`.
- [x] **Prisma compatibility:** Plan uses `backend/prisma/schema.prisma` plus `backend/prisma/models/*.prisma`, with `backend/prisma.config.ts` pointing at the `prisma` directory.

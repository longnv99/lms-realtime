# LMS Realtime P3 Backend Realtime & Async Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build visible REST API documentation plus the backend realtime and async core for LMS Realtime: Swagger UI, Socket.IO auth, session chat/presence, quiz control/answers/scoring/leaderboard, and course-published notifications via BullMQ.

**Architecture:** Keep the NestJS modular monolith from P2. Add a shared realtime contract package surface in `@lms/shared`, a global Redis module, a Redis-backed Socket.IO adapter, feature gateways for `/sessions`, `/quiz`, `/notifications`, and an inline BullMQ worker for notification jobs. REST keeps the `/api` prefix and response envelope; Socket.IO events use typed payloads and room conventions from the design spec.

**Tech Stack:** NestJS 10, TypeScript strict mode, Prisma ORM 7, PostgreSQL 16, Redis 7, Swagger via `@nestjs/swagger`, Socket.IO, `@socket.io/redis-adapter`, `ioredis`, BullMQ via `@nestjs/bullmq`, Jest + Supertest + `socket.io-client`.

**Spec:** `docs/superpowers/specs/2026-08-26-lms-realtime-design.md`

## Global Constraints

- Backend dev port is `4000`; frontend dev port is `5173`; Postgres is `5432`; Redis is `6379`; MinIO is `9000/9001`.
- REST uses prefix `/api` and response envelope `{ success, data, error, meta }`.
- Swagger UI is served at `/api/docs`; OpenAPI JSON is served at `/api/docs-json`.
- Socket.IO auth token comes from `handshake.auth.token`.
- Shared package `@lms/shared` is the single source of truth for Socket.IO event payloads.
- Socket.IO namespaces: `/sessions`, `/quiz`, `/notifications`.
- Room convention: `/sessions` -> `session:<sessionId>`; `/quiz` -> `quiz-run:<quizRunId>`; `/notifications` -> `user:<userId>`.
- Server emits through rooms; do not emit directly to saved socket IDs.
- Keep RabbitMQ out of the project. BullMQ uses Redis.
- BullMQ workers run inline in the same NestJS process.
- Quiz answers go through Socket.IO, not REST.
- Quiz question payloads must never include `correctOptionId` before reveal.
- Quiz score formula: `score = (isCorrect ? 100 : 0) + max(0, 50 - Math.floor(elapsedSeconds))`, but wrong answers always score `0`.
- Refresh tokens and auth behavior from P2 stay unchanged.
- MinIO upload endpoints and lesson progress heartbeat are out of this plan; create a follow-up P3b/P4-support plan for those.

---

## File Structure

P3 creates or modifies these areas:

```text
backend/
  package.json
  .env.example
  nest-cli.json
  src/
    app.module.ts
    main.ts
    swagger.ts
    config/env.ts
    common/
      realtime/
        redis-io.adapter.ts
        ws-auth.service.ts
        ws-exception.filter.ts
        ws-validation.pipe.ts
    redis/
      redis.module.ts
      redis.service.ts
    queue/
      queue.module.ts
      queue.constants.ts
    modules/
      sessions/
        dto/session-join.dto.ts
        dto/chat-send.dto.ts
        sessions.gateway.ts
        sessions.realtime.service.ts
        sessions.service.ts
      quizzes/
        dto/quiz-join.dto.ts
        dto/quiz-answer.dto.ts
        quizzes.gateway.ts
        quizzes.realtime.service.ts
        quizzes.service.ts
        quiz-scoring.service.ts
      notifications/
        notifications.controller.ts
        notifications.gateway.ts
        notifications.module.ts
        notifications.processor.ts
        notifications.producer.ts
        notifications.service.ts
  test/
    helpers/ws-app.ts
    helpers/socket.ts
    swagger.e2e-spec.ts
    sessions-realtime.e2e-spec.ts
    quizzes-realtime.e2e-spec.ts
    notifications.e2e-spec.ts

shared/
  src/
    realtime.ts
    notifications.ts
    index.ts
```

---

### Task 1: Backend Swagger API Documentation

**Files:**
- Modify: `backend/package.json`
- Modify: `backend/nest-cli.json`
- Create: `backend/src/swagger.ts`
- Modify: `backend/src/main.ts`
- Modify: `backend/src/modules/auth/auth.controller.ts`
- Modify: `backend/src/modules/users/users.controller.ts`
- Modify: `backend/src/modules/courses/courses.controller.ts`
- Modify: `backend/src/modules/enrollments/enrollments.controller.ts`
- Modify: `backend/src/modules/lessons/lessons.controller.ts`
- Modify: `backend/src/modules/sessions/sessions.controller.ts`
- Modify: `backend/src/modules/quizzes/quizzes.controller.ts`
- Create: `backend/test/swagger.e2e-spec.ts`

**Interfaces:**
- Produces: interactive Swagger UI at `GET /api/docs`.
- Produces: OpenAPI JSON at `GET /api/docs-json`.
- Produces: `setupSwagger(app: INestApplication): void`.
- Consumes: existing REST controllers, DTO classes, JWT bearer auth, and `/api` global prefix.

- [x] **Step 1.1: Install Swagger dependencies**

Run from repo root:

```bash
npm.cmd install --workspace=backend @nestjs/swagger@^8 swagger-ui-express
npm.cmd install --workspace=backend --save-dev @types/swagger-ui-express
```

Expected: `backend/package.json` and root `package-lock.json` update.

- [x] **Step 1.2: Enable Nest Swagger plugin**

Modify `backend/nest-cli.json`:

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true,
    "plugins": [
      {
        "name": "@nestjs/swagger",
        "options": {
          "classValidatorShim": true,
          "introspectComments": true,
          "dtoFileNameSuffix": [".dto.ts"]
        }
      }
    ]
  }
}
```

Expected: DTO schemas are generated from class-validator metadata without manually adding `@ApiProperty()` to every DTO.

- [x] **Step 1.3: Add Swagger setup helper**

Create `backend/src/swagger.ts`:

```ts
import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('LMS Realtime API')
    .setDescription('REST API documentation for LMS Realtime backend')
    .setVersion('0.3.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Paste accessToken from /api/auth/login',
      },
      'access-token',
    )
    .addTag('Health')
    .addTag('Auth')
    .addTag('Users')
    .addTag('Courses')
    .addTag('Enrollments')
    .addTag('Lessons')
    .addTag('Sessions')
    .addTag('Quizzes')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey: string, methodKey: string) =>
      `${controllerKey.replace('Controller', '')}_${methodKey}`,
  });

  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: '/api/docs-json',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });
}
```

- [x] **Step 1.4: Register Swagger in bootstrap**

Modify `backend/src/main.ts`:

```ts
import { setupSwagger } from './swagger';
```

Then call it after global pipes/filters/interceptors and before `app.listen(port)`:

```ts
setupSwagger(app);
```

Expected: Swagger routes are served under the same global `/api` surface.

- [x] **Step 1.5: Tag REST controllers**

Add tags to controllers:

```ts
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
```

Use:

```ts
@ApiTags('Auth')
@Controller('auth')
export class AuthController {}
```

```ts
@ApiTags('Users')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller()
export class UsersController {}
```

```ts
@ApiTags('Courses')
@Controller('courses')
export class CoursesController {}
```

```ts
@ApiTags('Enrollments')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller()
export class EnrollmentsController {}
```

```ts
@ApiTags('Lessons')
@Controller()
export class LessonsController {}
```

```ts
@ApiTags('Sessions')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller()
export class SessionsController {}
```

```ts
@ApiTags('Quizzes')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller()
export class QuizzesController {}
```

Keep existing guards, routes, and constructor code unchanged.

- [x] **Step 1.6: Add Swagger e2e smoke test**

Create `backend/test/swagger.e2e-spec.ts`:

```ts
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from './helpers/app';
import { setupSwagger } from '../src/swagger';

describe('Swagger (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
    setupSwagger(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves OpenAPI JSON for the REST API', async () => {
    const res = await request(app.getHttpServer()).get('/api/docs-json').expect(200);

    expect(res.body.info.title).toBe('LMS Realtime API');
    expect(res.body.paths['/api/auth/login']).toBeDefined();
    expect(res.body.paths['/api/courses']).toBeDefined();
    expect(res.body.components.securitySchemes['access-token']).toMatchObject({
      type: 'http',
      scheme: 'bearer',
    });
  });
});
```

- [x] **Step 1.7: Run Swagger test**

Run:

```bash
npm.cmd run test:e2e --workspace=backend -- swagger.e2e-spec.ts
```

Expected: Swagger e2e test passes.

- [x] **Step 1.8: Verify backend build**

Run:

```bash
npm.cmd run build:backend
```

Expected: exit code 0.

- [x] **Step 1.9: Commit**

```bash
git add backend/package.json backend/nest-cli.json backend/src backend/test package-lock.json
git commit -m "feat(backend): add swagger api docs"
```

---

### Task 2: Shared Realtime Contracts and Backend Realtime Dependencies

**Files:**
- Modify: `backend/package.json`
- Modify: `backend/.env.example`
- Modify: `backend/src/config/env.ts`
- Create: `shared/src/realtime.ts`
- Create: `shared/src/notifications.ts`
- Modify: `shared/src/index.ts`
- Modify: `shared/src/contracts.type-test.ts`

**Interfaces:**
- Produces: `SessionJoinPayload`, `ChatSendPayload`, `ChatMessagePayload`, `QuizJoinPayload`, `QuizAnswerPayload`, `QuizQuestionPayload`, `QuizRevealPayload`, `QuizLeaderboardPayload`, `NotificationPayload`.
- Produces env `REDIS_URL`, `BREVO_API_KEY`, `EMAIL_FROM`, `NOTIFICATIONS_MOCK_MODE`.
- Consumes existing `ApiEnvelope`, `UserRole`, `QuizRunStatus`, and P2 Prisma models.

- [x] **Step 1.1: Install realtime and async dependencies**

Run from repo root:

```bash
npm.cmd install --workspace=backend "@nestjs/websockets@^10" "@nestjs/platform-socket.io@^10" socket.io "@socket.io/redis-adapter" ioredis "@nestjs/bullmq@^10" bullmq
npm.cmd install --workspace=backend --save-dev socket.io-client
```

Expected: `backend/package.json` and root `package-lock.json` update.

- [x] **Step 1.2: Add backend env values**

Modify `backend/.env.example`:

```env
REDIS_URL=redis://localhost:6379
BREVO_API_KEY=
EMAIL_FROM=no-reply@lms-realtime.local
NOTIFICATIONS_MOCK_MODE=true
```

Modify local `backend/.env` with the same values. Keep `backend/.env` ignored.

- [x] **Step 1.3: Validate new env values**

Modify `backend/src/config/env.ts`:

```ts
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z.string().default('debug'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN_DAYS: z.coerce.number().int().positive().default(30),
  BREVO_API_KEY: z.string().optional().default(''),
  EMAIL_FROM: z.string().email().default('no-reply@lms-realtime.local'),
  NOTIFICATIONS_MOCK_MODE: z.coerce.boolean().default(true),
});
```

- [x] **Step 1.4: Add shared realtime contracts**

Create `shared/src/realtime.ts`:

```ts
export interface SessionJoinPayload {
  sessionId: string;
}

export interface SessionStatePayload {
  id: string;
  status: 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED';
  participantCount: number;
}

export interface ChatSendPayload {
  sessionId: string;
  content: string;
}

export interface ChatMessagePayload {
  id: string;
  sessionId: string;
  userId: string;
  name: string;
  content: string;
  createdAt: string;
}

export interface QuizJoinPayload {
  quizRunId: string;
}

export interface QuizAnswerPayload {
  quizRunId: string;
  questionId: string;
  optionId: string;
}

export interface QuizQuestionPayload {
  currentQuestionIndex: number;
  question: {
    id: string;
    text: string;
    options: Array<{ id: string; text: string }>;
  };
}

export interface QuizQuestionClosedPayload {
  questionId: string;
  answerCount: number;
}

export interface QuizRevealPayload {
  questionId: string;
  correctOptionId: string;
  correctCount: number;
}

export interface QuizLeaderboardEntry {
  userId: string;
  name: string;
  score: number;
  rank: number;
}

export interface QuizLeaderboardPayload {
  entries: QuizLeaderboardEntry[];
}

export interface QuizFinishedPayload {
  summaryUrl: string;
}
```

Create `shared/src/notifications.ts`:

```ts
export interface NotificationPayload {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: string;
}

export interface NotificationResponse extends NotificationPayload {
  readAt: string | null;
}
```

- [x] **Step 1.5: Export contracts and add type smoke**

Modify `shared/src/index.ts`:

```ts
export * from './notifications';
export * from './realtime';
```

Append to `shared/src/contracts.type-test.ts`:

```ts
import type {
  ChatMessagePayload,
  NotificationPayload,
  QuizQuestionPayload,
  SessionStatePayload,
} from './index';

const sessionState: SessionStatePayload = {
  id: 'session-1',
  status: 'LIVE',
  participantCount: 1,
};

const chatMessage: ChatMessagePayload = {
  id: 'message-1',
  sessionId: 'session-1',
  userId: 'user-1',
  name: 'Student',
  content: 'Hello',
  createdAt: new Date().toISOString(),
};

const quizQuestion: QuizQuestionPayload = {
  currentQuestionIndex: 1,
  question: {
    id: 'question-1',
    text: 'Which store is relational?',
    options: [{ id: 'a', text: 'PostgreSQL' }],
  },
};

const notification: NotificationPayload = {
  id: 'notification-1',
  type: 'COURSE_PUBLISHED',
  title: 'Course published',
  body: 'Realtime LMS Foundations is live',
  createdAt: new Date().toISOString(),
};

void sessionState;
void chatMessage;
void quizQuestion;
void notification;
```

- [x] **Step 1.6: Verify shared build**

Run:

```bash
npm.cmd run build:shared
```

Expected: exit code 0.

- [x] **Step 1.7: Commit**

```bash
git add backend/package.json backend/.env.example backend/src/config/env.ts shared/src package-lock.json
git commit -m "feat(shared): add realtime event contracts"
```

---

### Task 3: Redis Module, Socket.IO Redis Adapter, and WS Test Helpers

**Files:**
- Create: `backend/src/redis/redis.module.ts`
- Create: `backend/src/redis/redis.service.ts`
- Create: `backend/src/common/realtime/redis-io.adapter.ts`
- Create: `backend/src/common/realtime/ws-auth.service.ts`
- Create: `backend/src/common/realtime/ws-exception.filter.ts`
- Create: `backend/src/common/realtime/ws-validation.pipe.ts`
- Modify: `backend/src/main.ts`
- Modify: `backend/src/app.module.ts`
- Create: `backend/test/helpers/ws-app.ts`
- Create: `backend/test/helpers/socket.ts`

**Interfaces:**
- Produces: `RedisService.getClient(): Redis`, `RedisService.duplicate(): Redis`.
- Produces: `RedisIoAdapter` used by `main.ts`.
- Produces: `WsAuthService.authenticate(client): Promise<AuthenticatedUser>`.
- Produces: `createWsTestApp(): Promise<{ app, url }>` and `connectSocket(url, namespace, token)`.
- Consumes: env `REDIS_URL`, existing JWT strategy secrets, existing `AuthenticatedUser`.

- [x] **Step 2.1: Add Redis service**

Create `backend/src/redis/redis.service.ts`:

```ts
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { env } from '../config/env';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: null,
  });

  getClient(): Redis {
    return this.client;
  }

  duplicate(): Redis {
    return this.client.duplicate({ lazyConnect: true });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
```

Create `backend/src/redis/redis.module.ts`:

```ts
import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
```

- [x] **Step 2.2: Add Redis-backed Socket.IO adapter**

Create `backend/src/common/realtime/redis-io.adapter.ts`:

```ts
import { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { ServerOptions } from 'socket.io';
import { env } from '../../config/env';
import { RedisService } from '../../redis/redis.service';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor?: ReturnType<typeof createAdapter>;

  constructor(private readonly app: INestApplicationContext) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const redis = this.app.get(RedisService);
    const pubClient = redis.duplicate();
    const subClient = redis.duplicate();
    await Promise.all([pubClient.connect(), subClient.connect()]);
    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: env.CORS_ORIGIN,
        credentials: true,
      },
    });

    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }

    return server;
  }
}
```

Modify `backend/src/main.ts` before `app.listen(port)`:

```ts
const redisIoAdapter = new RedisIoAdapter(app);
await redisIoAdapter.connectToRedis();
app.useWebSocketAdapter(redisIoAdapter);
```

- [x] **Step 2.3: Add WebSocket auth service**

Create `backend/src/common/realtime/ws-auth.service.ts`:

```ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { env } from '../../config/env';
import type { AuthenticatedUser } from '../types/authenticated-request';

type AccessTokenPayload = {
  sub: string;
  email: string;
  role: AuthenticatedUser['role'];
};

@Injectable()
export class WsAuthService {
  constructor(private readonly jwtService: JwtService) {}

  async authenticate(client: Socket): Promise<AuthenticatedUser> {
    const token = client.handshake.auth?.token;

    if (typeof token !== 'string' || token.length === 0) {
      throw new UnauthorizedException('Missing websocket auth token');
    }

    const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
      secret: env.JWT_ACCESS_SECRET,
    });

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
```

- [x] **Step 2.4: Add WS exception filter and validation pipe**

Create `backend/src/common/realtime/ws-exception.filter.ts`:

```ts
import { ArgumentsHost, Catch, WsExceptionFilter } from '@nestjs/common';
import { Socket } from 'socket.io';

@Catch()
export class WsAllExceptionsFilter implements WsExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const client = host.switchToWs().getClient<Socket>();
    const message = exception instanceof Error ? exception.message : 'WebSocket error';
    client.emit('error', { message });
  }
}
```

Create `backend/src/common/realtime/ws-validation.pipe.ts`:

```ts
import { ValidationPipe } from '@nestjs/common';

export const wsValidationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});
```

- [x] **Step 2.5: Register Redis module**

Modify `backend/src/app.module.ts`:

```ts
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    EnvModule,
    RedisModule,
    PrismaModule,
    // existing modules
  ],
})
export class AppModule {}
```

- [x] **Step 2.6: Add WS test app helper**

Create `backend/test/helpers/ws-app.ts`:

```ts
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AddressInfo } from 'node:net';
import { AppModule } from '../../src/app.module';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { EnvelopeInterceptor } from '../../src/common/interceptors/envelope.interceptor';
import { RedisIoAdapter } from '../../src/common/realtime/redis-io.adapter';

export async function createWsTestApp(): Promise<{ app: INestApplication; url: string }> {
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

  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  await app.listen(0);
  const address = app.getHttpServer().address() as AddressInfo;
  return { app, url: `http://127.0.0.1:${address.port}` };
}
```

Create `backend/test/helpers/socket.ts`:

```ts
import { io, Socket } from 'socket.io-client';

export async function connectSocket(
  baseUrl: string,
  namespace: '/sessions' | '/quiz' | '/notifications',
  token: string,
): Promise<Socket> {
  const socket = io(`${baseUrl}${namespace}`, {
    auth: { token },
    forceNew: true,
    reconnection: false,
    transports: ['websocket'],
  });

  await new Promise<void>((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });

  return socket;
}
```

- [x] **Step 2.7: Verify build**

Run:

```bash
npm.cmd run build:backend
```

Expected: exit code 0.

- [x] **Step 2.8: Commit**

```bash
git add backend/src backend/test backend/package.json backend/.env.example package-lock.json
git commit -m "feat(realtime): add redis socket infrastructure"
```

---

### Task 4: Sessions Gateway for Join, Presence, and Chat

**Files:**
- Create: `backend/src/modules/sessions/dto/session-join.dto.ts`
- Create: `backend/src/modules/sessions/dto/chat-send.dto.ts`
- Create: `backend/src/modules/sessions/sessions.gateway.ts`
- Create: `backend/src/modules/sessions/sessions.realtime.service.ts`
- Modify: `backend/src/modules/sessions/sessions.module.ts`
- Modify: `backend/src/modules/sessions/sessions.service.ts`
- Create: `backend/test/sessions-realtime.e2e-spec.ts`

**Interfaces:**
- Produces Socket.IO namespace `/sessions`.
- Produces C->S event `session:join` with `{ sessionId }`.
- Produces C->S event `chat:send` with `{ sessionId, content }`.
- Emits `session:state` to room `session:<sessionId>`.
- Emits `chat:message` to room `session:<sessionId>`.
- Consumes `WsAuthService`, `RedisService`, `PrismaService`, and existing session/course/enrollment data.

- [x] **Step 3.1: Write failing sessions realtime tests**

Create `backend/test/sessions-realtime.e2e-spec.ts`:

```ts
import request from 'supertest';
import { Socket } from 'socket.io-client';
import { PrismaService } from '../src/prisma/prisma.service';
import { createAuthUser } from './helpers/auth';
import { clearDatabase } from './helpers/db';
import { connectSocket } from './helpers/socket';
import { createWsTestApp } from './helpers/ws-app';
import { NotificationsService } from '../src/modules/notifications/notifications.service';

describe('Sessions realtime (e2e)', () => {
  let app;
  let url: string;
  let prisma: PrismaService;
  let sockets: Socket[] = [];

  beforeAll(async () => {
    const created = await createWsTestApp();
    app = created.app;
    url = created.url;
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    sockets = [];
    await clearDatabase(prisma);
  });

  afterEach(() => {
    sockets.forEach((socket) => socket.disconnect());
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows an enrolled student to join a live session and receives participant count', async () => {
    const fixture = await createLiveSessionFixture();
    const socket = await connectSocket(url, '/sessions', fixture.student.accessToken);
    sockets.push(socket);

    const statePromise = once(socket, 'session:state');
    socket.emit('session:join', { sessionId: fixture.session.id });

    await expect(statePromise).resolves.toMatchObject({
      id: fixture.session.id,
      status: 'LIVE',
      participantCount: 1,
    });
  });

  it('rejects a non-enrolled student joining a live session', async () => {
    const fixture = await createLiveSessionFixture({ enrollStudent: false });
    const socket = await connectSocket(url, '/sessions', fixture.student.accessToken);
    sockets.push(socket);

    const errorPromise = once(socket, 'error');
    socket.emit('session:join', { sessionId: fixture.session.id });

    await expect(errorPromise).resolves.toMatchObject({
      message: expect.stringContaining('Khong co quyen'),
    });
  });

  it('persists and broadcasts chat messages to the session room', async () => {
    const fixture = await createLiveSessionFixture();
    const studentSocket = await connectSocket(url, '/sessions', fixture.student.accessToken);
    const instructorSocket = await connectSocket(url, '/sessions', fixture.instructor.accessToken);
    sockets.push(studentSocket, instructorSocket);

    studentSocket.emit('session:join', { sessionId: fixture.session.id });
    instructorSocket.emit('session:join', { sessionId: fixture.session.id });
    await once(instructorSocket, 'session:state');

    const messagePromise = once(instructorSocket, 'chat:message');
    studentSocket.emit('chat:send', {
      sessionId: fixture.session.id,
      content: 'Hello live class',
    });

    await expect(messagePromise).resolves.toMatchObject({
      sessionId: fixture.session.id,
      userId: fixture.student.user.id,
      name: fixture.student.user.name,
      content: 'Hello live class',
    });

    await expect(prisma.chatMessage.count()).resolves.toBe(1);
  });

  async function createLiveSessionFixture(options: { enrollStudent?: boolean } = {}) {
    const instructor = await createAuthUser(app, {
      email: 'instructor@example.com',
      role: 'INSTRUCTOR',
    });
    const student = await createAuthUser(app, {
      email: 'student@example.com',
      role: 'STUDENT',
    });

    const course = (
      await request(app.getHttpServer())
        .post('/api/courses')
        .set('Authorization', `Bearer ${instructor.accessToken}`)
        .send({ title: 'Realtime LMS', slug: 'realtime-lms' })
        .expect(201)
    ).body.data;

    await request(app.getHttpServer())
      .post(`/api/courses/${course.id}/publish`)
      .set('Authorization', `Bearer ${instructor.accessToken}`)
      .expect(201);

    if (options.enrollStudent !== false) {
      await request(app.getHttpServer())
        .post(`/api/courses/${course.id}/enroll`)
        .set('Authorization', `Bearer ${student.accessToken}`)
        .expect(201);
    }

    const session = (
      await request(app.getHttpServer())
        .post(`/api/courses/${course.id}/sessions`)
        .set('Authorization', `Bearer ${instructor.accessToken}`)
        .send({ title: 'Live demo', startsAt: new Date().toISOString() })
        .expect(201)
    ).body.data;

    await request(app.getHttpServer())
      .post(`/api/sessions/${session.id}/start`)
      .set('Authorization', `Bearer ${instructor.accessToken}`)
      .expect(201);

    return { instructor, student, course, session: { ...session, status: 'LIVE' } };
  }
});

function once<T = any>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve) => socket.once(event, resolve));
}
```

- [x] **Step 3.2: Run sessions realtime tests to verify failure**

Run:

```bash
npm.cmd run test:e2e --workspace=backend -- sessions-realtime.e2e-spec.ts
```

Expected: FAIL because `/sessions` namespace does not exist.

- [x] **Step 3.3: Add DTOs**

Create `backend/src/modules/sessions/dto/session-join.dto.ts`:

```ts
import { IsUUID } from 'class-validator';

export class SessionJoinDto {
  @IsUUID()
  sessionId!: string;
}
```

Create `backend/src/modules/sessions/dto/chat-send.dto.ts`:

```ts
import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class ChatSendDto {
  @IsUUID()
  sessionId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  content!: string;
}
```

- [x] **Step 3.4: Add sessions realtime service**

Create `backend/src/modules/sessions/sessions.realtime.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import type { ChatMessagePayload, SessionStatePayload } from '@lms/shared';

@Injectable()
export class SessionsRealtimeService {
  private server?: Server;

  registerServer(server: Server): void {
    this.server = server;
  }

  emitSessionState(sessionId: string, payload: SessionStatePayload): void {
    this.server?.to(`session:${sessionId}`).emit('session:state', payload);
  }

  emitChatMessage(sessionId: string, payload: ChatMessagePayload): void {
    this.server?.to(`session:${sessionId}`).emit('chat:message', payload);
  }
}
```

- [x] **Step 3.5: Add sessions gateway**

Create `backend/src/modules/sessions/sessions.gateway.ts`:

```ts
import { UseFilters, UsePipes } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { WsAuthService } from '../../common/realtime/ws-auth.service';
import { WsAllExceptionsFilter } from '../../common/realtime/ws-exception.filter';
import { wsValidationPipe } from '../../common/realtime/ws-validation.pipe';
import { AppError } from '../../common/errors/app-error';
import { HttpStatus } from '@nestjs/common';
import { ChatSendDto } from './dto/chat-send.dto';
import { SessionJoinDto } from './dto/session-join.dto';
import { SessionsRealtimeService } from './sessions.realtime.service';

@UseFilters(new WsAllExceptionsFilter())
@UsePipes(wsValidationPipe)
@WebSocketGateway({ namespace: '/sessions' })
export class SessionsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly wsAuth: WsAuthService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly realtime: SessionsRealtimeService,
  ) {}

  afterInit(server: Server): void {
    this.realtime.registerServer(server);
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      client.data.user = await this.wsAuth.authenticate(client);
    } catch {
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const sessionIds = (client.data.sessionIds ?? []) as string[];
    const user = client.data.user as AuthenticatedUser | undefined;
    if (!user) return;

    for (const sessionId of sessionIds) {
      await this.redis.getClient().srem(`session:${sessionId}:participants`, user.id);
      await this.emitState(sessionId);
    }
  }

  @SubscribeMessage('session:join')
  async join(@ConnectedSocket() client: Socket, @MessageBody() dto: SessionJoinDto): Promise<void> {
    const user = client.data.user as AuthenticatedUser;
    const session = await this.findLiveSessionForUser(dto.sessionId, user);
    await client.join(`session:${session.id}`);
    client.data.sessionIds = [...new Set([...(client.data.sessionIds ?? []), session.id])];
    await this.redis.getClient().sadd(`session:${session.id}:participants`, user.id);
    await this.emitState(session.id);
  }

  @SubscribeMessage('chat:send')
  async sendChat(@ConnectedSocket() client: Socket, @MessageBody() dto: ChatSendDto): Promise<void> {
    const user = client.data.user as AuthenticatedUser;
    await this.findLiveSessionForUser(dto.sessionId, user);

    const message = await this.prisma.chatMessage.create({
      data: { sessionId: dto.sessionId, userId: user.id, content: dto.content.trim() },
      include: { user: { select: { name: true } } },
    });

    this.realtime.emitChatMessage(dto.sessionId, {
      id: message.id,
      sessionId: message.sessionId,
      userId: message.userId,
      name: message.user.name,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
    });
  }

  private async emitState(sessionId: string): Promise<void> {
    const session = await this.prisma.session.findUniqueOrThrow({
      where: { id: sessionId },
      select: { id: true, status: true },
    });
    const participantCount = await this.redis.getClient().scard(`session:${sessionId}:participants`);
    this.realtime.emitSessionState(sessionId, { ...session, participantCount });
  }

  private async findLiveSessionForUser(sessionId: string, user: AuthenticatedUser) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { course: { select: { instructorId: true } } },
    });

    if (!session || session.status !== 'LIVE') {
      throw new AppError('CONFLICT', 'Session chua live', HttpStatus.CONFLICT);
    }

    if (user.role === 'ADMIN' || session.course.instructorId === user.id) {
      return session;
    }

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: user.id, courseId: session.courseId } },
      select: { id: true },
    });

    if (!enrollment) {
      throw new AppError('AUTH_FORBIDDEN', 'Khong co quyen vao session', HttpStatus.FORBIDDEN);
    }

    return session;
  }
}
```

- [x] **Step 3.6: Broadcast REST start/end state**

Modify `backend/src/modules/sessions/sessions.service.ts` constructor:

```ts
constructor(
  private readonly prisma: PrismaService,
  private readonly coursesService: CoursesService,
  private readonly sessionsRealtime: SessionsRealtimeService,
) {}
```

After successful `start()` update:

```ts
const updated = await this.prisma.session.update({ ... });
this.sessionsRealtime.emitSessionState(updated.id, {
  id: updated.id,
  status: updated.status,
  participantCount: 0,
});
return updated;
```

After successful `end()` update:

```ts
const updated = await this.prisma.session.update({ ... });
this.sessionsRealtime.emitSessionState(updated.id, {
  id: updated.id,
  status: updated.status,
  participantCount: 0,
});
return updated;
```

- [x] **Step 3.7: Register gateway and service**

Modify `backend/src/modules/sessions/sessions.module.ts`:

```ts
@Module({
  imports: [CoursesModule],
  controllers: [SessionsController],
  providers: [SessionsService, SessionsGateway, SessionsRealtimeService, WsAuthService],
  exports: [SessionsService],
})
export class SessionsModule {}
```

If `WsAuthService` is needed by multiple gateways, move it to a small `RealtimeModule` and export it instead of registering it in every feature module.

- [x] **Step 3.8: Verify sessions realtime tests pass**

Run:

```bash
npm.cmd run test:e2e --workspace=backend -- sessions-realtime.e2e-spec.ts
```

Expected: all tests pass.

- [x] **Step 3.9: Verify backend build**

Run:

```bash
npm.cmd run build:backend
```

Expected: exit code 0.

- [x] **Step 3.10: Commit**

```bash
git add backend/src backend/test
git commit -m "feat(sessions): add realtime chat and presence"
```

---

### Task 5: Quiz REST Control Flow and Scoring Core

**Files:**
- Create: `backend/src/modules/quizzes/quiz-scoring.service.ts`
- Create: `backend/src/modules/quizzes/quizzes.realtime.service.ts`
- Modify: `backend/src/modules/quizzes/quizzes.controller.ts`
- Modify: `backend/src/modules/quizzes/quizzes.service.ts`
- Modify: `backend/src/modules/quizzes/quizzes.module.ts`
- Modify: `backend/test/sessions-quizzes.e2e-spec.ts`

**Interfaces:**
- Produces REST endpoints:
  - `POST /api/quiz-runs/:id/questions/next`
  - `POST /api/quiz-runs/:id/questions/close`
  - `POST /api/quiz-runs/:id/reveal`
  - `POST /api/quiz-runs/:id/finish`
- Produces `QuizScoringService.calculateScore(isCorrect, questionOpenedAt, answeredAt): number`.
- Emits quiz events through `QuizzesRealtimeService`.
- Consumes existing `QuizzesService.getQuizRunState`, `QuizRun`, `Question`, `QuizAnswer`.

- [x] **Step 4.1: Add REST control e2e tests**

Append to `backend/test/sessions-quizzes.e2e-spec.ts`:

```ts
it('opens the next quiz question without exposing correctOptionId', async () => {
  const fixture = await createSessionQuizFixture();

  const res = await request(app.getHttpServer())
    .post(`/api/quiz-runs/${fixture.run.id}/questions/next`)
    .set('Authorization', `Bearer ${fixture.instructor.accessToken}`)
    .expect(201);

  expect(res.body.data).toMatchObject({
    status: 'OPEN',
    currentQuestionIndex: 1,
    question: {
      text: 'Which service stores relational LMS data?',
    },
  });
  expect(JSON.stringify(res.body.data)).not.toContain('correctOptionId');
});

it('closes, reveals, and finishes a quiz run', async () => {
  const fixture = await createSessionQuizFixture();

  await request(app.getHttpServer())
    .post(`/api/quiz-runs/${fixture.run.id}/questions/next`)
    .set('Authorization', `Bearer ${fixture.instructor.accessToken}`)
    .expect(201);

  const closeRes = await request(app.getHttpServer())
    .post(`/api/quiz-runs/${fixture.run.id}/questions/close`)
    .set('Authorization', `Bearer ${fixture.instructor.accessToken}`)
    .expect(201);
  expect(closeRes.body.data).toMatchObject({ status: 'CLOSED', answerCount: 0 });

  const revealRes = await request(app.getHttpServer())
    .post(`/api/quiz-runs/${fixture.run.id}/reveal`)
    .set('Authorization', `Bearer ${fixture.instructor.accessToken}`)
    .expect(201);
  expect(revealRes.body.data).toMatchObject({ status: 'REVEALED', correctOptionId: 'a' });

  const finishRes = await request(app.getHttpServer())
    .post(`/api/quiz-runs/${fixture.run.id}/finish`)
    .set('Authorization', `Bearer ${fixture.instructor.accessToken}`)
    .expect(201);
  expect(finishRes.body.data).toMatchObject({ status: 'FINISHED' });
});
```

Add helper `createSessionQuizFixture()` in the same file by composing existing session, lesson, quiz, and quiz run helpers.

- [x] **Step 4.2: Run REST control tests to verify failure**

Run:

```bash
npm.cmd run test:e2e --workspace=backend -- sessions-quizzes.e2e-spec.ts
```

Expected: FAIL because quiz run control routes do not exist.

- [x] **Step 4.3: Add scoring service**

Create `backend/src/modules/quizzes/quiz-scoring.service.ts`:

```ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class QuizScoringService {
  calculateScore(isCorrect: boolean, questionOpenedAt: Date, answeredAt: Date): number {
    if (!isCorrect) {
      return 0;
    }

    const elapsedSeconds = Math.max(
      0,
      Math.floor((answeredAt.getTime() - questionOpenedAt.getTime()) / 1000),
    );

    return 100 + Math.max(0, 50 - elapsedSeconds);
  }
}
```

- [x] **Step 4.4: Add quiz realtime service**

Create `backend/src/modules/quizzes/quizzes.realtime.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import type {
  QuizFinishedPayload,
  QuizLeaderboardPayload,
  QuizQuestionClosedPayload,
  QuizQuestionPayload,
  QuizRevealPayload,
} from '@lms/shared';

@Injectable()
export class QuizzesRealtimeService {
  private server?: Server;

  registerServer(server: Server): void {
    this.server = server;
  }

  emitQuestion(quizRunId: string, payload: QuizQuestionPayload): void {
    this.server?.to(`quiz-run:${quizRunId}`).emit('quiz:question', payload);
  }

  emitQuestionClosed(quizRunId: string, payload: QuizQuestionClosedPayload): void {
    this.server?.to(`quiz-run:${quizRunId}`).emit('quiz:question:closed', payload);
  }

  emitReveal(quizRunId: string, payload: QuizRevealPayload): void {
    this.server?.to(`quiz-run:${quizRunId}`).emit('quiz:reveal', payload);
  }

  emitLeaderboard(quizRunId: string, payload: QuizLeaderboardPayload): void {
    this.server?.to(`quiz-run:${quizRunId}`).emit('quiz:leaderboard', payload);
  }

  emitFinished(quizRunId: string, payload: QuizFinishedPayload): void {
    this.server?.to(`quiz-run:${quizRunId}`).emit('quiz:finished', payload);
  }
}
```

- [x] **Step 4.5: Implement quiz control service methods**

Modify `backend/src/modules/quizzes/quizzes.service.ts` constructor:

```ts
constructor(
  private readonly prisma: PrismaService,
  private readonly coursesService: CoursesService,
  private readonly redis: RedisService,
  private readonly realtime: QuizzesRealtimeService,
) {}
```

Add methods:

```ts
async openNextQuestion(id: string, actor: AuthenticatedUser) {
  const run = await this.findRunWithQuizSessionOrThrow(id);
  this.coursesService.ensureCanManage(run.session.course, actor);

  if (run.status === 'FINISHED') {
    throw new AppError('QUIZ_RUN_LOCKED', 'QuizRun da ket thuc', HttpStatus.BAD_REQUEST);
  }

  const nextIndex = (run.currentQuestionIndex ?? 0) + 1;
  const question = run.quiz.questions[nextIndex - 1];
  if (!question) {
    throw new AppError('CONFLICT', 'Khong con cau hoi tiep theo', HttpStatus.CONFLICT);
  }

  const updated = await this.prisma.quizRun.update({
    where: { id },
    data: {
      currentQuestionIndex: nextIndex,
      status: 'OPEN',
      questionOpenedAt: new Date(),
    },
  });

  const payload = {
    currentQuestionIndex: nextIndex,
    question: { id: question.id, text: question.text, options: question.options as any },
  };
  this.realtime.emitQuestion(id, payload);
  return { ...updated, ...payload };
}

async closeQuestion(id: string, actor: AuthenticatedUser) {
  const run = await this.findRunWithQuizSessionOrThrow(id);
  this.coursesService.ensureCanManage(run.session.course, actor);

  if (run.status !== 'OPEN' || !run.currentQuestionIndex) {
    throw new AppError('CONFLICT', 'Khong co cau hoi dang mo', HttpStatus.CONFLICT);
  }

  const question = run.quiz.questions[run.currentQuestionIndex - 1];
  const answerCount = Number(
    (await this.redis.getClient().get(`quiz-run:${id}:q:${run.currentQuestionIndex}:count`)) ?? 0,
  );

  const updated = await this.prisma.quizRun.update({
    where: { id },
    data: { status: 'CLOSED' },
  });

  this.realtime.emitQuestionClosed(id, { questionId: question.id, answerCount });
  return { ...updated, questionId: question.id, answerCount };
}

async revealQuestion(id: string, actor: AuthenticatedUser) {
  const run = await this.findRunWithQuizSessionOrThrow(id);
  this.coursesService.ensureCanManage(run.session.course, actor);

  if (run.status !== 'CLOSED' || !run.currentQuestionIndex) {
    throw new AppError('CONFLICT', 'Chi reveal sau khi dong cau hoi', HttpStatus.CONFLICT);
  }

  const question = run.quiz.questions[run.currentQuestionIndex - 1];
  const correctCount = await this.prisma.quizAnswer.count({
    where: { runId: id, questionId: question.id, isCorrect: true },
  });

  const updated = await this.prisma.quizRun.update({
    where: { id },
    data: { status: 'REVEALED' },
  });

  this.realtime.emitReveal(id, {
    questionId: question.id,
    correctOptionId: question.correctOptionId,
    correctCount,
  });
  return { ...updated, questionId: question.id, correctOptionId: question.correctOptionId, correctCount };
}

async finishRun(id: string, actor: AuthenticatedUser) {
  const run = await this.findRunWithQuizSessionOrThrow(id);
  this.coursesService.ensureCanManage(run.session.course, actor);

  const updated = await this.prisma.quizRun.update({
    where: { id },
    data: { status: 'FINISHED' },
  });

  await this.redis.getClient().del(`quiz-run:${id}:leaderboard`);
  this.realtime.emitFinished(id, { summaryUrl: `/api/quiz-runs/${id}/state` });
  return updated;
}
```

Add helper:

```ts
private async findRunWithQuizSessionOrThrow(id: string) {
  const run = await this.prisma.quizRun.findUnique({
    where: { id },
    include: {
      session: { include: { course: { select: { instructorId: true } } } },
      quiz: { include: { questions: { orderBy: { order: 'asc' } } } },
    },
  });

  if (!run) {
    throw new AppError('NOT_FOUND', 'Khong tim thay quiz run', HttpStatus.NOT_FOUND);
  }

  return run;
}
```

- [x] **Step 4.6: Add REST control routes**

Modify `backend/src/modules/quizzes/quizzes.controller.ts`:

```ts
@UseGuards(RolesGuard)
@Roles('ADMIN', 'INSTRUCTOR')
@Post('quiz-runs/:id/questions/next')
openNextQuestion(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
  return this.quizzesService.openNextQuestion(id, user);
}

@UseGuards(RolesGuard)
@Roles('ADMIN', 'INSTRUCTOR')
@Post('quiz-runs/:id/questions/close')
closeQuestion(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
  return this.quizzesService.closeQuestion(id, user);
}

@UseGuards(RolesGuard)
@Roles('ADMIN', 'INSTRUCTOR')
@Post('quiz-runs/:id/reveal')
revealQuestion(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
  return this.quizzesService.revealQuestion(id, user);
}

@UseGuards(RolesGuard)
@Roles('ADMIN', 'INSTRUCTOR')
@Post('quiz-runs/:id/finish')
finishRun(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
  return this.quizzesService.finishRun(id, user);
}
```

- [x] **Step 4.7: Register providers**

Modify `backend/src/modules/quizzes/quizzes.module.ts`:

```ts
@Module({
  imports: [CoursesModule],
  controllers: [QuizzesController],
  providers: [QuizzesService, QuizScoringService, QuizzesRealtimeService],
})
export class QuizzesModule {}
```

- [x] **Step 4.8: Verify REST control tests pass**

Run:

```bash
npm.cmd run test:e2e --workspace=backend -- sessions-quizzes.e2e-spec.ts
```

Expected: all sessions and quizzes tests pass.

- [x] **Step 4.9: Verify backend build**

Run:

```bash
npm.cmd run build:backend
```

Expected: exit code 0.

- [x] **Step 4.10: Commit**

```bash
git add backend/src backend/test
git commit -m "feat(quizzes): add quiz run control flow"
```

---

### Task 6: Quiz Gateway for Join, Answer, Scoring, and Leaderboard

**Files:**
- Create: `backend/src/modules/quizzes/dto/quiz-join.dto.ts`
- Create: `backend/src/modules/quizzes/dto/quiz-answer.dto.ts`
- Create: `backend/src/modules/quizzes/quizzes.gateway.ts`
- Modify: `backend/src/modules/quizzes/quizzes.module.ts`
- Modify: `backend/src/modules/quizzes/quizzes.service.ts`
- Create: `backend/test/quizzes-realtime.e2e-spec.ts`

**Interfaces:**
- Produces Socket.IO namespace `/quiz`.
- Produces C->S event `quiz:join` with `{ quizRunId }`.
- Produces C->S event `quiz:answer` with `{ quizRunId, questionId, optionId }`.
- Emits `quiz:leaderboard` to room `quiz-run:<quizRunId>`.
- Persists `QuizAnswer` with unique `(runId, questionId, userId)`.
- Consumes `QuizScoringService`, `RedisService`, `QuizzesRealtimeService`.

- [x] **Step 5.1: Write failing quiz realtime tests**

Create `backend/test/quizzes-realtime.e2e-spec.ts`:

```ts
import request from 'supertest';
import { Socket } from 'socket.io-client';
import { PrismaService } from '../src/prisma/prisma.service';
import { createAuthUser } from './helpers/auth';
import { clearDatabase } from './helpers/db';
import { connectSocket } from './helpers/socket';
import { createWsTestApp } from './helpers/ws-app';

describe('Quizzes realtime (e2e)', () => {
  let app;
  let url: string;
  let prisma: PrismaService;
  let sockets: Socket[] = [];

  beforeAll(async () => {
    const created = await createWsTestApp();
    app = created.app;
    url = created.url;
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    sockets = [];
    await clearDatabase(prisma);
  });

  afterEach(() => sockets.forEach((socket) => socket.disconnect()));
  afterAll(async () => app.close());

  it('allows enrolled student to join a quiz run', async () => {
    const fixture = await createOpenQuizRunFixture();
    const socket = await connectSocket(url, '/quiz', fixture.student.accessToken);
    sockets.push(socket);

    socket.emit('quiz:join', { quizRunId: fixture.run.id });
    await expect(once(socket, 'quiz:leaderboard')).resolves.toMatchObject({ entries: [] });
  });

  it('accepts one answer, persists score, and broadcasts leaderboard', async () => {
    const fixture = await createOpenQuizRunFixture();
    const socket = await connectSocket(url, '/quiz', fixture.student.accessToken);
    sockets.push(socket);

    socket.emit('quiz:join', { quizRunId: fixture.run.id });
    await once(socket, 'quiz:leaderboard');

    const leaderboardPromise = once(socket, 'quiz:leaderboard');
    socket.emit('quiz:answer', {
      quizRunId: fixture.run.id,
      questionId: fixture.question.id,
      optionId: 'a',
    });

    await expect(leaderboardPromise).resolves.toMatchObject({
      entries: [{ userId: fixture.student.user.id, name: fixture.student.user.name, rank: 1 }],
    });

    const answer = await prisma.quizAnswer.findFirstOrThrow({
      where: { runId: fixture.run.id, userId: fixture.student.user.id },
    });
    expect(answer.isCorrect).toBe(true);
    expect(answer.score).toBeGreaterThanOrEqual(100);
    expect(answer.score).toBeLessThanOrEqual(150);
  });

  it('rejects duplicate answers for the same question', async () => {
    const fixture = await createOpenQuizRunFixture();
    const socket = await connectSocket(url, '/quiz', fixture.student.accessToken);
    sockets.push(socket);

    socket.emit('quiz:join', { quizRunId: fixture.run.id });
    await once(socket, 'quiz:leaderboard');

    socket.emit('quiz:answer', { quizRunId: fixture.run.id, questionId: fixture.question.id, optionId: 'a' });
    await once(socket, 'quiz:leaderboard');

    const errorPromise = once(socket, 'error');
    socket.emit('quiz:answer', { quizRunId: fixture.run.id, questionId: fixture.question.id, optionId: 'a' });
    await expect(errorPromise).resolves.toMatchObject({
      message: expect.stringContaining('Da submit'),
    });
  });

  async function createOpenQuizRunFixture() {
    const instructor = await createAuthUser(app, {
      email: 'instructor@example.com',
      role: 'INSTRUCTOR',
    });
    const student = await createAuthUser(app, {
      email: 'student@example.com',
      role: 'STUDENT',
    });

    const course = (
      await request(app.getHttpServer())
        .post('/api/courses')
        .set('Authorization', `Bearer ${instructor.accessToken}`)
        .send({ title: 'Realtime LMS', slug: 'realtime-lms' })
        .expect(201)
    ).body.data;

    await request(app.getHttpServer())
      .post(`/api/courses/${course.id}/publish`)
      .set('Authorization', `Bearer ${instructor.accessToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/courses/${course.id}/enroll`)
      .set('Authorization', `Bearer ${student.accessToken}`)
      .expect(201);

    const lesson = (
      await request(app.getHttpServer())
        .post(`/api/courses/${course.id}/lessons`)
        .set('Authorization', `Bearer ${instructor.accessToken}`)
        .send({ title: 'Intro lesson', durationSeconds: 600 })
        .expect(201)
    ).body.data;

    const session = (
      await request(app.getHttpServer())
        .post(`/api/courses/${course.id}/sessions`)
        .set('Authorization', `Bearer ${instructor.accessToken}`)
        .send({ title: 'Live quiz session', startsAt: new Date().toISOString() })
        .expect(201)
    ).body.data;

    await request(app.getHttpServer())
      .post(`/api/sessions/${session.id}/start`)
      .set('Authorization', `Bearer ${instructor.accessToken}`)
      .expect(201);

    const quiz = (
      await request(app.getHttpServer())
        .post(`/api/lessons/${lesson.id}/quizzes`)
        .set('Authorization', `Bearer ${instructor.accessToken}`)
        .send({
          title: 'Intro quiz',
          questions: [
            {
              text: 'Which service stores relational LMS data?',
              options: [
                { id: 'a', text: 'PostgreSQL' },
                { id: 'b', text: 'Redis' },
              ],
              correctOptionId: 'a',
            },
          ],
        })
        .expect(201)
    ).body.data;

    const run = (
      await request(app.getHttpServer())
        .post(`/api/sessions/${session.id}/quiz-runs`)
        .set('Authorization', `Bearer ${instructor.accessToken}`)
        .send({ quizId: quiz.id })
        .expect(201)
    ).body.data;

    await request(app.getHttpServer())
      .post(`/api/quiz-runs/${run.id}/questions/next`)
      .set('Authorization', `Bearer ${instructor.accessToken}`)
      .expect(201);

    return {
      instructor,
      student,
      course,
      lesson,
      session,
      quiz,
      run,
      question: quiz.questions[0],
    };
  }
});

function once<T = any>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve) => socket.once(event, resolve));
}
```

- [x] **Step 5.2: Run quiz realtime tests to verify failure**

Run:

```bash
npm.cmd run test:e2e --workspace=backend -- quizzes-realtime.e2e-spec.ts
```

Expected: FAIL because `/quiz` namespace does not exist.

- [x] **Step 5.3: Add quiz DTOs**

Create `backend/src/modules/quizzes/dto/quiz-join.dto.ts`:

```ts
import { IsUUID } from 'class-validator';

export class QuizJoinDto {
  @IsUUID()
  quizRunId!: string;
}
```

Create `backend/src/modules/quizzes/dto/quiz-answer.dto.ts`:

```ts
import { IsString, IsUUID, MinLength } from 'class-validator';

export class QuizAnswerDto {
  @IsUUID()
  quizRunId!: string;

  @IsUUID()
  questionId!: string;

  @IsString()
  @MinLength(1)
  optionId!: string;
}
```

- [x] **Step 5.4: Add quiz answer method**

Add to `backend/src/modules/quizzes/quizzes.service.ts`:

```ts
async submitAnswer(actor: AuthenticatedUser, dto: QuizAnswerDto) {
  const run = await this.findRunWithQuizSessionOrThrow(dto.quizRunId);
  await this.ensureCanViewSession(run.session, actor);

  if (run.status !== 'OPEN' || !run.questionOpenedAt || !run.currentQuestionIndex) {
    throw new AppError('QUIZ_NOT_OPEN', 'Quiz khong mo', HttpStatus.BAD_REQUEST);
  }

  const question = run.quiz.questions[run.currentQuestionIndex - 1];
  if (question.id !== dto.questionId) {
    throw new AppError('VALIDATION_FAILED', 'Cau hoi khong phai cau dang mo', HttpStatus.BAD_REQUEST);
  }

  const options = question.options as Array<{ id: string; text: string }>;
  if (!options.some((option) => option.id === dto.optionId)) {
    throw new AppError('VALIDATION_FAILED', 'optionId khong hop le', HttpStatus.BAD_REQUEST);
  }

  const answeredAt = new Date();
  const isCorrect = dto.optionId === question.correctOptionId;
  const score = this.quizScoring.calculateScore(isCorrect, run.questionOpenedAt, answeredAt);

  try {
    const answer = await this.prisma.quizAnswer.create({
      data: {
        runId: dto.quizRunId,
        questionId: dto.questionId,
        userId: actor.id,
        selectedOptionId: dto.optionId,
        isCorrect,
        score,
        answeredAt,
      },
    });

    await this.redis.getClient().zincrby(`quiz-run:${dto.quizRunId}:leaderboard`, score, actor.id);
    await this.redis.getClient().incr(`quiz-run:${dto.quizRunId}:q:${run.currentQuestionIndex}:count`);
    return answer;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError('QUIZ_ALREADY_ANSWERED', 'Da submit cau nay', HttpStatus.CONFLICT);
    }
    throw error;
  }
}
```

Also inject `private readonly quizScoring: QuizScoringService` in the constructor.

- [x] **Step 5.5: Add leaderboard method**

Add to `backend/src/modules/quizzes/quizzes.service.ts`:

```ts
async getLeaderboard(quizRunId: string) {
  const redisRows = await this.redis
    .getClient()
    .zrevrange(`quiz-run:${quizRunId}:leaderboard`, 0, 9, 'WITHSCORES');

  const entries: Array<{ userId: string; score: number }> = [];
  for (let index = 0; index < redisRows.length; index += 2) {
    entries.push({ userId: redisRows[index], score: Number(redisRows[index + 1]) });
  }

  if (entries.length === 0) {
    return { entries: [] };
  }

  const users = await this.prisma.user.findMany({
    where: { id: { in: entries.map((entry) => entry.userId) } },
    select: { id: true, name: true },
  });
  const names = new Map(users.map((user) => [user.id, user.name]));

  return {
    entries: entries.map((entry, index) => ({
      userId: entry.userId,
      name: names.get(entry.userId) ?? 'Unknown',
      score: entry.score,
      rank: index + 1,
    })),
  };
}
```

- [x] **Step 5.6: Add quiz gateway**

Create `backend/src/modules/quizzes/quizzes.gateway.ts`:

```ts
import { UseFilters, UsePipes } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { WsAuthService } from '../../common/realtime/ws-auth.service';
import { WsAllExceptionsFilter } from '../../common/realtime/ws-exception.filter';
import { wsValidationPipe } from '../../common/realtime/ws-validation.pipe';
import { QuizAnswerDto } from './dto/quiz-answer.dto';
import { QuizJoinDto } from './dto/quiz-join.dto';
import { QuizzesRealtimeService } from './quizzes.realtime.service';
import { QuizzesService } from './quizzes.service';

@UseFilters(new WsAllExceptionsFilter())
@UsePipes(wsValidationPipe)
@WebSocketGateway({ namespace: '/quiz' })
export class QuizzesGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly wsAuth: WsAuthService,
    private readonly quizzesService: QuizzesService,
    private readonly realtime: QuizzesRealtimeService,
  ) {}

  afterInit(server: Server): void {
    this.realtime.registerServer(server);
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      client.data.user = await this.wsAuth.authenticate(client);
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage('quiz:join')
  async join(@ConnectedSocket() client: Socket, @MessageBody() dto: QuizJoinDto): Promise<void> {
    const user = client.data.user as AuthenticatedUser;
    await this.quizzesService.getQuizRunState(dto.quizRunId, user);
    await client.join(`quiz-run:${dto.quizRunId}`);
    this.realtime.emitLeaderboard(dto.quizRunId, await this.quizzesService.getLeaderboard(dto.quizRunId));
  }

  @SubscribeMessage('quiz:answer')
  async answer(@ConnectedSocket() client: Socket, @MessageBody() dto: QuizAnswerDto): Promise<void> {
    const user = client.data.user as AuthenticatedUser;
    await this.quizzesService.submitAnswer(user, dto);
    this.realtime.emitLeaderboard(dto.quizRunId, await this.quizzesService.getLeaderboard(dto.quizRunId));
  }
}
```

- [x] **Step 5.7: Register quiz gateway**

Modify `backend/src/modules/quizzes/quizzes.module.ts`:

```ts
providers: [
  QuizzesService,
  QuizScoringService,
  QuizzesRealtimeService,
  QuizzesGateway,
  WsAuthService,
],
```

- [x] **Step 5.8: Verify quiz realtime tests pass**

Run:

```bash
npm.cmd run test:e2e --workspace=backend -- quizzes-realtime.e2e-spec.ts
```

Expected: all tests pass.

- [x] **Step 5.9: Verify backend build**

Run:

```bash
npm.cmd run build:backend
```

Expected: exit code 0.

- [x] **Step 5.10: Commit**

```bash
git add backend/src backend/test
git commit -m "feat(quizzes): add realtime answers and leaderboard"
```

---

### Task 7: Notifications REST, Gateway, BullMQ Producer, and Mock Email Worker

**Files:**
- Create: `backend/src/queue/queue.constants.ts`
- Create: `backend/src/queue/queue.module.ts`
- Create: `backend/src/modules/notifications/notifications.controller.ts`
- Create: `backend/src/modules/notifications/notifications.gateway.ts`
- Create: `backend/src/modules/notifications/notifications.module.ts`
- Create: `backend/src/modules/notifications/notifications.processor.ts`
- Create: `backend/src/modules/notifications/notifications.producer.ts`
- Create: `backend/src/modules/notifications/notifications.service.ts`
- Modify: `backend/src/modules/courses/courses.module.ts`
- Modify: `backend/src/modules/courses/courses.service.ts`
- Modify: `backend/src/app.module.ts`
- Create: `backend/test/notifications.e2e-spec.ts`

**Interfaces:**
- Produces REST endpoints:
  - `GET /api/me/notifications`
  - `PATCH /api/me/notifications/:id/read`
- Produces Socket.IO namespace `/notifications`.
- Produces BullMQ queue `notifications`.
- Produces job `course-published` with `{ courseId }`.
- Emits `notification:new` to room `user:<userId>`.
- Consumes existing `Notification` Prisma model and `CoursesService.publish()`.

- [x] **Step 6.1: Write failing notification tests**

Create `backend/test/notifications.e2e-spec.ts`:

```ts
import request from 'supertest';
import { Socket } from 'socket.io-client';
import { PrismaService } from '../src/prisma/prisma.service';
import { createAuthUser } from './helpers/auth';
import { clearDatabase } from './helpers/db';
import { connectSocket } from './helpers/socket';
import { createWsTestApp } from './helpers/ws-app';

describe('Notifications (e2e)', () => {
  let app;
  let url: string;
  let prisma: PrismaService;
  let sockets: Socket[] = [];

  beforeAll(async () => {
    const created = await createWsTestApp();
    app = created.app;
    url = created.url;
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    sockets = [];
    await clearDatabase(prisma);
  });

  afterEach(() => sockets.forEach((socket) => socket.disconnect()));
  afterAll(async () => app.close());

  it('lists and marks my notifications as read', async () => {
    const student = await createAuthUser(app, { email: 'student@example.com', role: 'STUDENT' });
    const notification = await prisma.notification.create({
      data: {
        userId: student.user.id,
        type: 'COURSE_PUBLISHED',
        title: 'Course published',
        body: 'Realtime LMS is live',
      },
    });

    const listRes = await request(app.getHttpServer())
      .get('/api/me/notifications')
      .set('Authorization', `Bearer ${student.accessToken}`)
      .expect(200);
    expect(listRes.body.data).toHaveLength(1);

    const readRes = await request(app.getHttpServer())
      .patch(`/api/me/notifications/${notification.id}/read`)
      .set('Authorization', `Bearer ${student.accessToken}`)
      .expect(200);
    expect(readRes.body.data.readAt).toEqual(expect.any(String));
  });

  it('emits notification:new to the authenticated user room', async () => {
    const student = await createAuthUser(app, { email: 'student@example.com', role: 'STUDENT' });
    const socket = await connectSocket(url, '/notifications', student.accessToken);
    sockets.push(socket);

    const notificationPromise = once(socket, 'notification:new');
    await app.get(NotificationsService).createAndEmit({
      userId: student.user.id,
      type: 'COURSE_PUBLISHED',
      title: 'Course published',
      body: 'Realtime LMS is live',
    });

    await expect(notificationPromise).resolves.toMatchObject({
      type: 'COURSE_PUBLISHED',
      title: 'Course published',
    });
  });
});

function once<T = any>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve) => socket.once(event, resolve));
}
```

- [x] **Step 6.2: Run notification tests to verify failure**

Run:

```bash
npm.cmd run test:e2e --workspace=backend -- notifications.e2e-spec.ts
```

Expected: FAIL because notification routes and namespace do not exist.

- [x] **Step 6.3: Add queue module**

Create `backend/src/queue/queue.constants.ts`:

```ts
export const NOTIFICATIONS_QUEUE = 'notifications';
export const COURSE_PUBLISHED_JOB = 'course-published';
```

Create `backend/src/queue/queue.module.ts`:

```ts
import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { env } from '../config/env';
import { NOTIFICATIONS_QUEUE } from './queue.constants';

@Global()
@Module({
  imports: [
    BullModule.forRoot({
      connection: { url: env.REDIS_URL },
    }),
    BullModule.registerQueue({
      name: NOTIFICATIONS_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
```

- [x] **Step 6.4: Add notifications service**

Create `backend/src/modules/notifications/notifications.service.ts`:

```ts
import { HttpStatus, Injectable } from '@nestjs/common';
import type { NotificationPayload } from '@lms/shared';
import { AppError } from '../../common/errors/app-error';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
  ) {}

  async listForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markRead(userId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      throw new AppError('NOT_FOUND', 'Khong tim thay notification', HttpStatus.NOT_FOUND);
    }

    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async createAndEmit(input: {
    userId: string;
    type: string;
    title: string;
    body: string;
  }): Promise<NotificationPayload> {
    const notification = await this.prisma.notification.create({ data: input });
    const payload = {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      createdAt: notification.createdAt.toISOString(),
    };
    this.gateway.emitNewNotification(input.userId, payload);
    return payload;
  }
}
```

- [x] **Step 6.5: Add notifications gateway**

Create `backend/src/modules/notifications/notifications.gateway.ts`:

```ts
import { UseFilters } from '@nestjs/common';
import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import type { NotificationPayload } from '@lms/shared';
import { WsAuthService } from '../../common/realtime/ws-auth.service';
import { WsAllExceptionsFilter } from '../../common/realtime/ws-exception.filter';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';

@UseFilters(new WsAllExceptionsFilter())
@WebSocketGateway({ namespace: '/notifications' })
export class NotificationsGateway implements OnGatewayConnection {
  @WebSocketServer()
  private server!: Server;

  constructor(private readonly wsAuth: WsAuthService) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const user = await this.wsAuth.authenticate(client);
      client.data.user = user;
      await client.join(`user:${user.id}`);
    } catch {
      client.disconnect(true);
    }
  }

  emitNewNotification(userId: string, payload: NotificationPayload): void {
    this.server.to(`user:${userId}`).emit('notification:new', payload);
  }
}
```

- [x] **Step 6.6: Add notifications REST controller**

Create `backend/src/modules/notifications/notifications.controller.ts`:

```ts
import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { NotificationsService } from './notifications.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('me/notifications')
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.listForUser(user.id);
  }

  @Patch('me/notifications/:id/read')
  markRead(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.notificationsService.markRead(user.id, id);
  }
}
```

- [x] **Step 6.7: Add notifications producer and processor**

Create `backend/src/modules/notifications/notifications.producer.ts`:

```ts
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { COURSE_PUBLISHED_JOB, NOTIFICATIONS_QUEUE } from '../../queue/queue.constants';

@Injectable()
export class NotificationsProducer {
  constructor(@InjectQueue(NOTIFICATIONS_QUEUE) private readonly queue: Queue) {}

  async enqueueCoursePublished(courseId: string, publishedAt: Date): Promise<void> {
    await this.queue.add(
      COURSE_PUBLISHED_JOB,
      { courseId },
      { jobId: `course-published:${courseId}:${publishedAt.getTime()}` },
    );
  }
}
```

Create `backend/src/modules/notifications/notifications.processor.ts`:

```ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { COURSE_PUBLISHED_JOB, NOTIFICATIONS_QUEUE } from '../../queue/queue.constants';
import { NotificationsService } from './notifications.service';

@Injectable()
@Processor(NOTIFICATIONS_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {
    super();
  }

  async process(job: Job<{ courseId: string }>): Promise<void> {
    if (job.name !== COURSE_PUBLISHED_JOB) {
      return;
    }

    const course = await this.prisma.course.findUniqueOrThrow({
      where: { id: job.data.courseId },
      include: { enrollments: { include: { user: true } } },
    });

    for (const enrollment of course.enrollments) {
      if (env.NOTIFICATIONS_MOCK_MODE || !env.BREVO_API_KEY) {
        this.logger.debug(`Mock email to ${enrollment.user.email}: ${course.title}`);
      }

      await this.notificationsService.createAndEmit({
        userId: enrollment.userId,
        type: 'COURSE_PUBLISHED',
        title: 'Course published',
        body: `${course.title} is now available`,
      });
    }
  }
}
```

- [x] **Step 6.8: Register notifications module**

Create `backend/src/modules/notifications/notifications.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsProcessor } from './notifications.processor';
import { NotificationsProducer } from './notifications.producer';
import { NotificationsService } from './notifications.service';
import { WsAuthService } from '../../common/realtime/ws-auth.service';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsGateway,
    NotificationsProcessor,
    NotificationsProducer,
    NotificationsService,
    WsAuthService,
  ],
  exports: [NotificationsProducer, NotificationsService],
})
export class NotificationsModule {}
```

Modify `backend/src/app.module.ts`:

```ts
import { QueueModule } from './queue/queue.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

@Module({
  imports: [
    EnvModule,
    RedisModule,
    QueueModule,
    PrismaModule,
    // existing modules
    NotificationsModule,
  ],
})
export class AppModule {}
```

- [x] **Step 6.9: Enqueue course-published jobs**

Modify `backend/src/modules/courses/courses.module.ts`:

```ts
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [CoursesController],
  providers: [CoursesService],
  exports: [CoursesService],
})
export class CoursesModule {}
```

Modify `backend/src/modules/courses/courses.service.ts` constructor:

```ts
constructor(
  private readonly prisma: PrismaService,
  private readonly notificationsProducer: NotificationsProducer,
) {}
```

Modify `publish()`:

```ts
const publishedAt = new Date();
const updated = await this.prisma.course.update({
  where: { id },
  data: { status: 'PUBLISHED', publishedAt },
  select: courseSelect,
});
await this.notificationsProducer.enqueueCoursePublished(updated.id, publishedAt);
return updated;
```

Expected: `CoursesModule` imports `NotificationsModule`; `NotificationsModule` does not import `CoursesModule`, so no `forwardRef` is needed.

- [x] **Step 6.10: Verify notification tests pass**

Run:

```bash
npm.cmd run test:e2e --workspace=backend -- notifications.e2e-spec.ts
```

Expected: all tests pass.

- [x] **Step 6.11: Verify affected course tests pass**

Run:

```bash
npm.cmd run test:e2e --workspace=backend -- courses.e2e-spec.ts
```

Expected: all course tests pass. If queue jobs create async timing noise, mock `NotificationsProducer` in course tests or wait for notification job completion only in notification-specific tests.

- [x] **Step 6.12: Verify backend build**

Run:

```bash
npm.cmd run build:backend
```

Expected: exit code 0.

- [x] **Step 6.13: Commit**

```bash
git add backend/src backend/test backend/package.json backend/.env.example package-lock.json
git commit -m "feat(notifications): add realtime queue notifications"
```

---

### Task 8: P3 Final Verification, README, and Seed Upgrade

**Files:**
- Modify: `backend/prisma/seed.ts`
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-08-27-lms-realtime-p3-realtime-async.md`

**Interfaces:**
- Produces richer manual demo seed data: live session, 1 instructor, at least 2 students enrolled, quiz with 5 questions.
- Produces README instructions for local realtime smoke.
- Consumes all P3 modules and P2 seed credentials.

- [x] **Step 7.1: Upgrade seed data for P3 manual demo**

Modify `backend/prisma/seed.ts` to create:

```ts
const studentTwo = await prisma.user.create({
  data: { email: 'student2@example.com', name: 'Student Two', passwordHash, role: 'STUDENT' },
});
```

Create:

```ts
await prisma.enrollment.createMany({
  data: [
    { courseId: course.id, userId: student.id },
    { courseId: course.id, userId: studentTwo.id },
  ],
});
```

Create quiz with 5 questions instead of 1:

```ts
questions: {
  create: [
    {
      text: 'Which service stores relational LMS data?',
      options: [{ id: 'a', text: 'PostgreSQL' }, { id: 'b', text: 'Redis' }],
      correctOptionId: 'a',
      order: 1,
    },
    {
      text: 'Which protocol powers realtime events here?',
      options: [{ id: 'a', text: 'Socket.IO' }, { id: 'b', text: 'SMTP' }],
      correctOptionId: 'a',
      order: 2,
    },
    {
      text: 'Which service backs BullMQ?',
      options: [{ id: 'a', text: 'Redis' }, { id: 'b', text: 'MinIO' }],
      correctOptionId: 'a',
      order: 3,
    },
    {
      text: 'Which room prefix is used for quiz runs?',
      options: [{ id: 'a', text: 'quiz-run:' }, { id: 'b', text: 'course:' }],
      correctOptionId: 'a',
      order: 4,
    },
    {
      text: 'Should quiz:question expose correctOptionId?',
      options: [{ id: 'a', text: 'No' }, { id: 'b', text: 'Yes' }],
      correctOptionId: 'a',
      order: 5,
    },
  ],
}
```

- [x] **Step 7.2: Update README P3 smoke instructions**

Add:

```bash
npm.cmd run infra:up
npm.cmd run db:migrate --workspace=backend
npm.cmd run db:seed --workspace=backend
npm.cmd run dev:backend
```

Document Socket.IO namespaces:

```text
/sessions        auth.handshake.token, events: session:join, chat:send
/quiz            auth.handshake.token, events: quiz:join, quiz:answer
/notifications   auth.handshake.token, event: notification:new
```

Document additional seed credential:

```text
student2@example.com / Password123!
```

- [x] **Step 7.3: Run all backend e2e tests**

Run:

```bash
npm.cmd run test:e2e --workspace=backend
```

Expected: all P2 and P3 e2e suites pass.

- [x] **Step 7.4: Run backend and frontend builds**

Run:

```bash
npm.cmd run build
```

Expected: backend, shared, and frontend builds pass.

- [x] **Step 7.5: Run frontend tests**

Run:

```bash
npm.cmd run test:frontend
```

Expected: all frontend tests pass. P3 does not add frontend UI, but this guards shared contract changes.

- [x] **Step 7.6: Seed DB after e2e reset**

Run:

```bash
npm.cmd run db:seed --workspace=backend
```

Expected output includes:

```text
admin@example.com
instructor@example.com
student@example.com
student2@example.com
```

- [x] **Step 7.7: Mark this plan complete**

All remaining plan checkboxes were marked complete after Steps 7.3-7.6 passed.

- [x] **Step 7.8: Commit**

```bash
git add backend/prisma/seed.ts README.md docs/superpowers/plans/2026-08-27-lms-realtime-p3-realtime-async.md
git commit -m "docs(plan): complete p3 realtime async"
```

---

## P3 Acceptance Checklist

- [x] `/api/docs` serves Swagger UI for backend REST APIs.
- [x] `/api/docs-json` includes `Auth`, `Courses`, `Users`, `Lessons`, `Sessions`, and `Quizzes` REST paths.
- [x] Swagger includes JWT bearer auth scheme named `access-token`.
- [x] `@lms/shared` exports realtime and notification payload contracts.
- [x] Backend validates `REDIS_URL`, `BREVO_API_KEY`, `EMAIL_FROM`, and `NOTIFICATIONS_MOCK_MODE`.
- [x] NestJS uses Redis-backed Socket.IO adapter.
- [x] WebSocket connection rejects missing/invalid JWT.
- [x] `/sessions` namespace allows only instructors/admins or enrolled students into live sessions.
- [x] `session:join` joins room `session:<id>` and emits `session:state`.
- [x] `chat:send` validates content, persists `ChatMessage`, and broadcasts `chat:message`.
- [x] REST `sessions/:id/start` and `sessions/:id/end` broadcast `session:state`.
- [x] Quiz run REST control endpoints open/close/reveal/finish questions.
- [x] `quiz:question` never exposes `correctOptionId`.
- [x] `/quiz` namespace allows only users who can view the session.
- [x] `quiz:answer` persists one answer per `(runId, questionId, userId)`.
- [x] Duplicate quiz answers return `QUIZ_ALREADY_ANSWERED`.
- [x] Quiz score follows the spec formula.
- [x] Redis leaderboard emits top 10 entries with rank.
- [x] `/notifications` namespace joins `user:<id>`.
- [x] `GET /api/me/notifications` lists current user's notifications.
- [x] `PATCH /api/me/notifications/:id/read` marks only current user's notification as read.
- [x] Course publish enqueues BullMQ `course-published`.
- [x] Notification worker runs in mock mode without Brevo API key.
- [x] Notification worker inserts in-app notifications and emits `notification:new`.
- [x] All backend e2e tests pass.
- [x] Backend and frontend builds pass.
- [x] Frontend smoke tests pass.

## Out of Scope for P3

- MinIO presigned upload endpoints.
- Lesson video playback and presigned playback URLs.
- `progress:heartbeat`, progress Redis debounce, and BullMQ progress flush.
- Frontend auth/course/session/realtime UI.
- Playwright browser e2e.
- Production Docker images and GitHub Actions.
- Real Brevo API integration beyond mock-mode compatible worker structure.

## Suggested Next Plans

- **P3b Media & Progress Backend:** MinIO upload/complete/playback, lesson progress REST, `progress:heartbeat`, Redis debounce, BullMQ flush.
- **P4 Frontend Product UI:** Auth screens, protected routes, courses/lessons/session live UI, chat panel, quiz panel, leaderboard panel, notifications panel.
- **P5 Docker & CI:** Production Dockerfiles, Nginx reverse proxy with WS upgrade, GitHub Actions test/build matrix.

## Self-Review

- [x] **Spec coverage:** This plan covers the P3 roadmap items for WebSocket gateways (`/sessions`, `/quiz`, `/notifications`), BullMQ producer/worker, mock email mode, chat, quiz answer flow, scoring, leaderboard, and in-app notifications.
- [x] **Scope control:** Media upload and progress heartbeat are intentionally split out because they add MinIO and debounced persistence workflows that can be tested independently.
- [x] **Placeholder scan:** No `TBD`, `TODO`, empty "implement later" markers, or deferred test fixture comments remain.
- [x] **Type consistency:** Event names, room names, env names, and shared payload interfaces match the design spec and P2 module names.
- [x] **Verification discipline:** Every implementation task ends with a focused test command, backend build, and commit.

# LMS Realtime — Phase 1 Infra & Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khởi tạo monorepo lms-realtime với 3 package (backend NestJS + frontend Vite/React + shared types), docker-compose.infra.yml 3 service (postgres + redis + minio), scripts dev hoạt động đầu cuối.

**Architecture:** Monorepo npm workspaces. Backend NestJS 10 monolith (port 4000). Frontend Vite + React 18 (port 5173, proxy /api → backend). Shared package `@lms/shared` chứa types dùng chung BE-FE (pure TypeScript, không build step). Infra local 3 service trong docker-compose, không có RabbitMQ (BullMQ chạy trên Redis trong phase 3).

**Tech Stack:**
- Node.js 20+, npm 10+ (workspaces)
- NestJS 10, TypeScript 5
- Vite 5, React 18, TanStack Query 5, Zustand 4
- PostgreSQL 16, Redis 7, MinIO (S3-compatible)
- Jest + supertest (BE), Vitest + Testing Library (FE)

**Spec:** `docs/superpowers/specs/2026-08-26-lms-realtime-design.md`

## Global Constraints

- **Ports (đồng nhất to bộ config):** BE `4000`, FE `5173`, Postgres `5432`, Redis `6379`, MinIO `9000` (API) + `9001` (console).
- **Credentials dev:** Postgres user/password/db = `lms / lms_dev_password / lms`. Redis không password. MinIO root user/password = `lms / lms_dev_password`.
- **Container names:** `lms-postgres`, `lms-redis`, `lms-minio`. Không có `lms-rabbitmq`.
- **Tất cả biến môi trường** đặt trong `.env.example` tại mỗi app; fail fast lúc startup nếu thiếu.
- **Ngôn ngữ UI mặc định:** Tiếng Việt.
- **Code style:** immutability, không mutation, file <800 dòng, hàm <50 dòng, error handling tường minh.
- **Commit format:** Conventional Commits (`feat:`, `chore:`, `test:`, `docs:`).

---

## File Structure (toàn P1)

```
lms/                                          # root monorepo
├── package.json                              # workspaces + scripts dev
├── tsconfig.base.json                        # TS config chung
├── .gitignore
├── README.md                                 # quickstart (sẽ nở rộng ở phase sau)
├── .env.example                              # root-level reference
├── docker-compose.infra.yml                  # 3 service: postgres + redis + minio
├── shared/                                   # package @lms/shared
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts
│       └── health.ts                         # HealthResponse type
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.build.json
│   ├── nest-cli.json
│   ├── eslint.config.mjs
│   ├── .prettierrc
│   ├── .env.example
│   ├── .gitignore
│   ├── Dockerfile                            # multi-stage prod (skeleton, build đầy đủ phase 5)
│   ├── Dockerfile.dev                        # dev với hot reload
│   ├── src/
│   │   ├── main.ts                           # bootstrap port 4000, ValidationPipe, CORS
│   │   ├── app.module.ts
│   │   ├── health/
│   │   │   ├── health.module.ts
│   │   │   └── health.controller.ts          # GET /health (không prefix /api, dùng nội bộ)
│   │   └── common/
│   │       └── filters/
│   │           └── all-exceptions.filter.ts  # skeleton, sẽ implement phase 2
│   └── test/
│       ├── app.e2e-spec.ts                   # e2e health check
│       └── jest-e2e.json
└── frontend/
    ├── package.json
    ├── tsconfig.json
    ├── tsconfig.node.json
    ├── vite.config.ts                        # port 5173, proxy /api → http://localhost:4000
    ├── index.html
    ├── eslint.config.js
    ├── .prettierrc
    ├── .env.example
    ├── .gitignore
    ├── Dockerfile                            # nginx serve, skeleton phase 5
    ├── nginx.conf                            # skeleton phase 5
    └── src/
        ├── main.tsx
        ├── App.tsx                           # header + nút "Check /api/health"
        ├── api/
        │   └── client.ts                     # axios instance + interceptor skeleton
        ├── lib/
        │   └── socket.ts                     # skeleton (socket.io-client, implement phase 3)
        ├── store/                            # zustand (chưa có store, skeleton)
        └── test/
            └── setup.ts                      # vitest setup
```

---

## Task 1: Khởi tạo monorepo root + npm workspaces

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `README.md`
- Create: `tsconfig.base.json`

**Interfaces:**
- Produces: workspaces có 3 folder (`backend`, `frontend`, `shared`); từ root có thể chạy `npm install` để cài cho cả 3.

- [ ] **Step 1.1: Tạo file `.gitignore` ở root**

```gitignore
# Node
node_modules/
dist/
build/
coverage/
.nyc_output/

# Env
.env
.env.local
.env.*.local

# Logs
*.log
npm-debug.log*

# IDE
.idea/
.vscode/
*.swp

# OS
.DS_Store
Thumbs.db

# Prisma
backend/prisma/migrations/dev.db*
```

- [ ] **Step 1.2: Tạo `tsconfig.base.json` ở root**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true,
    "moduleResolution": "node",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "incremental": true
  }
}
```

- [ ] **Step 1.3: Tạo `package.json` ở root**

```json
{
  "name": "lms-realtime",
  "version": "0.1.0",
  "private": true,
  "workspaces": [
    "backend",
    "frontend",
    "shared"
  ],
  "scripts": {
    "infra:up": "docker compose -f docker-compose.infra.yml up -d",
    "infra:down": "docker compose -f docker-compose.infra.yml down",
    "infra:logs": "docker compose -f docker-compose.infra.yml logs -f",
    "dev:backend": "npm run start:dev --workspace=backend",
    "dev:frontend": "npm run dev --workspace=frontend",
    "dev": "npm-run-all --parallel dev:backend dev:frontend",
    "build:backend": "npm run build --workspace=backend",
    "build:frontend": "npm run build --workspace=frontend",
    "build": "npm run build:backend && npm run build:frontend",
    "test:backend": "npm run test --workspace=backend",
    "test:frontend": "npm run test --workspace=frontend",
    "test": "npm run test:backend && npm run test:frontend",
    "lint": "npm run lint --workspaces --if-present"
  },
  "devDependencies": {
    "npm-run-all": "^4.1.5"
  },
  "engines": {
    "node": ">=20.0.0",
    "npm": ">=10.0.0"
  }
}
```

- [ ] **Step 1.4: Tạo `README.md` skeleton ở root**

```markdown
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
```

- [ ] **Step 1.5: Verify root workspaces**

Chạy: `npm install`
Expected: `node_modules/` được tạo ở root (chưa có workspace con nên không cài gì thêm), exit code 0, không có error về missing scripts.

- [ ] **Step 1.6: Commit**

```bash
git init
git add .
git commit -m "chore: init monorepo root with npm workspaces"
```

---

## Task 2: Package `@lms/shared` (pure types)

**Files:**
- Create: `shared/package.json`
- Create: `shared/tsconfig.json`
- Create: `shared/src/index.ts`
- Create: `shared/src/health.ts`

**Interfaces:**
- Produces: import `@lms/shared` resolved thông qua npm workspaces; types trong `shared/src/*.ts` available ở cả BE và FE.

- [ ] **Step 2.1: Tạo `shared/package.json`**

```json
{
  "name": "@lms/shared",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

> Pure TS package, không build step. Vite và NestJS (ts-node) đều consume TS trực tiếp qua workspace symlink.

- [ ] **Step 2.2: Tạo `shared/tsconfig.json`**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "experimentalDecorators": false,
    "emitDecoratorMetadata": false,
    "declaration": true
  },
  "include": ["src/**/*"]
```

- [ ] **Step 2.3: Tạo `shared/src/health.ts`**

```typescript
export interface HealthResponse {
  status: 'ok' | 'degraded';
  uptimeSeconds: number;
  timestamp: string;
}

export const HEALTH_RESPONSE_DEFAULT: HealthResponse = {
  status: 'ok',
  uptimeSeconds: 0,
  timestamp: new Date(0).toISOString(),
};
```

- [ ] **Step 2.4: Tạo `shared/src/index.ts`**

```typescript
export * from './health';
```

- [ ] **Step 2.5: Cài dependency cho shared**

Chạy: `cd shared && npm install --save-dev typescript@^5.4.0`
Expected: `shared/node_modules/` chứa TypeScript. Không error.

- [ ] **Step 2.6: Verify typecheck**

Chạy: `npm run typecheck --workspace=shared`
Expected: exit code 0, không có TS error.

- [ ] **Step 2.7: Commit**

```bash
git add shared/
git commit -m "feat(shared): init @lms/shared types package"
```

---

## Task 3: Backend NestJS scaffold + Health endpoint + e2e test

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/tsconfig.build.json`
- Create: `backend/nest-cli.json`
- Create: `backend/eslint.config.mjs`
- Create: `backend/.prettierrc`
- Create: `backend/.env.example`
- Create: `backend/.gitignore`
- Create: `backend/src/main.ts`
- Create: `backend/src/app.module.ts`
- Create: `backend/src/health/health.module.ts`
- Create: `backend/src/health/health.controller.ts`
- Create: `backend/src/common/filters/all-exceptions.filter.ts`
- Create: `backend/test/app.e2e-spec.ts`
- Create: `backend/test/jest-e2e.json`

**Interfaces:**
- Consumes: `@lms/shared` (HealthResponse type).
- Produces: `GET http://localhost:4000/health` returns `{status: 'ok', uptimeSeconds, timestamp}` envelope `{success: true, data, error, meta}`. Lỗi được trả về envelope thống nhất.

- [ ] **Step 3.1: Tạo `backend/package.json`**

```json
{
  "name": "@lms/backend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:prod": "node dist/main",
    "lint": "eslint \"{src,test}/**/*.ts\"",
    "format": "prettier --write \"{src,test}/**/*.ts\"",
    "test": "jest",
    "test:e2e": "jest --config ./test/jest-e2e.json"
  },
  "dependencies": {
    "@lms/shared": "*",
    "@nestjs/common": "^10.3.0",
    "@nestjs/core": "^10.3.0",
    "@nestjs/platform-express": "^10.3.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.1",
    "reflect-metadata": "^0.2.1",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.3.0",
    "@nestjs/schematics": "^10.1.0",
    "@nestjs/testing": "^10.3.0",
    "@types/express": "^4.17.21",
    "@types/jest": "^29.5.12",
    "@types/node": "^20.11.0",
    "@types/supertest": "^6.0.2",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "eslint": "^8.57.0",
    "eslint-config-prettier": "^9.1.0",
    "eslint-plugin-prettier": "^5.1.3",
    "jest": "^29.7.0",
    "prettier": "^3.2.5",
    "source-map-support": "^0.5.21",
    "supertest": "^6.3.4",
    "ts-jest": "^29.1.2",
    "ts-loader": "^9.5.1",
    "ts-node": "^10.9.2",
    "tsconfig-paths": "^4.2.0",
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 3.2: Tạo `backend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2022",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strict": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "strictBindCallApply": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*", "test/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3.3: Tạo `backend/tsconfig.build.json`**

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "test", "dist", "**/*spec.ts"]
}
```

- [ ] **Step 3.4: Tạo `backend/nest-cli.json`**

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true
  }
}
```

- [ ] **Step 3.5: Tạo `backend/eslint.config.mjs`** (flat config — Nest 10 compatible)

```mjs
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import prettier from 'eslint-plugin-prettier';

export default [
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: 'tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      prettier,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      'prettier/prettier': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
];
```

- [ ] **Step 3.6: Tạo `backend/.prettierrc`**

```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "semi": true,
  "endOfLine": "lf"
}
```

- [ ] **Step 3.7: Tạo `backend/.env.example`**

```dotenv
PORT=4000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
LOG_LEVEL=debug

# Phase 2 sẽ thêm:
# DATABASE_URL=
# REDIS_URL=
# JWT_ACCESS_SECRET=
# JWT_REFRESH_SECRET=
# MINIO_*
# BREVO_API_KEY=
```

- [ ] **Step 3.8: Tạo `backend/.gitignore`**

```gitignore
node_modules/
dist/
coverage/
.env
.env.local
*.log
.DS_Store
prisma/migrations/dev.db*
```

- [ ] **Step 3.9: Tạo `backend/src/main.ts`**

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT ?? 4000);
  const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:5173';

  app.enableCors({
    origin: corsOrigin.split(',').map((s) => s.trim()),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.listen(port);
  Logger.log(`Backend listening on http://localhost:${port}`, 'Bootstrap');
}

bootstrap();
```

- [ ] **Step 3.10: Tạo `backend/src/app.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';

@Module({
  imports: [HealthModule],
})
export class AppModule {}
```

- [ ] **Step 3.11: Tạo `backend/src/health/health.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
```

- [ ] **Step 3.12: Tạo `backend/src/health/health.controller.ts`**

```typescript
import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@lms/shared';

@Controller('health')
export class HealthController {
  private readonly startedAt = Date.now();

  @Get()
  check(): HealthResponse {
    return {
      status: 'ok',
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      timestamp: new Date().toISOString(),
    };
  }
}
```

- [ ] **Step 3.13: Tạo `backend/src/common/filters/all-exceptions.filter.ts` (skeleton)**

```typescript
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const code =
      exception instanceof HttpException
        ? this.mapHttpStatusToCode(status)
        : 'INTERNAL_ERROR';

    const message =
      exception instanceof HttpException
        ? exception.message
        : 'Lỗi máy chủ nội bộ';

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      success: false,
      data: null,
      error: { code, message },
      meta: null,
    });
  }

  private mapHttpStatusToCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'VALIDATION_FAILED';
      case HttpStatus.UNAUTHORIZED:
        return 'AUTH_UNAUTHENTICATED';
      case HttpStatus.FORBIDDEN:
        return 'AUTH_FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      default:
        return `HTTP_${status}`;
    }
  }
}
```

> Skeleton cho envelope thống nhất. Phase 2 sẽ map Prisma errors + custom codes.

- [ ] **Step 3.14: Tạo `backend/test/jest-e2e.json`**

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  "moduleNameMapper": {
    "^@lms/shared$": "<rootDir>/../shared/src"
  }
}
```

- [ ] **Step 3.15: Tạo `backend/test/app.e2e-spec.ts`** (đây là test — phải viết trước khi verify)

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

describe('Health endpoint (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /health returns 200 with {success: true, data: {status: "ok"}}', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.data.status).toBe('ok');
        expect(typeof res.body.data.uptimeSeconds).toBe('number');
        expect(typeof res.body.data.timestamp).toBe('string');
        expect(res.body.error).toBeNull();
      });
  });

  it('GET /health returns envelope shape with meta=null', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('success');
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('error');
        expect(res.body).toHaveProperty('meta');
      });
  });

  it('GET /unknown returns 404 with envelope error', () => {
    return request(app.getHttpServer())
      .get('/unknown')
      .expect(404)
      .expect((res) => {
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('NOT_FOUND');
        expect(res.body.data).toBeNull();
      });
  });
});
```

- [ ] **Step 3.16: Cài dependencies cho workspace**

Chạy: `cd backend && npm install` (chạy ở root cũng được: `npm install`)
Expected: Backend và shared đều có `node_modules/`. Không có peer-dep error chặn.

- [ ] **Step 3.17: Verify e2e test passes**

Chạy: `npm run test:e2e --workspace=backend`
Expected: 3 tests pass (`PASS test/app.e2e-spec.ts`). Exit code 0.

Nếu fail, debug phổ biến:
- `@lms/shared` không resolve → check `shared/src/index.ts` tồn tại và `"main"` trong `shared/package.json` đúng.
- ValidationPipe lỗi → đảm bảo `transform: true`.

- [ ] **Step 3.18: Verify backend dev server chạy được**

Chạy: `npm run dev:backend`
Expected: log `Backend listening on http://localhost:4000`. Mở browser hoặc curl `http://localhost:4000/health` → trả JSON envelope. Ctrl+C để dừng.

- [ ] **Step 3.19: Commit**

```bash
git add backend/ shared/package.json shared/tsconfig.json
git commit -m "feat(backend): nestjs scaffold with health endpoint and e2e test"
```

---

## Task 4: Frontend Vite scaffold + Health button + Vitest smoke test

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tsconfig.node.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/index.html`
- Create: `frontend/eslint.config.js`
- Create: `frontend/.prettierrc`
- Create: `frontend/.env.example`
- Create: `frontend/.gitignore`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/test/setup.ts`
- Create: `frontend/src/App.test.tsx`

**Interfaces:**
- Consumes: `GET /api/health` (Vite proxy → `http://localhost:4000/health`).
- Produces: UI render ở `http://localhost:5173` với header + kết quả health check (ban đầu `null`, sau khi bấm nút sẽ hiển thị status).

- [ ] **Step 4.1: Tạo `frontend/package.json`**

```json
{
  "name": "@lms/frontend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint .",
    "format": "prettier --write \"src/**/*.{ts,tsx}\"",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@lms/shared": "*",
    "@tanstack/react-query": "^5.28.0",
    "axios": "^1.6.8",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "socket.io-client": "^4.7.5",
    "zustand": "^4.5.2"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.2",
    "@testing-library/react": "^14.2.1",
    "@types/react": "^18.2.66",
    "@types/react-dom": "^18.2.22",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "@vitejs/plugin-react": "^4.2.1",
    "eslint": "^8.57.0",
    "eslint-config-prettier": "^9.1.0",
    "eslint-plugin-prettier": "^5.1.3",
    "eslint-plugin-react": "^7.34.0",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-react-refresh": "^0.4.5",
    "jsdom": "^24.0.0",
    "prettier": "^3.2.5",
    "typescript": "^5.4.0",
    "vite": "^5.2.0",
    "vitest": "^1.4.0"
  }
}
```

- [ ] **Step 4.2: Tạo `frontend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 4.3: Tạo `frontend/tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4.4: Tạo `frontend/vite.config.ts`**

```typescript
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/socket.io': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

- [ ] **Step 4.5: Tạo `frontend/index.html`**

```html
<!doctype html>
<html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LMS Realtime</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4.6: Tạo `frontend/eslint.config.js`** (flat config)

```js
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import prettier from 'eslint-plugin-prettier';

export default [
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      prettier,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'prettier/prettier': 'error',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
];
```

- [ ] **Step 4.7: Tạo `frontend/.prettierrc`**

```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "semi": true
}
```

- [ ] **Step 4.8: Tạo `frontend/.env.example`**

```dotenv
VITE_API_BASE_URL=/api
VITE_SOCKET_URL=http://localhost:4000
```

- [ ] **Step 4.9: Tạo `frontend/.gitignore`**

```gitignore
node_modules/
dist/
dist-ssr/
*.local
.env
.env.local
*.log
.DS_Store
coverage/
```

- [ ] **Step 4.10: Tạo `frontend/src/main.tsx`**

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
```

- [ ] **Step 4.11: Tạo `frontend/src/api/client.ts`**

```typescript
import axios from 'axios';
import type { HealthResponse } from '@lms/shared';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? '/api';

export const apiClient = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 10_000,
});

interface Envelope<T> {
  success: boolean;
  data: T;
  error: null | { code: string; message: string };
  meta: unknown;
}

export async function checkHealth(): Promise<HealthResponse> {
  const res = await apiClient.get<Envelope<HealthResponse>>('/health');
  if (!res.data.success) {
    throw new Error(res.data.error?.message ?? 'Health check failed');
  }
  return res.data.data;
}
```

- [ ] **Step 4.12: Tạo `frontend/src/App.tsx`**

```typescript
import { useState } from 'react';
import { checkHealth } from './api/client';
import type { HealthResponse } from '@lms/shared';

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCheck() {
    setLoading(true);
    setError(null);
    try {
      const data = await checkHealth();
      setHealth(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi không xác định');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ fontFamily: 'system-ui', padding: 24, maxWidth: 640 }}>
      <h1>LMS Realtime</h1>
      <p>Scaffold P1 — đang chờ phase 2+</p>
      <button onClick={onCheck} disabled={loading} data-testid="check-health">
        {loading ? 'Đang kiểm tra...' : 'Kiểm tra backend /health'}
      </button>
      {health && (
        <pre data-testid="health-result">
          {JSON.stringify(health, null, 2)}
        </pre>
      )}
      {error && <p style={{ color: 'crimson' }}>Lỗi: {error}</p>}
    </main>
  );
}
```

- [ ] **Step 4.13: Tạo `frontend/src/test/setup.ts`**

```typescript
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 4.14: Tạo `frontend/src/App.test.tsx`** (test — viết trước khi verify)

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders heading and check button', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /LMS Realtime/i })).toBeInTheDocument();
    expect(screen.getByTestId('check-health')).toBeInTheDocument();
    expect(screen.getByTestId('check-health')).toHaveTextContent(/Kiểm tra backend/i);
  });

  it('does not show health result before clicking', () => {
    render(<App />);
    expect(screen.queryByTestId('health-result')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 4.15: Cài deps**

Chạy: `cd frontend && npm install`
Expected: install thành công. Không có error về peer deps chặn.

- [ ] **Step 4.16: Verify Vitest smoke test passes**

Chạy: `npm run test --workspace=frontend`
Expected: 2 tests pass. Exit code 0.

Nếu fail về module `@lms/shared` → check `shared/package.json` `"main"` trỏ đúng `./src/index.ts` và `npm install` đã link workspace.

- [ ] **Step 4.17: Verify FE build (TS check)**

Chạy: `npm run build --workspace=frontend`
Expected: `dist/` được tạo, không có TS error.

- [ ] **Step 4.18: Verify FE dev server chạy**

Chạy: `npm run dev:frontend`
Expected: log `Local: http://localhost:5173/`. Mở browser, thấy heading "LMS Realtime" + nút "Kiểm tra backend". Ctrl+C để dừng.

- [ ] **Step 4.19: Commit**

```bash
git add frontend/
git commit -m "feat(frontend): vite scaffold with health button and vitest smoke test"
```

---

## Task 5: Docker compose infra — postgres + redis + minio

**Files:**
- Create: `docker-compose.infra.yml`
- Create: `.env.example` ở root

**Interfaces:**
- Produces: 3 container chạy local với healthcheck; BE Phase 2+ sẽ kết nối các service này.

- [ ] **Step 5.1: Tạo `docker-compose.infra.yml` ở root**

```yaml
name: lms-dev

services:
  postgres:
    image: postgres:16-alpine
    container_name: lms-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: lms
      POSTGRES_PASSWORD: lms_dev_password
      POSTGRES_DB: lms
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U lms -d lms"]
      interval: 5s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    container_name: lms-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 10

  minio:
    image: minio/minio:latest
    container_name: lms-minio
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: lms
      MINIO_ROOT_PASSWORD: lms_dev_password
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 10s
      timeout: 5s
      retries: 10

volumes:
  postgres_data:
  redis_data:
  minio_data:
```

> **Quan trọng:** KHÔNG có service `rabbitmq` (đã quyết định trong spec, BullMQ chạy trên Redis).

- [ ] **Step 5.2: Tạo `.env.example` ở root**

```dotenv
# Chỉ chứa tham chiếu. Các app đọc env của riêng chúng.
# Xem backend/.env.example và frontend/.env.example

POSTGRES_USER=lms
POSTGRES_PASSWORD=lms_dev_password
POSTGRES_DB=lms
POSTGRES_PORT=5432

REDIS_PORT=6379

MINIO_ROOT_USER=lms
MINIO_ROOT_PASSWORD=lms_dev_password
MINIO_API_PORT=9000
MINIO_CONSOLE_PORT=9001
```

- [ ] **Step 5.3: Khởi động infra và verify healthcheck**

Chạy: `docker compose -f docker-compose.infra.yml up -d`
Expected: 3 container được tạo (`lms-postgres`, `lms-redis`, `lms-minio`).

Đợi 10-15 giây rồi kiểm tra:

```bash
docker compose -f docker-compose.infra.yml ps
```

Expected: cả 3 service status `(healthy)`.

Nếu MinIO unhealthy do `mc` không có sẵn trong image `minio/minio:latest` — đổi healthcheck thành:

```yaml
healthcheck:
  test: ["CMD-SHELL", "curl -f http://localhost:9000/minio/health/live || exit 1"]
  interval: 10s
  timeout: 5s
  retries: 10
```

(`minio/minio` image có `curl` builtin. `mc` chỉ có trong `minio/mc` image riêng.)

- [ ] **Step 5.4: Verify thủ công từng service**

```bash
# Postgres
docker exec lms-postgres psql -U lms -d lms -c "SELECT 1;"
# Expected: "1" row

# Redis
docker exec lms-redis redis-cli ping
# Expected: PONG

# MinIO
curl -sf http://localhost:9000/minio/health/live -o /dev/null && echo "MinIO OK"
# Expected: "MinIO OK"
```

Nếu fail: xem logs `docker compose -f docker-compose.infra.yml logs <service>`.

- [ ] **Step 5.5: Commit**

```bash
git add docker-compose.infra.yml .env.example
git commit -m "feat(infra): docker compose for postgres, redis, minio (no rabbitmq)"
```

---

## Task 6: Verify end-to-end full stack

**Goal:** Tất cả 4 service chạy cùng lúc: infra (postgres + redis + minio) + backend (4000) + frontend (5173). Health check end-to-end từ browser tới backend qua Vite proxy.

- [ ] **Step 6.1: Đảm bảo infra đang chạy**

Chạy: `npm run infra:up`
Expected: 3 service `(healthy)`.

- [ ] **Step 6.2: Chạy đồng thời backend + frontend**

Mở 2 terminal (PowerShell ở Windows):

```bash
# Terminal 1
npm run dev:backend
# Expected: log "Backend listening on http://localhost:4000"

# Terminal 2
npm run dev:frontend
# Expected: log "Local: http://localhost:5173/"
```

Hoặc 1 terminal dùng script combined:

```bash
npm run dev
# Expected: chạy song song cả BE và FE
```

- [ ] **Step 6.3: Verify backend health endpoint**

```bash
curl -s http://localhost:4000/health | jq
```

Expected output:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "uptimeSeconds": 3,
    "timestamp": "2026-08-26T..."
  },
  "error": null,
  "meta": null
}
```

- [ ] **Step 6.4: Verify FE proxy tới BE**

```bash
curl -s http://localhost:5173/api/health | jq
```

Expected: cùng envelope như trên.

Nếu fail: kiểm tra `frontend/vite.config.ts` đã có proxy config `/api` → `http://localhost:4000`.

- [ ] **Step 6.5: Verify browser**

Mở `http://localhost:5173/` trong browser:
- Thấy heading "LMS Realtime"
- Click nút "Kiểm tra backend /health"
- Thấy JSON hiển thị với `status: "ok"`

- [ ] **Step 6.6: Verify MinIO console**

Mở `http://localhost:9001/`:
- Đăng nhập với `lms` / `lms_dev_password`
- Thấy giao diện MinIO (chưa có bucket nào)

- [ ] **Step 6.7: Stop tất cả**

```bash
# Ctrl+C ở terminal chạy `npm run dev`
npm run infra:down
# (optional: docker compose -f docker-compose.infra.yml down -v để xóa volumes)
```

- [ ] **Step 6.8: Final commit (nếu có fix)**

Nếu có chỉnh sửa trong task 6 (ví dụ healthcheck MinIO đổi từ `mc` sang `curl`):

```bash
git add .
git commit -m "chore(infra): adjust minio healthcheck to use curl"
```

Nếu không có gì thay đổi → bỏ qua step này.

---

## Self-Review (cần làm sau khi viết xong toàn plan)

- [ ] **Spec coverage:** Plan P1 chỉ implement phần scaffold, không đụng logic nghiệp vụ (auth, quiz, chat). Các phase P2-P5 sẽ có plan riêng. OK.
- [ ] **Placeholder scan:** Không có TBD/TODO. Tất cả code blocks đầy đủ.
- [ ] **Type consistency:** `HealthResponse` định nghĩa ở `shared/src/health.ts` dùng xuyên suốt (BE health.controller, FE api/client, FE App). Không có function nào gọi với signature khác.
- [ ] **Port consistency:** 4000, 5173, 5432, 6379, 9000, 9001 nhất quán trong `.env.example`, `vite.config.ts`, `main.ts`, `docker-compose.infra.yml`.
- [ ] **Test coverage:** BE có 3 e2e tests, FE có 2 unit tests. Phase 2 sẽ thêm khi có business logic.
- [ ] **Cross-platform:** Tất cả lệnh dùng `npm` / `docker` / `git` — hoạt động trên cả PowerShell (Windows) và bash (Git Bash).
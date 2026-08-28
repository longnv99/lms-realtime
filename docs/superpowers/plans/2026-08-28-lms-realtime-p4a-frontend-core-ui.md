# LMS Realtime P4a Frontend Core UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the usable frontend product UI for the APIs completed through P3: auth, protected app shell, course/lesson/session views, live chat, realtime quiz, and notifications.

**Architecture:** Keep the existing Vite + React + TypeScript app. Add React Router for page flow, TanStack Query for server state, Zustand for auth/realtime UI state, a typed API client around the existing envelope, and Socket.IO hooks typed with `@lms/shared`. P4a intentionally skips video upload and lesson progress because the backend media/progress endpoints are still out of scope until P3b.

**Tech Stack:** Vite 5, React 18, TypeScript strict mode, React Router, TanStack Query, Zustand, Axios, Socket.IO client, CSS custom properties, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-26-lms-realtime-design.md`

## Taste Skill Read

Taste Skill was referenced from https://www.tasteskill.dev/ and https://github.com/Leonxlnx/taste-skill. Its main install name is `design-taste-frontend`; the repo also lists `gpt-taste`, `redesign-existing-projects`, `minimalist-ui`, and `high-end-visual-design` as related variants. The core `design-taste-frontend` skill itself says it is for landing pages, portfolios, and redesigns, not dashboards or multi-step product UI, so use it as an anti-generic design checklist rather than as a dashboard recipe.

- Reading this as: product dashboard for LMS instructors and students, with a serious educational SaaS language, leaning toward native CSS tokens plus accessible React components.
- `DESIGN_VARIANCE=4`: clear structure and predictable app navigation beat decorative experimentation.
- `MOTION_INTENSITY=3`: small route/panel transitions only; realtime updates should feel calm.
- `VISUAL_DENSITY=7`: compact dashboard density for repeated study/teaching workflows.
- Avoid AI-purple gradients, centered landing heroes, generic card grids, placeholder screenshots, emoji UI, and visible instructional copy.
- Use light/dark mode parity, label-above-input forms, real loading/empty/error states, keyboard focus rings, and WCAG AA contrast.
- Use `lucide-react` for icons because the project-level frontend instruction requires lucide icons in buttons when available.
- Apply Taste Skill's "brief inference first" rule before each page group: audience, workflow pressure, role context, and quiet constraints decide layout.
- Apply its "three dials" as page-specific variables in implementation notes when a page differs from the plan default.
- Apply its dashboard-relevant rules: no generic card sprawl, no placeholder-as-label forms, no circular spinner-only loading states, no unreadable ghost buttons, no duplicated CTA intent, and no desktop nav wrapping.
- Treat the existing P1 health-check screen as an audit target: preserve only the useful backend health concept as a small status chip, then replace the scaffold visual language entirely.

## Global Constraints

- Frontend dev port is `5173`; backend dev port is `4000`.
- API base URL defaults to `/api`; local Vite proxy points `/api` and `/socket.io` to `http://localhost:4000`.
- REST responses use envelope `{ success, data, error, meta }`.
- Auth uses `POST /api/auth/login`, `/register`, `/refresh`, `/logout`; access token is sent as `Authorization: Bearer <token>`.
- WebSocket auth token comes from `handshake.auth.token`.
- Socket.IO namespaces: `/sessions`, `/quiz`, `/notifications`.
- Room conventions remain backend-owned: `session:<sessionId>`, `quiz-run:<quizRunId>`, `user:<userId>`.
- Use shared contracts from `@lms/shared`; do not redefine realtime payload shapes in frontend.
- Do not build video upload/playback/progress UI beyond disabled placeholders until P3b backend exists.
- Do not add Playwright in P4a unless the user explicitly expands scope; P4a verification is Vitest + build + local smoke.
- Every implementation task ends with `npm.cmd run test:frontend`, `npm.cmd run build:frontend`, and a commit.

---

## File Structure

P4a creates or modifies these areas:

```text
frontend/
  package.json
  src/
    main.tsx
    App.tsx
    App.test.tsx
    api/
      client.ts
      auth.ts
      courses.ts
      lessons.ts
      sessions.ts
      quizzes.ts
      notifications.ts
    app/
      AppProviders.tsx
      routes.tsx
    components/
      Button.tsx
      EmptyState.tsx
      Field.tsx
      LoadingBlock.tsx
      StatusBadge.tsx
      ToastProvider.tsx
    features/
      auth/
        auth.store.ts
        LoginPage.tsx
        RegisterPage.tsx
        ProtectedRoute.tsx
      courses/
        CoursesPage.tsx
        CourseDetailPage.tsx
        CourseEditorPanel.tsx
      lessons/
        LessonsPanel.tsx
      sessions/
        SessionsPanel.tsx
        LiveSessionPage.tsx
        ChatPanel.tsx
      quizzes/
        QuizPanel.tsx
        QuizInstructorControls.tsx
        QuizStudentAnswerGrid.tsx
        LeaderboardPanel.tsx
      notifications/
        NotificationsButton.tsx
        NotificationsDrawer.tsx
    lib/
      queryClient.ts
      realtime.ts
      dates.ts
      errors.ts
    styles/
      global.css
      tokens.css
```

---

### Task 1: Frontend App Foundation, Routing, and Design Tokens

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/src/main.tsx`
- Replace: `frontend/src/App.tsx`
- Modify: `frontend/src/App.test.tsx`
- Create: `frontend/src/app/AppProviders.tsx`
- Create: `frontend/src/app/routes.tsx`
- Create: `frontend/src/components/Button.tsx`
- Create: `frontend/src/components/EmptyState.tsx`
- Create: `frontend/src/components/Field.tsx`
- Create: `frontend/src/components/LoadingBlock.tsx`
- Create: `frontend/src/components/StatusBadge.tsx`
- Create: `frontend/src/components/ToastProvider.tsx`
- Create: `frontend/src/lib/queryClient.ts`
- Create: `frontend/src/styles/tokens.css`
- Create: `frontend/src/styles/global.css`

**Interfaces:**
- Produces: `AppProviders`, `AppRoutes`, `Button`, `Field`, `StatusBadge`, `LoadingBlock`, `EmptyState`, `useToast`.
- Consumes: existing `checkHealth()` temporarily only for a backend status chip.

- [x] **Step 1.1: Install UI routing dependencies**

Run:

```bash
npm.cmd install --workspace=frontend react-router-dom lucide-react @fontsource-variable/outfit @fontsource/jetbrains-mono
npm.cmd install --workspace=frontend --save-dev @testing-library/user-event
```

Expected: `frontend/package.json` and root `package-lock.json` update.

- [x] **Step 1.2: Write foundation smoke tests**

Replace `frontend/src/App.test.tsx` with:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App shell', () => {
  it('renders the product shell and auth entry route', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /LMS Realtime/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dang nhap/i })).toBeInTheDocument();
  });
});
```

- [x] **Step 1.3: Run test to verify current app fails**

Run:

```bash
npm.cmd run test:frontend
```

Expected: FAIL because the current app still renders the old health-check scaffold and no app shell button.

- [x] **Step 1.4: Add CSS tokens and global app styling**

Create `frontend/src/styles/tokens.css`:

```css
:root {
  color-scheme: light;
  --font-sans: "Outfit Variable", "Segoe UI", sans-serif;
  --font-mono: "JetBrains Mono", "SFMono-Regular", monospace;
  --bg: #f7f8f5;
  --surface: #ffffff;
  --surface-strong: #eff3ee;
  --text: #181c1a;
  --muted: #68736e;
  --line: #dfe6e1;
  --accent: #0f766e;
  --accent-strong: #0b4f49;
  --live: #b45309;
  --danger: #b42318;
  --radius-sm: 6px;
  --radius-md: 8px;
  --shadow-soft: 0 18px 45px rgba(25, 36, 30, 0.08);
}

[data-theme="dark"] {
  color-scheme: dark;
  --bg: #101411;
  --surface: #171d19;
  --surface-strong: #202820;
  --text: #edf4ef;
  --muted: #a7b4ad;
  --line: #2d3831;
  --accent: #5eead4;
  --accent-strong: #99f6e4;
  --live: #f59e0b;
  --danger: #f97066;
  --shadow-soft: 0 18px 45px rgba(0, 0, 0, 0.28);
}
```

Create `frontend/src/styles/global.css` with layout classes for `.app-shell`, `.sidebar`, `.topbar`, `.page`, `.panel`, `.toolbar`, `.button`, `.field`, `.badge`, `.toast-region`, responsive collapse at `768px`, and visible `:focus-visible` outlines. Import fonts and CSS in `frontend/src/main.tsx`.

- [x] **Step 1.5: Add providers and route shell**

Create `frontend/src/lib/queryClient.ts`:

```ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
```

Create `AppProviders` with `BrowserRouter`, `QueryClientProvider`, and `ToastProvider`.

Replace `App.tsx`:

```tsx
import { AppProviders } from './app/AppProviders';
import { AppRoutes } from './app/routes';

export default function App() {
  return (
    <AppProviders>
      <AppRoutes />
    </AppProviders>
  );
}
```

- [x] **Step 1.6: Run verification**

Run:

```bash
npm.cmd run test:frontend
npm.cmd run build:frontend
```

Expected: frontend test and build pass.

- [x] **Step 1.7: Commit**

```bash
git add frontend/package.json frontend/src package-lock.json
git commit -m "feat(frontend): add app shell foundation"
```

---

### Task 2: Typed API Client, Auth Store, and Token Refresh

**Files:**
- Modify: `frontend/src/api/client.ts`
- Create: `frontend/src/api/auth.ts`
- Create: `frontend/src/api/courses.ts`
- Create: `frontend/src/api/lessons.ts`
- Create: `frontend/src/api/sessions.ts`
- Create: `frontend/src/api/quizzes.ts`
- Create: `frontend/src/api/notifications.ts`
- Create: `frontend/src/features/auth/auth.store.ts`
- Create: `frontend/src/lib/errors.ts`
- Create: `frontend/src/api/client.test.ts`

**Interfaces:**
- Produces: `unwrapEnvelope<T>()`, `setAccessTokenGetter()`, typed API functions for P2/P3 endpoints.
- Produces: `useAuthStore` with `accessToken`, `refreshToken`, `user`, `loginSuccess()`, `logoutLocal()`.
- Consumes: `ApiEnvelope`, `AuthTokensResponse`, `CourseResponse`, `LessonResponse`, `SessionResponse`, `QuizRunResponse`, `NotificationResponse`.

- [x] **Step 2.1: Write API client tests**

Create `frontend/src/api/client.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { unwrapEnvelope } from './client';

describe('unwrapEnvelope', () => {
  it('returns data from successful envelopes', () => {
    expect(unwrapEnvelope({ success: true, data: { ok: true }, error: null, meta: null })).toEqual({
      ok: true,
    });
  });

  it('throws API error messages from failed envelopes', () => {
    expect(() =>
      unwrapEnvelope({
        success: false,
        data: null,
        error: { code: 'AUTH_INVALID_CREDENTIALS', message: 'Sai email/password' },
        meta: null,
      }),
    ).toThrow('Sai email/password');
  });
});
```

- [x] **Step 2.2: Implement typed envelope handling**

Modify `frontend/src/api/client.ts`:

```ts
import axios from 'axios';
import type { ApiEnvelope, HealthResponse } from '@lms/shared';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? '/api';
let accessTokenGetter: (() => string | null) | null = null;

export const apiClient = axios.create({ baseURL, withCredentials: true, timeout: 10_000 });

apiClient.interceptors.request.use((config) => {
  const token = accessTokenGetter?.();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function setAccessTokenGetter(getter: () => string | null): void {
  accessTokenGetter = getter;
}

export function unwrapEnvelope<T>(envelope: ApiEnvelope<T>): T {
  if (!envelope.success || envelope.data === null) {
    throw new Error(envelope.error?.message ?? 'Request failed');
  }
  return envelope.data;
}

export async function getEnvelope<T>(path: string): Promise<T> {
  const res = await apiClient.get<ApiEnvelope<T>>(path);
  return unwrapEnvelope(res.data);
}

export async function checkHealth(): Promise<HealthResponse> {
  return getEnvelope<HealthResponse>('/health');
}
```

- [x] **Step 2.3: Add endpoint modules**

Implement typed functions:

```ts
// frontend/src/api/auth.ts
export async function login(input: { email: string; password: string }): Promise<AuthTokensResponse>;
export async function register(input: { email: string; name: string; password: string; role: UserRole }): Promise<AuthTokensResponse>;
export async function refresh(refreshToken: string): Promise<AuthTokensResponse>;
export async function logout(refreshToken: string): Promise<void>;
```

Create similar modules for courses, lessons, sessions, quizzes, and notifications using the REST paths listed in the P3 plan and backend controllers.

- [x] **Step 2.4: Add Zustand auth store**

Create `frontend/src/features/auth/auth.store.ts`:

```ts
import { create } from 'zustand';
import type { AuthTokensResponse, AuthUserResponse } from '@lms/shared';
import { setAccessTokenGetter } from '../../api/client';

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUserResponse | null;
  loginSuccess: (tokens: AuthTokensResponse) => void;
  logoutLocal: () => void;
};

export const useAuthStore = create<AuthState>((set, get) => {
  setAccessTokenGetter(() => get().accessToken);
  return {
    accessToken: localStorage.getItem('lms.accessToken'),
    refreshToken: localStorage.getItem('lms.refreshToken'),
    user: JSON.parse(localStorage.getItem('lms.user') ?? 'null'),
    loginSuccess: (tokens) => {
      localStorage.setItem('lms.accessToken', tokens.accessToken);
      localStorage.setItem('lms.refreshToken', tokens.refreshToken);
      localStorage.setItem('lms.user', JSON.stringify(tokens.user));
      set({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, user: tokens.user });
    },
    logoutLocal: () => {
      localStorage.removeItem('lms.accessToken');
      localStorage.removeItem('lms.refreshToken');
      localStorage.removeItem('lms.user');
      set({ accessToken: null, refreshToken: null, user: null });
    },
  };
});
```

- [x] **Step 2.5: Run verification and commit**

Run:

```bash
npm.cmd run test:frontend
npm.cmd run build:frontend
git add frontend/src
git commit -m "feat(frontend): add typed api client and auth store"
```

---

### Task 3: Auth Pages and Protected Routes

**Files:**
- Create: `frontend/src/features/auth/LoginPage.tsx`
- Create: `frontend/src/features/auth/RegisterPage.tsx`
- Create: `frontend/src/features/auth/ProtectedRoute.tsx`
- Create: `frontend/src/features/auth/AuthPage.test.tsx`
- Modify: `frontend/src/app/routes.tsx`

**Interfaces:**
- Produces: `/login`, `/register`, protected `/courses`.
- Consumes: `login()`, `register()`, `useAuthStore`.

- [x] **Step 3.1: Write auth UI tests**

Create tests that render `LoginPage`, type `instructor@example.com` and `Password123!`, mock `login()`, click `Dang nhap`, and expect `loginSuccess()` navigation to `/courses`.

- [x] **Step 3.2: Implement login/register forms**

Use label-above-input fields, inline error text, skeleton-free submit loading state, and no placeholder-as-label. Primary button text: `Dang nhap`; secondary route text: `Tao tai khoan`.

- [x] **Step 3.3: Add protected route**

Implement:

```tsx
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user);
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
```

- [x] **Step 3.4: Run verification and commit**

Run:

```bash
npm.cmd run test:frontend
npm.cmd run build:frontend
git add frontend/src
git commit -m "feat(frontend): add auth routes"
```

---

### Task 4: Course Catalog, Course Detail, and Instructor Course Tools

**Files:**
- Create: `frontend/src/features/courses/CoursesPage.tsx`
- Create: `frontend/src/features/courses/CourseDetailPage.tsx`
- Create: `frontend/src/features/courses/CourseEditorPanel.tsx`
- Create: `frontend/src/features/courses/CoursesPage.test.tsx`
- Modify: `frontend/src/app/routes.tsx`

**Interfaces:**
- Produces: `/courses`, `/courses/:courseId`.
- Consumes: `GET /courses`, `POST /courses`, `GET /courses/:id`, `PATCH /courses/:id`, `POST /courses/:id/publish`, `POST /courses/:id/enroll`, `GET /courses/:courseId/lessons`.

- [x] **Step 4.1: Write course page tests**

Mock API functions and verify:
- published courses render with status badge.
- student sees `Ghi danh`.
- instructor sees `Tao khoa hoc` and `Publish`.
- empty state appears when course list is empty.

- [x] **Step 4.2: Implement course list**

Build a dense table/list hybrid with columns: title, status, instructor, updated date, primary action. Use a side filter rail for `keyword` and `status`. Use `StatusBadge` for `DRAFT`, `PUBLISHED`, `ARCHIVED`.

- [x] **Step 4.3: Implement course detail**

Show course metadata, enrollment action, lessons panel mount point, sessions panel mount point, and instructor edit panel. Do not show upload/progress controls in P4a.

- [x] **Step 4.4: Run verification and commit**

Run:

```bash
npm.cmd run test:frontend
npm.cmd run build:frontend
git add frontend/src
git commit -m "feat(frontend): add course catalog ui"
```

---

### Task 4.5: Backend Read Endpoints Needed by Frontend Panels

**Files:**
- Modify: `shared/src/quizzes.ts`
- Modify: `backend/src/modules/sessions/sessions.controller.ts`
- Modify: `backend/src/modules/sessions/sessions.service.ts`
- Modify: `backend/src/modules/quizzes/quizzes.controller.ts`
- Modify: `backend/src/modules/quizzes/quizzes.service.ts`
- Modify: `backend/test/sessions-quizzes.e2e-spec.ts`
- Modify: `frontend/src/api/sessions.ts`
- Modify: `frontend/src/api/quizzes.ts`

**Interfaces:**
- Produces: `GET /courses/:courseId/sessions`, `GET /lessons/:lessonId/quizzes`, `GET /sessions/:sessionId/quiz-runs`.
- Consumes: course instructor ownership and student enrollment authorization.

- [x] **Step 4.5.1: Write backend e2e tests**

Verify:
- enrolled students can list course sessions.
- lesson quiz list includes questions/options but does not expose `correctOptionId`.
- session quiz-run list includes the linked quiz title.

- [x] **Step 4.5.2: Run test to verify endpoints fail**

Run:

```bash
$env:REDIS_URL='redis://:123456@localhost:6379'; npm.cmd run test:e2e --workspace=backend -- sessions-quizzes.e2e-spec.ts
```

Expected: FAIL with missing routes before implementation.

- [x] **Step 4.5.3: Add shared list response types**

Add `QuizWithQuestionsResponse` and `QuizRunListItemResponse` to `@lms/shared` so frontend and backend agree on the list payload shape.

- [x] **Step 4.5.4: Implement backend controllers and services**

Add authorized list methods for sessions, quizzes, and quiz runs. Admin/instructor can list their managed course data; students can list data only for enrolled courses.

- [x] **Step 4.5.5: Add frontend API wrappers**

Add typed `listSessions(courseId)`, `listQuizzes(lessonId)`, and `listQuizRuns(sessionId)` wrappers.

- [x] **Step 4.5.6: Run verification and commit**

Run:

```bash
$env:REDIS_URL='redis://:123456@localhost:6379'; npm.cmd run test:e2e --workspace=backend -- sessions-quizzes.e2e-spec.ts
npm.cmd run build:backend
npm.cmd run build:shared
npm.cmd run test:frontend
npm.cmd run build:frontend
git add shared/src backend/src backend/test frontend/src docs/superpowers/plans/2026-08-28-lms-realtime-p4a-frontend-core-ui.md
git commit -m "feat(api): add frontend read endpoints"
```

---

### Task 5: Lessons and Sessions Panels

**Files:**
- Create: `frontend/src/features/lessons/LessonsPanel.tsx`
- Create: `frontend/src/features/sessions/SessionsPanel.tsx`
- Create: `frontend/src/features/sessions/SessionsPanel.test.tsx`
- Modify: `frontend/src/features/courses/CourseDetailPage.tsx`

**Interfaces:**
- Produces: lesson list, create lesson form, session list, create/start/end session controls.
- Consumes: lesson endpoints, session endpoints, `GET /sessions/:id/state`.

- [ ] **Step 5.1: Write panel tests**

Verify lesson rows sort by `order`, live sessions show `Vao live`, instructor can click `Start`, and ended sessions no longer show live entry.

- [ ] **Step 5.2: Implement lessons panel**

Render compact lesson rows with duration, description, and an instructor create form. Add disabled media area labeled `Video upload planned in P3b` only in code comments, not visible UI copy.

- [ ] **Step 5.3: Implement sessions panel**

Render sessions grouped by `LIVE`, `SCHEDULED`, `ENDED`. Student and instructor can navigate to `/sessions/:sessionId/live` when status is `LIVE`.

- [ ] **Step 5.4: Run verification and commit**

Run:

```bash
npm.cmd run test:frontend
npm.cmd run build:frontend
git add frontend/src
git commit -m "feat(frontend): add lessons and sessions panels"
```

---

### Task 6: Socket Client Foundation

**Files:**
- Create: `frontend/src/lib/realtime.ts`
- Create: `frontend/src/lib/realtime.test.ts`
- Modify: `frontend/src/features/auth/auth.store.ts`

**Interfaces:**
- Produces: `createNamespaceSocket(namespace, token)`, `useSocketStatus(namespace)`.
- Consumes: `socket.io-client`, `useAuthStore.accessToken`, shared realtime payload types.

- [ ] **Step 6.1: Write socket factory tests**

Mock `socket.io-client` and verify `io('/sessions', { auth: { token }, transports: ['websocket'] })` is called, reconnection is enabled with bounded backoff, and no socket is created when token is missing.

- [ ] **Step 6.2: Implement realtime socket factory**

Create:

```ts
export type RealtimeNamespace = '/sessions' | '/quiz' | '/notifications';

export function createNamespaceSocket(namespace: RealtimeNamespace, token: string) {
  return io(namespace, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 8,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
  });
}
```

- [ ] **Step 6.3: Run verification and commit**

Run:

```bash
npm.cmd run test:frontend
npm.cmd run build:frontend
git add frontend/src
git commit -m "feat(frontend): add realtime socket client"
```

---

### Task 7: Live Session Chat Workspace

**Files:**
- Create: `frontend/src/features/sessions/LiveSessionPage.tsx`
- Create: `frontend/src/features/sessions/ChatPanel.tsx`
- Create: `frontend/src/features/sessions/LiveSessionPage.test.tsx`
- Modify: `frontend/src/app/routes.tsx`

**Interfaces:**
- Produces: `/sessions/:sessionId/live`.
- Consumes: `/sessions` namespace events `session:join`, `session:state`, `chat:send`, `chat:message`.
- Consumes: `GET /sessions/:id/state`.

- [ ] **Step 7.1: Write live session tests**

Mock `createNamespaceSocket()`. Verify page emits `session:join`, appends incoming `chat:message`, sends `chat:send` after form submit, and renders participant count from `session:state`.

- [ ] **Step 7.2: Implement live workspace layout**

Use a work-focused three-zone layout:
- left rail: session status, participant count, course navigation.
- center: live lesson surface with calm empty state because video is P3b.
- right panel: chat and quiz panel mount point.

- [ ] **Step 7.3: Implement chat panel**

Use stable message rows, timestamp, sender name, and a bottom composer with max length guard matching backend `1000`.

- [ ] **Step 7.4: Run verification and commit**

Run:

```bash
npm.cmd run test:frontend
npm.cmd run build:frontend
git add frontend/src
git commit -m "feat(frontend): add live session chat ui"
```

---

### Task 8: Quiz Run Control, Student Answering, and Leaderboard UI

**Files:**
- Create: `frontend/src/features/quizzes/QuizPanel.tsx`
- Create: `frontend/src/features/quizzes/QuizInstructorControls.tsx`
- Create: `frontend/src/features/quizzes/QuizStudentAnswerGrid.tsx`
- Create: `frontend/src/features/quizzes/LeaderboardPanel.tsx`
- Create: `frontend/src/features/quizzes/QuizPanel.test.tsx`
- Modify: `frontend/src/features/sessions/LiveSessionPage.tsx`

**Interfaces:**
- Produces: instructor controls for quiz run next/close/reveal/finish.
- Produces: student answer grid for `quiz:question`, locked answered state, reveal feedback, leaderboard.
- Consumes: quiz REST control endpoints and `/quiz` namespace events.

- [ ] **Step 8.1: Write quiz panel tests**

Verify:
- `quiz:question` renders answer options without `correctOptionId`.
- clicking an option emits `quiz:answer`.
- duplicate local click is disabled.
- `quiz:reveal` highlights the correct option.
- leaderboard ranks render in score order.
- instructor role renders `Mo cau tiep`, `Dong cau`, `Reveal`, `Ket thuc`.

- [ ] **Step 8.2: Implement quiz panel**

Connect to `/quiz` namespace once per live page when a quiz run exists. Emit `quiz:join` and keep local event state for question, reveal, closed state, finished state, and leaderboard.

- [ ] **Step 8.3: Implement instructor controls**

Use REST mutations:
- `POST /quiz-runs/:id/questions/next`
- `POST /quiz-runs/:id/questions/close`
- `POST /quiz-runs/:id/reveal`
- `POST /quiz-runs/:id/finish`

After each mutation, rely on socket broadcast first and invalidate `quizRunState` second.

- [ ] **Step 8.4: Run verification and commit**

Run:

```bash
npm.cmd run test:frontend
npm.cmd run build:frontend
git add frontend/src
git commit -m "feat(frontend): add realtime quiz ui"
```

---

### Task 9: Notifications Drawer and Realtime Badge

**Files:**
- Create: `frontend/src/features/notifications/NotificationsButton.tsx`
- Create: `frontend/src/features/notifications/NotificationsDrawer.tsx`
- Create: `frontend/src/features/notifications/NotificationsDrawer.test.tsx`
- Modify: `frontend/src/app/routes.tsx`

**Interfaces:**
- Produces: topbar notification button, drawer list, unread badge.
- Consumes: `GET /me/notifications`, `PATCH /me/notifications/:id/read`, `/notifications` event `notification:new`.

- [ ] **Step 9.1: Write notification tests**

Mock API/socket and verify unread count increments on `notification:new`, drawer renders newest first, and clicking a row calls mark-read mutation.

- [ ] **Step 9.2: Implement notifications UI**

Use icon-only button with tooltip/accessibility label. Drawer is a real dialog region with Escape close, focus return, loading rows, empty state, and contextual error state.

- [ ] **Step 9.3: Run verification and commit**

Run:

```bash
npm.cmd run test:frontend
npm.cmd run build:frontend
git add frontend/src
git commit -m "feat(frontend): add notifications drawer"
```

---

### Task 10: README, Local Smoke, and P4a Final Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-08-28-lms-realtime-p4a-frontend-core-ui.md`

**Interfaces:**
- Produces: frontend manual smoke steps for login, course detail, live chat, quiz, notifications.
- Consumes: all P4a UI tasks.

- [ ] **Step 10.1: Update README frontend smoke**

Document:

```text
1. Start infra, migrate, seed, and backend.
2. Start frontend at http://localhost:5173.
3. Login as instructor@example.com / Password123!.
4. Open the seeded live session.
5. In another browser profile, login as student@example.com / Password123!.
6. Verify chat messages, quiz question flow, leaderboard, and notifications.
```

- [ ] **Step 10.2: Run final frontend verification**

Run:

```bash
npm.cmd run test:frontend
npm.cmd run build:frontend
```

Expected: all frontend tests and build pass.

- [ ] **Step 10.3: Optional local full-stack smoke**

Run only if Docker/Postgres/Redis are available:

```bash
npm.cmd run infra:up
npm.cmd run db:seed --workspace=backend
npm.cmd run dev:backend
npm.cmd run dev:frontend
```

Expected: app opens at `http://localhost:5173`, backend at `http://localhost:4000`, Swagger at `http://localhost:4000/api/docs`.

- [ ] **Step 10.4: Mark plan complete**

Replace every remaining task checkbox in this file with checked state only after Step 10.2 passes.

- [ ] **Step 10.5: Commit**

```bash
git add README.md docs/superpowers/plans/2026-08-28-lms-realtime-p4a-frontend-core-ui.md
git commit -m "docs(plan): complete p4a frontend core ui"
```

---

## P4a Acceptance Checklist

- [ ] Frontend no longer shows the P1 health-check scaffold as the main product.
- [ ] App has protected routes and login/register pages.
- [ ] Auth token is attached to REST requests through the typed API client.
- [ ] Course list and course detail use TanStack Query and backend envelope handling.
- [ ] Student can enroll in a published course from the UI.
- [ ] Instructor can create/publish courses and create/start/end sessions from the UI.
- [ ] Live session page connects to `/sessions`, joins `session:join`, shows participant count, sends and receives chat.
- [ ] Quiz UI connects to `/quiz`, joins `quiz:join`, submits `quiz:answer`, renders question/closed/reveal/finished/leaderboard states.
- [ ] Instructor quiz controls call the P3 REST endpoints.
- [ ] Notifications drawer lists, marks read, and receives `notification:new`.
- [ ] Light and dark themes have matching hierarchy and readable contrast.
- [ ] Forms use labels, helper/error text, and visible focus states.
- [ ] Loading, empty, and error states exist for every page-level query.
- [ ] Frontend tests pass.
- [ ] Frontend build passes.

## Out of Scope for P4a

- Media upload and presigned playback.
- Lesson progress heartbeat and progress dashboards.
- Admin user management UI.
- Playwright full browser e2e.
- Production Docker/nginx UI deployment.

## Suggested Next Plans

- **P3b Media & Progress Backend:** MinIO upload/complete/playback, lesson progress REST, `progress:heartbeat`, Redis debounce, BullMQ flush.
- **P4b Media & Progress Frontend:** video upload, playback shell, progress heartbeat UI, instructor progress visibility.
- **P5 Docker & CI:** production Dockerfiles, Nginx reverse proxy with WS upgrade, GitHub Actions, Playwright e2e.

## Self-Review

- [x] **Spec coverage:** P4a covers the frontend parts enabled by completed P2/P3 APIs: auth, courses, lessons, sessions, chat, quiz, and notifications.
- [x] **Scope control:** Media upload/playback and progress heartbeat are intentionally excluded because their backend endpoints are not implemented yet.
- [x] **Taste Skill fit:** Taste Skill is applied as an anti-slop/audit checklist while respecting its warning that it is not a dashboard-specific framework.
- [x] **Placeholder scan:** No TBD/TODO/implement-later placeholders remain.
- [x] **Type consistency:** REST and realtime names match backend controllers and `@lms/shared` contracts.
- [x] **Verification discipline:** Each task ends with frontend tests, frontend build, and a commit.

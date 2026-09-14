# LMS Realtime P9 Assessment & Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add assessment and analytics surfaces for learners and instructors: quiz attempt summaries, course engagement metrics, lesson completion insights, question performance, and CSV exports.

**Architecture:** Treat P9 as a reporting/read-model layer built from existing `Enrollment`, `LessonProgress`, `QuizRun`, `Question`, and `QuizAnswer` rows. Add shared analytics contracts first, then a backend Analytics module with role-aware queries and CSV responses, then shadcn-style dark frontend dashboards under course detail. Avoid new persistence tables unless later performance proves the read model is too slow.

**Tech Stack:** NestJS, Prisma, PostgreSQL, React, Vite, TypeScript, TanStack Query, shadcn-style UI primitives, lucide-react, Vitest, Jest e2e, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-26-lms-realtime-design.md`

## Global Constraints

- Do not clear or reset local/production data unless a task explicitly says to run the reset seed command.
- Frontend visible copy must be English.
- UI must use the existing shadcn-style dark theme and `frontend/src/components/ui/*` as the base component layer.
- For UI/layout changes, run Playwright visual audit screenshots across desktop and mobile before handoff.
- Keep WebRTC/RTMP, HLS transcoding, payments, OAuth, web push, and multi-tenant logic out of scope.
- After each implementation task that touches code, run `npm run typecheck`, `npm run build`, and the listed focused tests before committing.
- Before marking the plan complete, check GitHub CI if a PR exists and verify all required checks are green.

---

## File Structure

**Shared contracts**
- Create `shared/src/analytics.ts` for learner and instructor analytics response types.
- Modify `shared/src/index.ts` to export analytics contracts.
- Modify `shared/src/contracts.type-test.ts` to compile-check analytics contracts.

**Backend**
- Create `backend/src/modules/analytics/analytics.module.ts`.
- Create `backend/src/modules/analytics/analytics.controller.ts`.
- Create `backend/src/modules/analytics/analytics.service.ts`.
- Create `backend/src/modules/analytics/csv.ts` for CSV escaping and response generation helpers.
- Modify `backend/src/app.module.ts` to import `AnalyticsModule`.
- Modify `backend/src/swagger.ts` to add the `Analytics` tag if tags are manually listed.
- Modify `backend/prisma/seeds/data.ts` and seed helpers only to add richer finished quiz attempts and progress samples without resetting data by default.
- Create `backend/test/analytics.e2e-spec.ts`.

**Frontend**
- Create `frontend/src/api/analytics.ts`.
- Create `frontend/src/features/analytics/LearnerAnalyticsPanel.tsx`.
- Create `frontend/src/features/analytics/InstructorAnalyticsPanel.tsx`.
- Create `frontend/src/features/analytics/AnalyticsMetricCard.tsx`.
- Create `frontend/src/features/analytics/analytics-format.ts`.
- Create tests under `frontend/src/features/analytics/*.test.tsx`.
- Modify `frontend/src/features/courses/CourseDetailPage.tsx` to show analytics panels in the existing course detail grid.
- Modify `frontend/src/styles/global.css` for analytics layout classes, keeping the dark shadcn visual language.
- Create or extend `tests/e2e/p9-assessment-analytics.spec.ts`.

**Docs**
- Modify `README.md` with P9 manual smoke instructions.
- Modify this plan file as tasks complete.

---

### Task 1: Shared Analytics Contracts And Frontend API Helpers

**Files:**
- Create: `shared/src/analytics.ts`
- Modify: `shared/src/index.ts`
- Modify: `shared/src/contracts.type-test.ts`
- Create: `frontend/src/api/analytics.ts`
- Modify: `frontend/src/api/client.test.ts`

**Interfaces:**
- Consumes:
  - existing `QuizRunStatus`
  - existing API envelope helpers `getEnvelope`
- Produces:
  - `LearnerCourseAnalyticsResponse`
  - `InstructorCourseAnalyticsResponse`
  - `getMyCourseAnalytics(courseId: string)`
  - `getInstructorCourseAnalytics(courseId: string)`
  - `downloadCourseAnalyticsCsv(courseId: string, kind: 'students' | 'questions')`

- [x] **Step 1: Write failing shared contract type usage**

Add imports to `shared/src/contracts.type-test.ts`:

```ts
import type {
  InstructorCourseAnalyticsResponse,
  LearnerCourseAnalyticsResponse,
} from './analytics';
```

Add this compile-only data:

```ts
const learnerAnalytics: LearnerCourseAnalyticsResponse = {
  courseId: 'course-1',
  completedLessons: 2,
  totalLessons: 3,
  completionPercent: 67,
  quizRunsTaken: 2,
  averageQuizScore: 125,
  bestQuizScore: 150,
  lastActivityAt: '2026-09-14T00:00:00.000Z',
  quizAttempts: [
    {
      quizRunId: 'run-1',
      quizTitle: 'Progress checkpoint',
      lessonId: 'lesson-1',
      lessonTitle: 'Introduction',
      finishedAt: '2026-09-14T00:00:00.000Z',
      totalScore: 150,
      correctCount: 1,
      questionCount: 1,
      percentCorrect: 100,
      rank: 1,
      participantCount: 4,
    },
  ],
};

const instructorAnalytics: InstructorCourseAnalyticsResponse = {
  courseId: 'course-1',
  totalStudents: 5,
  activeStudents: 4,
  averageCompletionPercent: 58,
  completedStudents: 1,
  averageQuizScore: 118,
  quizParticipationRate: 80,
  lessonCompletions: [
    {
      lessonId: 'lesson-1',
      lessonTitle: 'Introduction',
      completedStudents: 3,
      totalStudents: 5,
      completionPercent: 60,
      averagePositionSeconds: 420,
    },
  ],
  questionPerformance: [
    {
      quizId: 'quiz-1',
      quizTitle: 'Progress checkpoint',
      quizRunId: 'run-1',
      questionId: 'question-1',
      questionText: 'Which event keeps progress fresh?',
      correctCount: 3,
      answerCount: 4,
      correctPercent: 75,
    },
  ],
  studentSummaries: [
    {
      userId: 'student-1',
      name: 'Student One',
      email: 'student@example.com',
      completionPercent: 67,
      completedLessons: 2,
      quizRunsTaken: 2,
      averageQuizScore: 125,
      lastActivityAt: '2026-09-14T00:00:00.000Z',
    },
  ],
};

void learnerAnalytics;
void instructorAnalytics;
```

Run:

```bash
npm run typecheck:shared
```

Expected: FAIL because analytics contracts do not exist.

- [x] **Step 2: Add shared analytics contracts**

Create `shared/src/analytics.ts`:

```ts
export interface LearnerQuizAttemptAnalytics {
  quizRunId: string;
  quizTitle: string;
  lessonId: string;
  lessonTitle: string;
  finishedAt: string | null;
  totalScore: number;
  correctCount: number;
  questionCount: number;
  percentCorrect: number;
  rank: number | null;
  participantCount: number;
}

export interface LearnerCourseAnalyticsResponse {
  courseId: string;
  completedLessons: number;
  totalLessons: number;
  completionPercent: number;
  quizRunsTaken: number;
  averageQuizScore: number;
  bestQuizScore: number;
  lastActivityAt: string | null;
  quizAttempts: LearnerQuizAttemptAnalytics[];
}

export interface InstructorLessonCompletionAnalytics {
  lessonId: string;
  lessonTitle: string;
  completedStudents: number;
  totalStudents: number;
  completionPercent: number;
  averagePositionSeconds: number;
}

export interface InstructorQuestionPerformanceAnalytics {
  quizId: string;
  quizTitle: string;
  quizRunId: string;
  questionId: string;
  questionText: string;
  correctCount: number;
  answerCount: number;
  correctPercent: number;
}

export interface InstructorStudentAnalyticsSummary {
  userId: string;
  name: string;
  email: string;
  completionPercent: number;
  completedLessons: number;
  quizRunsTaken: number;
  averageQuizScore: number;
  lastActivityAt: string | null;
}

export interface InstructorCourseAnalyticsResponse {
  courseId: string;
  totalStudents: number;
  activeStudents: number;
  averageCompletionPercent: number;
  completedStudents: number;
  averageQuizScore: number;
  quizParticipationRate: number;
  lessonCompletions: InstructorLessonCompletionAnalytics[];
  questionPerformance: InstructorQuestionPerformanceAnalytics[];
  studentSummaries: InstructorStudentAnalyticsSummary[];
}
```

Update `shared/src/index.ts`:

```ts
export * from './analytics';
```

- [x] **Step 3: Add frontend API helpers**

Create `frontend/src/api/analytics.ts`:

```ts
import type {
  InstructorCourseAnalyticsResponse,
  LearnerCourseAnalyticsResponse,
} from '@lms/shared';
import { apiClient, getEnvelope } from './client';

export async function getMyCourseAnalytics(
  courseId: string,
): Promise<LearnerCourseAnalyticsResponse> {
  return getEnvelope<LearnerCourseAnalyticsResponse>(`/me/courses/${courseId}/analytics`);
}

export async function getInstructorCourseAnalytics(
  courseId: string,
): Promise<InstructorCourseAnalyticsResponse> {
  return getEnvelope<InstructorCourseAnalyticsResponse>(`/courses/${courseId}/analytics`);
}

export async function downloadCourseAnalyticsCsv(
  courseId: string,
  kind: 'students' | 'questions',
): Promise<Blob> {
  const response = await apiClient.get(`/courses/${courseId}/analytics/export`, {
    params: { kind },
    responseType: 'blob',
  });

  return response.data as Blob;
}
```

Add assertions in `frontend/src/api/client.test.ts`:

```ts
expect(getSpy).toHaveBeenCalledWith('/me/courses/course-1/analytics', undefined);
expect(getSpy).toHaveBeenCalledWith('/courses/course-1/analytics', undefined);
expect(axiosGetSpy).toHaveBeenCalledWith('/courses/course-1/analytics/export', {
  params: { kind: 'students' },
  responseType: 'blob',
});
```

- [x] **Step 4: Verify**

Run:

```bash
npm run test --workspace=frontend -- client.test.ts
npm run typecheck:shared
npm run typecheck:frontend
npm run build:frontend
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add shared/src/analytics.ts shared/src/index.ts shared/src/contracts.type-test.ts frontend/src/api/analytics.ts frontend/src/api/client.test.ts
git commit -m "feat(shared): add analytics contracts"
```

---

### Task 2: Backend Learner Analytics

**Files:**
- Create: `backend/src/modules/analytics/analytics.module.ts`
- Create: `backend/src/modules/analytics/analytics.controller.ts`
- Create: `backend/src/modules/analytics/analytics.service.ts`
- Modify: `backend/src/app.module.ts`
- Create: `backend/test/analytics.e2e-spec.ts`

**Interfaces:**
- Consumes:
  - `LearnerCourseAnalyticsResponse`
  - `CoursesService.findCourseOrThrow(courseId)`
  - existing `Enrollment`, `LessonProgress`, `QuizRun`, and `QuizAnswer`
- Produces:
  - `GET /api/me/courses/:courseId/analytics`
  - `AnalyticsService.getLearnerCourseAnalytics(courseId: string, user: AuthenticatedUser): Promise<LearnerCourseAnalyticsResponse>`

- [x] **Step 1: Write failing backend e2e tests**

Create `backend/test/analytics.e2e-spec.ts` with these cases:

```ts
it('returns learner course analytics for an enrolled student', async () => {
  const { studentToken, courseId } = await seedAnalyticsCourse();

  const res = await request(app.getHttpServer())
    .get(`/api/me/courses/${courseId}/analytics`)
    .set('Authorization', `Bearer ${studentToken}`)
    .expect(200);

  expect(res.body.data).toMatchObject({
    courseId,
    completedLessons: 1,
    totalLessons: 2,
    completionPercent: 50,
    quizRunsTaken: 1,
    averageQuizScore: 150,
    bestQuizScore: 150,
  });
  expect(res.body.data.quizAttempts).toHaveLength(1);
  expect(res.body.data.quizAttempts[0]).toMatchObject({
    correctCount: 1,
    participantCount: 2,
    percentCorrect: 100,
    rank: 1,
  });
});

it('forbids learner analytics for a non-enrolled student', async () => {
  const { otherStudentToken, courseId } = await seedAnalyticsCourse();

  await request(app.getHttpServer())
    .get(`/api/me/courses/${courseId}/analytics`)
    .set('Authorization', `Bearer ${otherStudentToken}`)
    .expect(403);
});
```

Run:

```bash
npm run test:e2e --workspace=backend -- analytics.e2e-spec.ts
```

Expected: FAIL because the Analytics module and route do not exist.

- [x] **Step 2: Add Analytics module and controller**

Create `backend/src/modules/analytics/analytics.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { CoursesModule } from '../courses/courses.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [CoursesModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
```

Create `backend/src/modules/analytics/analytics.controller.ts`:

```ts
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { AnalyticsService } from './analytics.service';

@ApiTags('Analytics')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('me/courses/:courseId/analytics')
  @ApiOperation({ summary: 'Get my course assessment analytics' })
  getMyCourseAnalytics(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.analyticsService.getLearnerCourseAnalytics(courseId, user);
  }
}
```

Import `AnalyticsModule` in `backend/src/app.module.ts`.

- [x] **Step 3: Implement learner analytics aggregation**

In `backend/src/modules/analytics/analytics.service.ts`, implement:

```ts
async getLearnerCourseAnalytics(
  courseId: string,
  user: AuthenticatedUser,
): Promise<LearnerCourseAnalyticsResponse> {
  const course = await this.prisma.course.findUnique({
    where: { id: courseId },
    include: { lessons: { orderBy: { order: 'asc' } } },
  });

  if (!course) {
    throw new AppError('NOT_FOUND', 'Course not found', HttpStatus.NOT_FOUND);
  }

  await this.ensureLearnerCanViewCourse(courseId, course.instructorId, user);

  const lessonIds = course.lessons.map((lesson) => lesson.id);
  const progressRows = await this.prisma.lessonProgress.findMany({
    where: { userId: user.id, lessonId: { in: lessonIds } },
  });
  const quizRuns = await this.prisma.quizRun.findMany({
    where: {
      status: 'FINISHED',
      quiz: { lesson: { courseId } },
      answers: { some: { userId: user.id } },
    },
    include: {
      quiz: { include: { lesson: true, questions: true } },
      answers: true,
    },
    orderBy: [{ finishedAt: 'desc' }, { createdAt: 'desc' }],
  });

  const attempts = quizRuns.map((run) => this.toLearnerAttempt(run, user.id));
  const completedLessons = progressRows.filter((row) => row.completedAt !== null).length;
  const quizScores = attempts.map((attempt) => attempt.totalScore);
  const lastActivityAt = latestIso([
    ...progressRows.map((row) => row.lastWatchedAt),
    ...quizRuns.flatMap((run) => run.answers.map((answer) => answer.answeredAt)),
  ]);

  return {
    courseId,
    completedLessons,
    totalLessons: course.lessons.length,
    completionPercent: percent(completedLessons, course.lessons.length),
    quizRunsTaken: attempts.length,
    averageQuizScore: average(quizScores),
    bestQuizScore: Math.max(0, ...quizScores),
    lastActivityAt,
    quizAttempts: attempts,
  };
}
```

Use helpers:

```ts
function percent(value: number, total: number): number {
  return total === 0 ? 0 : Math.round((value / total) * 100);
}

function average(values: number[]): number {
  return values.length === 0
    ? 0
    : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}
```

For rank:

```ts
const totalsByUser = new Map<string, number>();
for (const answer of run.answers) {
  totalsByUser.set(answer.userId, (totalsByUser.get(answer.userId) ?? 0) + answer.score);
}
const rankedTotals = [...totalsByUser.entries()].sort((a, b) => b[1] - a[1]);
const rank = rankedTotals.findIndex(([candidateId]) => candidateId === userId) + 1;
```

- [x] **Step 4: Verify**

Run:

```bash
npm run test:e2e --workspace=backend -- analytics.e2e-spec.ts
npm run typecheck:backend
npm run build:backend
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add backend/src/app.module.ts backend/src/modules/analytics backend/test/analytics.e2e-spec.ts
git commit -m "feat(backend): add learner analytics"
```

---

### Task 3: Backend Instructor Analytics And CSV Export

**Files:**
- Modify: `backend/src/modules/analytics/analytics.controller.ts`
- Modify: `backend/src/modules/analytics/analytics.service.ts`
- Create: `backend/src/modules/analytics/csv.ts`
- Modify: `backend/test/analytics.e2e-spec.ts`

**Interfaces:**
- Consumes:
  - `InstructorCourseAnalyticsResponse`
  - existing course ownership checks
- Produces:
  - `GET /api/courses/:courseId/analytics`
  - `GET /api/courses/:courseId/analytics/export?kind=students`
  - `GET /api/courses/:courseId/analytics/export?kind=questions`
  - `AnalyticsService.getInstructorCourseAnalytics(courseId, actor)`
  - `AnalyticsService.exportCourseAnalyticsCsv(courseId, actor, kind)`

- [x] **Step 1: Write failing instructor analytics tests**

Extend `backend/test/analytics.e2e-spec.ts`:

```ts
it('returns instructor analytics for an owned course', async () => {
  const { instructorToken, courseId } = await seedAnalyticsCourse();

  const res = await request(app.getHttpServer())
    .get(`/api/courses/${courseId}/analytics`)
    .set('Authorization', `Bearer ${instructorToken}`)
    .expect(200);

  expect(res.body.data).toMatchObject({
    courseId,
    totalStudents: 2,
    activeStudents: 2,
    averageCompletionPercent: 25,
    completedStudents: 0,
    averageQuizScore: 100,
    quizParticipationRate: 100,
  });
  expect(res.body.data.lessonCompletions).toHaveLength(2);
  expect(res.body.data.questionPerformance[0]).toMatchObject({
    answerCount: 2,
    correctCount: 1,
    correctPercent: 50,
  });
});

it('exports student analytics as csv for instructors', async () => {
  const { instructorToken, courseId } = await seedAnalyticsCourse();

  const res = await request(app.getHttpServer())
    .get(`/api/courses/${courseId}/analytics/export?kind=students`)
    .set('Authorization', `Bearer ${instructorToken}`)
    .expect(200);

  expect(res.headers['content-type']).toContain('text/csv');
  expect(res.headers['content-disposition']).toContain('course-analytics-students.csv');
  expect(res.text).toContain('Name,Email,Completion %,Completed lessons,Quiz runs,Average quiz score,Last activity');
});
```

Expected: FAIL because routes do not exist.

- [x] **Step 2: Add instructor routes**

Update `analytics.controller.ts`:

```ts
import { Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'INSTRUCTOR')
@Get('courses/:courseId/analytics')
@ApiOperation({ summary: 'Get instructor course analytics' })
getCourseAnalytics(@Param('courseId') courseId: string, @CurrentUser() user: AuthenticatedUser) {
  return this.analyticsService.getInstructorCourseAnalytics(courseId, user);
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'INSTRUCTOR')
@Get('courses/:courseId/analytics/export')
@ApiOperation({ summary: 'Export course analytics as CSV' })
async exportCourseAnalytics(
  @Param('courseId') courseId: string,
  @CurrentUser() user: AuthenticatedUser,
  @Query('kind') kind: 'students' | 'questions' = 'students',
  @Res() response: Response,
) {
  const csv = await this.analyticsService.exportCourseAnalyticsCsv(courseId, user, kind);
  response.setHeader('Content-Type', 'text/csv; charset=utf-8');
  response.setHeader('Content-Disposition', `attachment; filename="${csv.fileName}"`);
  response.send(csv.content);
}
```

- [x] **Step 3: Implement instructor aggregation**

Compute from existing rows:

```ts
const enrollments = await this.prisma.enrollment.findMany({
  where: { courseId },
  include: { user: true },
  orderBy: { createdAt: 'asc' },
});
const lessons = await this.prisma.lesson.findMany({
  where: { courseId },
  orderBy: { order: 'asc' },
});
const progressRows = await this.prisma.lessonProgress.findMany({
  where: {
    lessonId: { in: lessons.map((lesson) => lesson.id) },
    userId: { in: enrollments.map((enrollment) => enrollment.userId) },
  },
});
const runs = await this.prisma.quizRun.findMany({
  where: { status: 'FINISHED', quiz: { lesson: { courseId } } },
  include: {
    quiz: { include: { lesson: true, questions: true } },
    answers: true,
  },
  orderBy: [{ finishedAt: 'desc' }, { createdAt: 'desc' }],
});
```

Rules:
- `activeStudents` = enrolled students with at least one progress row or quiz answer.
- `completedStudents` = enrolled students whose completed lesson count equals total lessons and total lessons is greater than zero.
- `averageCompletionPercent` = rounded average of each enrolled student's completion percent.
- `quizParticipationRate` = rounded percent of enrolled students with at least one quiz answer in the course.
- `questionPerformance` is one row per finished run question, ordered newest run first and question order ascending.

- [x] **Step 4: Implement CSV helper**

Create `backend/src/modules/analytics/csv.ts`:

```ts
export interface CsvFile {
  fileName: string;
  content: string;
}

export function toCsv(headers: string[], rows: Array<Array<string | number | null>>): string {
  return [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ].join('\n');
}

function escapeCsvCell(value: string | number | null): string {
  const text = value === null ? '' : String(value);
  if (!/[",\n\r]/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, '""')}"`;
}
```

`exportCourseAnalyticsCsv()` returns:

```ts
{
  fileName: kind === 'students'
    ? 'course-analytics-students.csv'
    : 'course-analytics-questions.csv',
  content: toCsv(headers, rows),
}
```

- [x] **Step 5: Verify**

Run:

```bash
npm run test:e2e --workspace=backend -- analytics.e2e-spec.ts
npm run typecheck:backend
npm run build:backend
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add backend/src/modules/analytics backend/test/analytics.e2e-spec.ts
git commit -m "feat(backend): add instructor analytics exports"
```

---

### Task 4: Seed Analytics Demo Data

**Files:**
- Modify: `backend/prisma/seeds/data.ts`
- Modify: `backend/prisma/seeds/lessons.seed.ts`
- Modify: `backend/prisma/seeds/types.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes:
  - existing seed users, courses, lessons, sessions, quizzes, enrollments
- Produces:
  - repeatable demo data with varied lesson completion, quiz scores, and question performance

- [x] **Step 1: Extend seed data definitions**

Add analytics-friendly data while preserving idempotent upsert behavior:

```ts
export const lessonProgressSeeds = [
  {
    userEmail: 'student@example.com',
    lessonSlug: 'intro',
    positionSeconds: 900,
    completed: true,
  },
  {
    userEmail: 'student@example.com',
    lessonSlug: 'realtime-chat',
    positionSeconds: 420,
    completed: false,
  },
  {
    userEmail: 'student.two@example.com',
    lessonSlug: 'intro',
    positionSeconds: 600,
    completed: false,
  },
];
```

Add quiz answer seed rows for at least two students and one finished quiz run:

```ts
export const quizAnswerSeeds = [
  {
    userEmail: 'student@example.com',
    selectedOptionId: 'heartbeat',
    isCorrect: true,
    score: 150,
  },
  {
    userEmail: 'student.two@example.com',
    selectedOptionId: 'polling',
    isCorrect: false,
    score: 0,
  },
];
```

- [x] **Step 2: Upsert progress and quiz answer demo rows**

Update seed helpers so `npm run db:seed` creates or updates:
- `LessonProgress` rows by `(userId, lessonId)`;
- a finished `QuizRun` with `status: 'FINISHED'`, `revealedAt`, and `finishedAt`;
- `QuizAnswer` rows by `(runId, questionId, userId)`.

Use stable dates:

```ts
const finishedAt = new Date('2026-09-14T00:00:00.000Z');
```

- [x] **Step 3: Verify seed without clearing data**

Run:

```bash
npm run db:seed
npm run test:e2e --workspace=backend -- analytics.e2e-spec.ts
npm run typecheck:backend
npm run build:backend
```

Expected: PASS. Do not run `db:seed:reset` in this task.

- [x] **Step 4: Commit**

```bash
git add backend/prisma/seeds README.md
git commit -m "chore(seed): add analytics demo data"
```

---

### Task 5: Frontend Analytics Panels

**Files:**
- Create: `frontend/src/features/analytics/AnalyticsMetricCard.tsx`
- Create: `frontend/src/features/analytics/LearnerAnalyticsPanel.tsx`
- Create: `frontend/src/features/analytics/InstructorAnalyticsPanel.tsx`
- Create: `frontend/src/features/analytics/analytics-format.ts`
- Create: `frontend/src/features/analytics/LearnerAnalyticsPanel.test.tsx`
- Create: `frontend/src/features/analytics/InstructorAnalyticsPanel.test.tsx`
- Modify: `frontend/src/features/courses/CourseDetailPage.tsx`
- Modify: `frontend/src/styles/global.css`

**Interfaces:**
- Consumes:
  - `getMyCourseAnalytics(courseId)`
  - `getInstructorCourseAnalytics(courseId)`
  - `downloadCourseAnalyticsCsv(courseId, kind)`
- Produces:
  - learner analytics panel in course detail for enrolled students
  - instructor analytics panel in course detail for instructors/admins

- [x] **Step 1: Write failing panel tests**

`LearnerAnalyticsPanel.test.tsx`:

```tsx
expect(await screen.findByRole('heading', { name: 'My analytics' })).toBeInTheDocument();
expect(screen.getByText('67%')).toBeInTheDocument();
expect(screen.getByText('Progress checkpoint')).toBeInTheDocument();
expect(screen.getByText('Rank 1 of 4')).toBeInTheDocument();
```

`InstructorAnalyticsPanel.test.tsx`:

```tsx
expect(await screen.findByRole('heading', { name: 'Course analytics' })).toBeInTheDocument();
expect(screen.getByText('5')).toBeInTheDocument();
expect(screen.getByText('Introduction')).toBeInTheDocument();
expect(screen.getByText('Which event keeps progress fresh?')).toBeInTheDocument();
await user.click(screen.getByRole('button', { name: /export student analytics/i }));
expect(mockedDownloadCourseAnalyticsCsv).toHaveBeenCalledWith('course-1', 'students');
```

Run:

```bash
npm run test --workspace=frontend -- LearnerAnalyticsPanel.test.tsx InstructorAnalyticsPanel.test.tsx
```

Expected: FAIL because components do not exist.

- [x] **Step 2: Implement formatting helpers**

Create `analytics-format.ts`:

```ts
export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

export function formatScore(value: number): string {
  return String(Math.round(value));
}

export function formatRank(rank: number | null, participantCount: number): string {
  return rank === null ? 'Not ranked' : `Rank ${rank} of ${participantCount}`;
}

export function formatActivity(value: string | null): string {
  return value ? new Date(value).toLocaleDateString() : 'No activity';
}
```

- [x] **Step 3: Implement `AnalyticsMetricCard`**

Use a compact card-like repeated item, not a nested page section:

```tsx
export function AnalyticsMetricCard({
  label,
  value,
  meta,
}: {
  label: string;
  value: string;
  meta?: string;
}) {
  return (
    <div className="analytics-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {meta ? <em>{meta}</em> : null}
    </div>
  );
}
```

- [x] **Step 4: Implement learner panel**

`LearnerAnalyticsPanel` layout:
- title `My analytics`;
- metric row: `Completion`, `Average score`, `Best score`, `Quiz runs`;
- recent attempts list with quiz title, lesson title, score, percent correct, rank;
- loading state with `LoadingBlock`;
- empty state: `Completed quiz attempts will appear here.`;
- error banner using `getErrorMessage`.

- [x] **Step 5: Implement instructor panel**

`InstructorAnalyticsPanel` layout:
- title `Course analytics`;
- metric row: `Students`, `Active`, `Avg completion`, `Avg quiz score`, `Quiz participation`;
- export icon buttons with accessible labels `Export student analytics` and `Export question analytics`;
- lesson completion list;
- question performance list;
- student summary table with balanced columns and fit-content status labels.

CSV download helper:

```ts
function saveCsv(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
```

- [x] **Step 6: Mount panels in course detail**

In `CourseDetailPage.tsx`:
- show `InstructorAnalyticsPanel` for `canManage`;
- show `LearnerAnalyticsPanel` for enrolled students;
- keep existing progress panel visible;
- place analytics below progress and before sessions on desktop so the course detail page reads: progress, lessons, analytics, sessions.

- [x] **Step 7: Style analytics surfaces**

Add CSS classes:
- `.analytics-panel`
- `.analytics-metric-grid`
- `.analytics-metric`
- `.analytics-list`
- `.analytics-row`
- `.analytics-table`
- `.analytics-actions`

Requirements:
- no horizontal table scroll at desktop widths;
- mobile collapses tables into stacked rows;
- action buttons are icon-only with tooltips;
- labels fit content;
- do not introduce bright purple/blue gradient dominance.

- [x] **Step 8: Verify**

Run:

```bash
npm run test --workspace=frontend -- LearnerAnalyticsPanel.test.tsx InstructorAnalyticsPanel.test.tsx
npm run typecheck:frontend
npm run build:frontend
```

Expected: PASS.

- [x] **Step 9: Commit**

```bash
git add frontend/src/api/analytics.ts frontend/src/features/analytics frontend/src/features/courses/CourseDetailPage.tsx frontend/src/styles/global.css
git commit -m "feat(frontend): add course analytics panels"
```

---

### Task 6: Playwright Smoke, Visual Audit, README, And Plan Closeout

**Files:**
- Create: `tests/e2e/p9-assessment-analytics.spec.ts`
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-09-14-lms-realtime-p9-assessment-analytics.md`

**Interfaces:**
- Consumes:
  - P9 backend analytics APIs
  - P9 frontend analytics panels
  - seeded analytics demo data
- Produces:
  - repeatable learner/instructor analytics smoke test
  - visual audit artifacts under ignored local artifact directories
  - completed P9 checklist

- [x] **Step 1: Add Playwright E2E smoke**

Create `tests/e2e/p9-assessment-analytics.spec.ts`:

```ts
test('instructor and learner can view course analytics', async ({ browser, request }) => {
  const instructor = await loginAs(request, 'instructor@example.com');
  const instructorDemo = await getDemoData(request, instructor);
  const instructorPage = await newAuthenticatedPage(browser, instructor, {
    width: 1440,
    height: 900,
  });

  await instructorPage.goto(`/courses/${instructorDemo.courseId}`, { waitUntil: 'domcontentloaded' });
  await expect(instructorPage.getByRole('heading', { name: 'Course analytics' })).toBeVisible();
  await expect(
    instructorPage.getByRole('button', { name: /export student analytics/i }),
  ).toBeVisible();
  await instructorPage.screenshot({
    fullPage: true,
    path: 'artifacts/ui-audit/p9-analytics/instructor-desktop.png',
  });

  const student = await loginAs(request, 'student@example.com');
  const studentDemo = await getDemoData(request, student);
  const studentPage = await newAuthenticatedPage(browser, student, {
    width: 390,
    height: 844,
  });

  await studentPage.goto(`/courses/${studentDemo.courseId}`, { waitUntil: 'domcontentloaded' });
  await expect(studentPage.getByRole('heading', { name: 'Assessment analytics' })).toBeVisible();
  await studentPage.screenshot({
    fullPage: true,
    path: 'artifacts/ui-audit/p9-analytics/learner-mobile.png',
  });

  await instructorPage.context().close();
  await studentPage.context().close();
});
```

- [x] **Step 2: Run Playwright visual audit**

Run local BE/FE with existing DB:

```bash
npm run dev
```

In a separate terminal:

```bash
npm run test:e2e:ui -- tests/e2e/p9-assessment-analytics.spec.ts
```

Expected: PASS and screenshots exist:
- `artifacts/ui-audit/p9-analytics/instructor-desktop.png`
- `artifacts/ui-audit/p9-analytics/learner-mobile.png`

Visual pass criteria:
- no horizontal overflow;
- no clipped text in metric cards, export actions, or student table;
- analytics panel spacing matches the existing course/detail panels;
- mobile view stacks rows cleanly and keeps primary actions reachable.

- [x] **Step 3: Update README**

Add `### P9 Assessment & Analytics Smoke Test`:

```md
1. Run `docker compose -f docker-compose.infra.yml up -d`.
2. Run `npm run db:seed`.
3. Run `npm run dev`.
4. Sign in as `instructor@example.com` with `Password123!`.
5. Open `Realtime LMS Foundations` and confirm `Course analytics` shows student, completion, quiz, lesson, and question metrics.
6. Use the export buttons to download student and question CSV files.
7. Sign in as `student@example.com` with `Password123!`.
8. Open the same course and confirm `Assessment analytics` shows completion, quiz score, rank, and recent attempts.
```

- [x] **Step 4: Run final verification**

Run:

```bash
npm run lint --workspace=backend
npm run lint --workspace=frontend
npm run test:backend
npm run test:frontend
npm run typecheck
npm run build
npm run test:e2e:ui -- tests/e2e/p9-assessment-analytics.spec.ts
```

Expected: PASS. If full lint on Windows reports only line-ending noise from existing untouched files, verify the same commands on GitHub CI before marking this task complete.

- [x] **Step 5: Mark plan complete**

Check every completed box in this file and ensure no unchecked implementation task remains.

- [x] **Step 6: Commit**

```bash
git add README.md tests/e2e/p9-assessment-analytics.spec.ts docs/superpowers/plans/2026-09-14-lms-realtime-p9-assessment-analytics.md
git commit -m "docs(plan): complete p9 assessment analytics"
```

---

## P9 Acceptance Checklist

- [x] Learner analytics endpoint returns lesson completion, quiz attempt, score, rank, and last activity data for enrolled students.
- [x] Learner analytics endpoint denies non-enrolled students.
- [x] Instructor analytics endpoint returns total students, active students, average completion, completed students, quiz participation, lesson completions, question performance, and student summaries.
- [x] Instructor analytics endpoint is restricted to admin or the owning instructor.
- [x] CSV export supports `students` and `questions` with escaped values and `text/csv` response headers.
- [x] Seed data includes enough progress and quiz answer variance to make analytics meaningful.
- [x] Course detail UI shows learner and instructor analytics with English copy and shadcn-style dark UI.
- [x] UI action buttons use icons and accessible labels; tables have balanced columns and avoid desktop horizontal scroll.
- [x] Playwright screenshots verify desktop/mobile analytics layout quality.
- [x] Backend lint, frontend lint, backend tests, frontend tests, typecheck, build, and P9 E2E pass locally or on GitHub CI.

## Out of Scope for P9

- New persistence tables for analytics snapshots.
- Advanced charting libraries.
- Scheduled analytics materialization jobs.
- Organization-wide analytics.
- Payments, certificates, grading rubrics, assignments, or essay/manual grading.
- Web push, mobile push, or notification preferences.
- Production observability, backups, and deployment target hardening.

## Suggested Next Plans

- **P10 Notification Preferences:** email delivery settings, web notification preferences, digest scheduling.
- **P11 Production Hardening:** structured logging, metrics, backup/restore docs, deployment targets.
- **P12 Assessment Expansion:** assignments, grading rubrics, certificates, and pass/fail thresholds.

## Self-Review

- [x] **Spec coverage:** P9 extends the existing quiz scoring, progress, and instructor progress surfaces from the design spec. It does not replace realtime quiz flow; it reports on persisted `QuizAnswer`, `QuizRun`, and `LessonProgress` data.
- [x] **Scope control:** The plan avoids new analytics tables and scheduled jobs so the phase stays testable as a read/reporting layer.
- [x] **Placeholder scan:** No unresolved placeholder markers are used; every task has concrete files, interfaces, commands, expected outcomes, and commit points.
- [x] **Type consistency:** Contract names introduced in Task 1 are reused unchanged by backend and frontend tasks.

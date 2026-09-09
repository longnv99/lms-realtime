# LMS Realtime P6 Learning UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished learner workspace with lesson resume/completion, personal notes, transcripts/captions, and quiz review links back to the relevant lesson.

**Architecture:** Extend the current NestJS/Prisma domain with small learning-focused models and self-service endpoints, keeping live-session playback behavior intact. Add shared TypeScript contracts first, then wire backend services/controllers, seed data, and a dedicated React route at `/courses/:courseId/learn` using the existing dark shadcn-style UI primitives.

**Tech Stack:** NestJS, Prisma, PostgreSQL, Socket.IO existing progress heartbeat, React, Vite, TanStack Query, React Router, shadcn-style UI components, Vitest, Jest e2e, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-26-lms-realtime-design.md`

## Global Constraints

- Do not clear or reset local/production data unless a task explicitly says to run the reset seed command.
- Prisma schema changes must be delivered through migrations and must keep existing seed data compatible.
- Frontend visible copy must be English.
- UI must use the existing shadcn-style dark theme and `frontend/src/components/ui/*` as the base component layer.
- Do not redesign the sidebar shell in this plan; focus on course and learning content surfaces.
- After each implementation task that touches code, run the listed typecheck/build command before committing.
- Preserve the existing live-session socket heartbeat behavior while adding learner-owned REST progress controls.

---

## File Structure

**Shared contracts**
- Modify `shared/src/lessons.ts` to add transcript cue contracts.
- Modify `shared/src/progress.ts` to add manual lesson progress input.
- Modify `shared/src/quizzes.ts` to add quiz review contracts.
- Create `shared/src/learning.ts` for lesson notes contracts.
- Modify `shared/src/index.ts` to export the new contracts.

**Database**
- Modify `backend/prisma/models/course.prisma` to add `Lesson.transcriptCues`.
- Modify `backend/prisma/models/user.prisma` to add `User.lessonNotes`.
- Modify `backend/prisma/models/quiz.prisma` to add `Question.explanation`.
- Create `backend/prisma/models/learning.prisma` for `LessonNote` and `LessonTranscriptCue`.
- Create one Prisma migration under `backend/prisma/migrations/*_p6_learning_ux/migration.sql`.

**Backend modules**
- Modify `backend/src/modules/progress/progress.service.ts` and `backend/src/modules/progress/progress.controller.ts` for manual learner progress updates.
- Create `backend/src/modules/learning/learning.module.ts`.
- Create `backend/src/modules/learning/lesson-notes.service.ts`.
- Create `backend/src/modules/learning/lesson-notes.controller.ts`.
- Create `backend/src/modules/learning/lesson-transcripts.service.ts`.
- Create `backend/src/modules/learning/lesson-transcripts.controller.ts`.
- Modify `backend/src/modules/quizzes/quizzes.service.ts` and `backend/src/modules/quizzes/quizzes.controller.ts` for quiz review endpoints.
- Modify `backend/src/app.module.ts` to import `LearningModule`.
- Modify `backend/prisma/seeds/data.ts` and `backend/prisma/seed.ts` for transcript cues, note samples, and question explanations.

**Frontend API and route**
- Create `frontend/src/api/learning.ts` for notes, transcripts, and learning progress helpers.
- Modify `frontend/src/api/progress.ts` if the manual progress mutation is kept with progress APIs.
- Modify `frontend/src/api/quizzes.ts` for quiz review APIs.
- Modify `frontend/src/app/routes.tsx` to add `/courses/:courseId/learn`.
- Create `frontend/src/features/learning/LearningPage.tsx`.
- Create `frontend/src/features/learning/LearningLessonNav.tsx`.
- Create `frontend/src/features/learning/LearningPlayer.tsx`.
- Create `frontend/src/features/learning/LessonNotesPanel.tsx`.
- Create `frontend/src/features/learning/LessonTranscriptPanel.tsx`.
- Create `frontend/src/features/learning/QuizReviewPanel.tsx`.
- Modify `frontend/src/features/courses/CourseDetailPage.tsx` to add a student "Continue learning" action.
- Modify `frontend/src/styles/index.css` only for reusable layout classes that cannot be expressed locally.

**Tests and docs**
- Create `backend/test/learning-progress.e2e-spec.ts`.
- Create `backend/test/lesson-notes.e2e-spec.ts`.
- Create `backend/test/lesson-transcripts.e2e-spec.ts`.
- Create `backend/test/quiz-review.e2e-spec.ts`.
- Create `frontend/src/features/learning/LearningPage.test.tsx`.
- Create `frontend/src/features/learning/LessonNotesPanel.test.tsx`.
- Create `frontend/src/features/learning/LessonTranscriptPanel.test.tsx`.
- Create `frontend/src/features/learning/QuizReviewPanel.test.tsx`.
- Create `tests/e2e/p6-learning-ux.spec.ts`.
- Modify `README.md` with P6 local smoke-test steps.

---

### Task 1: Shared Learning Contracts

**Files:**
- Modify: `shared/src/lessons.ts`
- Modify: `shared/src/progress.ts`
- Modify: `shared/src/quizzes.ts`
- Create: `shared/src/learning.ts`
- Modify: `shared/src/index.ts`

**Interfaces:**
- Produces:
  - `LessonTranscriptCueResponse`
  - `LessonTranscriptResponse`
  - `UpdateLessonProgressInput`
  - `LessonNoteResponse`
  - `CreateLessonNoteInput`
  - `UpdateLessonNoteInput`
  - `QuizReviewResponse`
  - `CourseQuizReviewResponse`

- [ ] **Step 1: Add the shared notes contract**

Create `shared/src/learning.ts`:

```ts
export interface LessonNoteResponse {
  id: string;
  userId: string;
  lessonId: string;
  body: string;
  positionSeconds: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLessonNoteInput {
  body: string;
  positionSeconds?: number | null;
}

export interface UpdateLessonNoteInput {
  body: string;
  positionSeconds?: number | null;
}
```

- [ ] **Step 2: Add transcript contracts**

Append to `shared/src/lessons.ts`:

```ts
export interface LessonTranscriptCueResponse {
  id: string;
  lessonId: string;
  startSeconds: number;
  endSeconds: number;
  text: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface LessonTranscriptResponse {
  lessonId: string;
  cues: LessonTranscriptCueResponse[];
}

export interface ReplaceLessonTranscriptInput {
  cues: Array<{
    startSeconds: number;
    endSeconds: number;
    text: string;
  }>;
}
```

- [ ] **Step 3: Add manual progress contract**

Append to `shared/src/progress.ts`:

```ts
export interface UpdateLessonProgressInput {
  positionSeconds?: number;
  completed?: boolean;
}
```

- [ ] **Step 4: Add quiz review contracts**

Append to `shared/src/quizzes.ts`:

```ts
export interface QuizReviewQuestionResponse {
  questionId: string;
  text: string;
  options: QuizOption[];
  correctOptionId: string;
  selectedOptionId: string | null;
  isCorrect: boolean | null;
  score: number;
  explanation: string | null;
  order: number;
}

export interface QuizReviewResponse {
  quizRunId: string;
  quizId: string;
  quizTitle: string;
  lessonId: string;
  lessonTitle: string;
  status: QuizRunStatus;
  startedAt: string;
  finishedAt: string | null;
  totalScore: number;
  questionCount: number;
  correctCount: number;
  questions: QuizReviewQuestionResponse[];
}

export interface CourseQuizReviewResponse {
  courseId: string;
  reviews: QuizReviewResponse[];
}
```

- [ ] **Step 5: Export contracts**

Update `shared/src/index.ts`:

```ts
export * from './learning';
```

- [ ] **Step 6: Verify and commit**

Run:

```bash
npm run typecheck:shared
```

Expected: PASS.

Commit:

```bash
git add shared/src
git commit -m "feat(shared): add learning ux contracts"
```

---

### Task 2: Prisma Learning Schema and Migration

**Files:**
- Modify: `backend/prisma/models/course.prisma`
- Modify: `backend/prisma/models/user.prisma`
- Modify: `backend/prisma/models/quiz.prisma`
- Create: `backend/prisma/models/learning.prisma`
- Create: `backend/prisma/migrations/*_p6_learning_ux/migration.sql`

**Interfaces:**
- Consumes: shared contracts from Task 1.
- Produces:
  - Prisma model `LessonNote`
  - Prisma model `LessonTranscriptCue`
  - nullable field `Question.explanation`

- [ ] **Step 1: Add relations to existing models**

Add to `Lesson` in `backend/prisma/models/course.prisma`:

```prisma
  transcriptCues LessonTranscriptCue[]
  notes LessonNote[]
```

Add to `User` in `backend/prisma/models/user.prisma`:

```prisma
  lessonNotes LessonNote[]
```

Add to `Question` in `backend/prisma/models/quiz.prisma`:

```prisma
  explanation String?
```

- [ ] **Step 2: Add learning models**

Create `backend/prisma/models/learning.prisma`:

```prisma
model LessonNote {
  id String @id @default(uuid())
  userId String
  lessonId String
  body String
  positionSeconds Int?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  lesson Lesson @relation(fields: [lessonId], references: [id], onDelete: Cascade)

  @@index([userId, lessonId, positionSeconds])
  @@index([lessonId])
}

model LessonTranscriptCue {
  id String @id @default(uuid())
  lessonId String
  startSeconds Int
  endSeconds Int
  text String
  order Int
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  lesson Lesson @relation(fields: [lessonId], references: [id], onDelete: Cascade)

  @@unique([lessonId, order])
  @@index([lessonId, startSeconds])
}
```

- [ ] **Step 3: Generate the migration without resetting data**

Run:

```bash
npm run db:migrate --workspace=backend -- --name p6_learning_ux
```

Expected: Prisma creates a migration and keeps existing data.

- [ ] **Step 4: Verify Prisma client and backend typecheck**

Run:

```bash
npm run typecheck:backend
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/prisma
git commit -m "feat(backend): add learning ux schema"
```

---

### Task 3: Manual Lesson Progress Endpoint

**Files:**
- Modify: `backend/src/modules/progress/progress.service.ts`
- Modify: `backend/src/modules/progress/progress.controller.ts`
- Create: `backend/test/learning-progress.e2e-spec.ts`

**Interfaces:**
- Consumes: `UpdateLessonProgressInput`.
- Produces:
  - `ProgressService.updateLessonProgress(user: AuthUser, lessonId: string, input: UpdateLessonProgressInput): Promise<LessonProgressResponse>`
  - `PATCH /api/me/lessons/:lessonId/progress`

- [ ] **Step 1: Write e2e coverage**

Create `backend/test/learning-progress.e2e-spec.ts` with tests for:

```ts
it('lets a student mark an enrolled lesson complete', async () => {
  await request(app.getHttpServer())
    .patch(`/api/me/lessons/${lessonId}/progress`)
    .set('Authorization', `Bearer ${studentToken}`)
    .send({ completed: true })
    .expect(200)
    .expect(({ body }) => {
      expect(body.lessonId).toBe(lessonId);
      expect(body.completedAt).toEqual(expect.any(String));
    });
});

it('rejects progress updates for lessons outside the learner enrollment', async () => {
  await request(app.getHttpServer())
    .patch(`/api/me/lessons/${unavailableLessonId}/progress`)
    .set('Authorization', `Bearer ${studentToken}`)
    .send({ completed: true })
    .expect(403);
});
```

- [ ] **Step 2: Run failing e2e**

Run:

```bash
npm run test:e2e --workspace=backend -- learning-progress.e2e-spec.ts
```

Expected: FAIL because the route does not exist.

- [ ] **Step 3: Implement service method**

Add this method shape to `ProgressService`:

```ts
async updateLessonProgress(
  user: AuthUser,
  lessonId: string,
  input: UpdateLessonProgressInput,
): Promise<LessonProgressResponse> {
  const lesson = await this.requireAccessibleLesson(user, lessonId);
  const completedAt = input.completed === undefined
    ? undefined
    : input.completed
      ? new Date()
      : null;

  const positionSeconds = Math.min(
    Math.max(input.positionSeconds ?? 0, 0),
    lesson.durationSeconds,
  );

  const progress = await this.prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId: user.id, lessonId } },
    create: {
      userId: user.id,
      lessonId,
      positionSeconds,
      completedAt: completedAt === undefined ? null : completedAt,
      lastWatchedAt: new Date(),
    },
    update: {
      positionSeconds,
      ...(completedAt !== undefined ? { completedAt } : {}),
      lastWatchedAt: new Date(),
    },
  });

  return this.toProgressResponse(progress);
}
```

- [ ] **Step 4: Add controller route and Swagger metadata**

Add to `ProgressController`:

```ts
@Patch('me/lessons/:lessonId/progress')
@ApiOperation({ summary: 'Update my lesson progress' })
async updateMyLessonProgress(
  @CurrentUser() user: AuthUser,
  @Param('lessonId') lessonId: string,
  @Body() input: UpdateLessonProgressInput,
) {
  return this.progressService.updateLessonProgress(user, lessonId, input);
}
```

- [ ] **Step 5: Verify and commit**

Run:

```bash
npm run test:e2e --workspace=backend -- learning-progress.e2e-spec.ts
npm run typecheck:backend
```

Expected: PASS.

Commit:

```bash
git add backend/src/modules/progress backend/test/learning-progress.e2e-spec.ts
git commit -m "feat(backend): add learner progress controls"
```

---

### Task 4: Lesson Notes Backend

**Files:**
- Create: `backend/src/modules/learning/learning.module.ts`
- Create: `backend/src/modules/learning/lesson-notes.service.ts`
- Create: `backend/src/modules/learning/lesson-notes.controller.ts`
- Modify: `backend/src/app.module.ts`
- Create: `backend/test/lesson-notes.e2e-spec.ts`

**Interfaces:**
- Consumes: `CreateLessonNoteInput`, `UpdateLessonNoteInput`, `LessonNoteResponse`.
- Produces:
  - `GET /api/me/lessons/:lessonId/notes`
  - `POST /api/me/lessons/:lessonId/notes`
  - `PATCH /api/me/lesson-notes/:noteId`
  - `DELETE /api/me/lesson-notes/:noteId`

- [ ] **Step 1: Write e2e coverage**

Create tests that assert:

```ts
it('creates, updates, lists, and deletes learner-owned notes', async () => {
  const createResponse = await request(app.getHttpServer())
    .post(`/api/me/lessons/${lessonId}/notes`)
    .set('Authorization', `Bearer ${studentToken}`)
    .send({ body: 'Review socket heartbeat timing.', positionSeconds: 145 })
    .expect(201);

  const noteId = createResponse.body.id;

  await request(app.getHttpServer())
    .patch(`/api/me/lesson-notes/${noteId}`)
    .set('Authorization', `Bearer ${studentToken}`)
    .send({ body: 'Review heartbeat and retry behavior.', positionSeconds: 150 })
    .expect(200);

  await request(app.getHttpServer())
    .get(`/api/me/lessons/${lessonId}/notes`)
    .set('Authorization', `Bearer ${studentToken}`)
    .expect(200)
    .expect(({ body }) => {
      expect(body).toHaveLength(1);
      expect(body[0].body).toBe('Review heartbeat and retry behavior.');
    });

  await request(app.getHttpServer())
    .delete(`/api/me/lesson-notes/${noteId}`)
    .set('Authorization', `Bearer ${studentToken}`)
    .expect(204);
});
```

- [ ] **Step 2: Run failing e2e**

Run:

```bash
npm run test:e2e --workspace=backend -- lesson-notes.e2e-spec.ts
```

Expected: FAIL because `LearningModule` does not exist.

- [ ] **Step 3: Implement `LessonNotesService`**

Implement methods with these exact signatures:

```ts
listMine(user: AuthUser, lessonId: string): Promise<LessonNoteResponse[]>
createMine(user: AuthUser, lessonId: string, input: CreateLessonNoteInput): Promise<LessonNoteResponse>
updateMine(user: AuthUser, noteId: string, input: UpdateLessonNoteInput): Promise<LessonNoteResponse>
deleteMine(user: AuthUser, noteId: string): Promise<void>
```

Rules:
- `body.trim()` must be 1 to 4000 characters.
- `positionSeconds` must be `null` or an integer from 0 to the lesson duration.
- Students can only note enrolled lessons.
- Instructors and admins can create their own notes for any course lesson they can access.
- Users can only update or delete their own notes.

- [ ] **Step 4: Implement controller and module**

Use `@ApiTags('learning')`, `@UseGuards(JwtAuthGuard)`, and the same auth decorators as existing modules.

- [ ] **Step 5: Verify and commit**

Run:

```bash
npm run test:e2e --workspace=backend -- lesson-notes.e2e-spec.ts
npm run typecheck:backend
```

Expected: PASS.

Commit:

```bash
git add backend/src/modules/learning backend/src/app.module.ts backend/test/lesson-notes.e2e-spec.ts
git commit -m "feat(backend): add lesson notes"
```

---

### Task 5: Lesson Transcript Backend and Seed Data

**Files:**
- Create: `backend/src/modules/learning/lesson-transcripts.service.ts`
- Create: `backend/src/modules/learning/lesson-transcripts.controller.ts`
- Modify: `backend/src/modules/learning/learning.module.ts`
- Modify: `backend/prisma/seeds/data.ts`
- Modify: `backend/prisma/seed.ts`
- Create: `backend/test/lesson-transcripts.e2e-spec.ts`

**Interfaces:**
- Consumes: `LessonTranscriptResponse`, `ReplaceLessonTranscriptInput`.
- Produces:
  - `GET /api/lessons/:lessonId/transcript`
  - `PUT /api/lessons/:lessonId/transcript`

- [ ] **Step 1: Write e2e coverage**

Create tests that assert:

```ts
it('returns transcript cues for an enrolled learner', async () => {
  await request(app.getHttpServer())
    .get(`/api/lessons/${lessonId}/transcript`)
    .set('Authorization', `Bearer ${studentToken}`)
    .expect(200)
    .expect(({ body }) => {
      expect(body.lessonId).toBe(lessonId);
      expect(body.cues.length).toBeGreaterThan(0);
      expect(body.cues[0]).toMatchObject({
        startSeconds: expect.any(Number),
        endSeconds: expect.any(Number),
        text: expect.any(String),
      });
    });
});

it('lets an instructor replace transcript cues for their lesson', async () => {
  await request(app.getHttpServer())
    .put(`/api/lessons/${lessonId}/transcript`)
    .set('Authorization', `Bearer ${instructorToken}`)
    .send({
      cues: [
        { startSeconds: 0, endSeconds: 12, text: 'Welcome to the realtime LMS lesson.' },
        { startSeconds: 12, endSeconds: 30, text: 'We will connect progress, chat, and quizzes.' },
      ],
    })
    .expect(200)
    .expect(({ body }) => {
      expect(body.cues).toHaveLength(2);
      expect(body.cues[1].order).toBe(2);
    });
});
```

- [ ] **Step 2: Run failing e2e**

Run:

```bash
npm run test:e2e --workspace=backend -- lesson-transcripts.e2e-spec.ts
```

Expected: FAIL because the transcript routes do not exist.

- [ ] **Step 3: Implement transcript service**

Implement methods:

```ts
getTranscript(user: AuthUser, lessonId: string): Promise<LessonTranscriptResponse>
replaceTranscript(
  user: AuthUser,
  lessonId: string,
  input: ReplaceLessonTranscriptInput,
): Promise<LessonTranscriptResponse>
```

Rules:
- Read access follows lesson access.
- Replace access is limited to `ADMIN` or the course instructor.
- Each cue text must trim to 1 to 1000 characters.
- `startSeconds` and `endSeconds` must be integers with `0 <= startSeconds < endSeconds <= lesson.durationSeconds`.
- Replacement deletes the previous cues for that lesson and inserts new cues with `order` starting at 1.

- [ ] **Step 4: Add seed transcript cues without clearing data**

Update `backend/prisma/seeds/data.ts` to add transcript cues for each existing lesson:

```ts
export const seedTranscriptCues = [
  {
    lessonOrder: 1,
    cues: [
      { startSeconds: 0, endSeconds: 20, text: 'Welcome to the realtime LMS foundations course.' },
      { startSeconds: 20, endSeconds: 55, text: 'This lesson introduces the learner, instructor, and admin workflows.' },
      { startSeconds: 55, endSeconds: 95, text: 'By the end, you will understand how course sessions connect with progress tracking.' },
    ],
  },
];
```

Update `backend/prisma/seed.ts` to upsert transcript cues by `lessonId` and `order`, without deleting users, enrollments, sessions, or progress.

- [ ] **Step 5: Verify and commit**

Run:

```bash
npm run db:seed --workspace=backend
npm run test:e2e --workspace=backend -- lesson-transcripts.e2e-spec.ts
npm run typecheck:backend
```

Expected: PASS.

Commit:

```bash
git add backend/src/modules/learning backend/prisma backend/test/lesson-transcripts.e2e-spec.ts
git commit -m "feat(backend): add lesson transcripts"
```

---

### Task 6: Quiz Review Backend and Seed Explanations

**Files:**
- Modify: `backend/src/modules/quizzes/quizzes.service.ts`
- Modify: `backend/src/modules/quizzes/quizzes.controller.ts`
- Modify: `backend/prisma/seeds/data.ts`
- Modify: `backend/prisma/seed.ts`
- Create: `backend/test/quiz-review.e2e-spec.ts`

**Interfaces:**
- Consumes: `QuizReviewResponse`, `CourseQuizReviewResponse`.
- Produces:
  - `QuizzesService.getMyCourseQuizReviews(courseId: string, user: AuthUser): Promise<CourseQuizReviewResponse>`
  - `GET /api/me/courses/:courseId/quiz-reviews`

- [ ] **Step 1: Write e2e coverage**

Create a test that creates a finished run with one answer, then asserts:

```ts
await request(app.getHttpServer())
  .get(`/api/me/courses/${courseId}/quiz-reviews`)
  .set('Authorization', `Bearer ${studentToken}`)
  .expect(200)
  .expect(({ body }) => {
    expect(body.courseId).toBe(courseId);
    expect(body.reviews[0]).toMatchObject({
      quizRunId: expect.any(String),
      quizTitle: expect.any(String),
      lessonId: expect.any(String),
      totalScore: expect.any(Number),
      questionCount: expect.any(Number),
      correctCount: expect.any(Number),
    });
    expect(body.reviews[0].questions[0]).toMatchObject({
      correctOptionId: expect.any(String),
      explanation: expect.any(String),
    });
  });
```

- [ ] **Step 2: Run failing e2e**

Run:

```bash
npm run test:e2e --workspace=backend -- quiz-review.e2e-spec.ts
```

Expected: FAIL because the review endpoint does not exist.

- [ ] **Step 3: Add question explanations to seed data**

Add `explanation` to each seeded question in `backend/prisma/seeds/data.ts`, for example:

```ts
explanation: 'Heartbeat events keep learner progress current without waiting for a manual save action.',
```

Update the seed upsert logic to write `explanation` along with question text, options, correct option, and order.

- [ ] **Step 4: Implement review query**

In `QuizzesService`, query finished and revealed quiz runs in the course, scoped to the current user answers:

```ts
async getMyCourseQuizReviews(
  courseId: string,
  user: AuthUser,
): Promise<CourseQuizReviewResponse> {
  await this.coursesService.requireCourseAccess(courseId, user);
  const runs = await this.prisma.quizRun.findMany({
    where: {
      status: 'FINISHED',
      quiz: { lesson: { courseId } },
      answers: { some: { userId: user.id } },
    },
    include: {
      quiz: { include: { lesson: true, questions: { orderBy: { order: 'asc' } } } },
      answers: { where: { userId: user.id } },
    },
    orderBy: { finishedAt: 'desc' },
  });

  return {
    courseId,
    reviews: runs.map((run) => this.toQuizReviewResponse(run, user.id)),
  };
}
```

- [ ] **Step 5: Add controller route**

Add to `QuizzesController`:

```ts
@Get('me/courses/:courseId/quiz-reviews')
@ApiOperation({ summary: 'List my completed quiz reviews for a course' })
getMyCourseQuizReviews(
  @Param('courseId') courseId: string,
  @CurrentUser() user: AuthUser,
) {
  return this.quizzesService.getMyCourseQuizReviews(courseId, user);
}
```

- [ ] **Step 6: Verify and commit**

Run:

```bash
npm run db:seed --workspace=backend
npm run test:e2e --workspace=backend -- quiz-review.e2e-spec.ts
npm run typecheck:backend
```

Expected: PASS.

Commit:

```bash
git add backend/src/modules/quizzes backend/prisma backend/test/quiz-review.e2e-spec.ts
git commit -m "feat(backend): add learner quiz reviews"
```

---

### Task 7: Frontend Learning Route, Navigation, and Player

**Files:**
- Create: `frontend/src/api/learning.ts`
- Modify: `frontend/src/api/progress.ts`
- Modify: `frontend/src/app/routes.tsx`
- Create: `frontend/src/features/learning/LearningPage.tsx`
- Create: `frontend/src/features/learning/LearningLessonNav.tsx`
- Create: `frontend/src/features/learning/LearningPlayer.tsx`
- Create: `frontend/src/features/learning/LearningPage.test.tsx`
- Modify: `frontend/src/features/courses/CourseDetailPage.tsx`

**Interfaces:**
- Consumes:
  - `GET /api/courses/:courseId/lessons`
  - `GET /api/me/courses/:courseId/progress`
  - `PATCH /api/me/lessons/:lessonId/progress`
- Produces:
  - Route `/courses/:courseId/learn`
  - `updateLessonProgress(lessonId: string, input: UpdateLessonProgressInput): Promise<LessonProgressResponse>`

- [ ] **Step 1: Add API helper**

Add to `frontend/src/api/progress.ts`:

```ts
export async function updateLessonProgress(
  lessonId: string,
  input: UpdateLessonProgressInput,
): Promise<LessonProgressResponse> {
  const { data } = await http.patch<LessonProgressResponse>(
    `/me/lessons/${lessonId}/progress`,
    input,
  );
  return data;
}
```

- [ ] **Step 2: Write component test for learning route shell**

Create `frontend/src/features/learning/LearningPage.test.tsx` and assert:

```tsx
expect(screen.getByRole('heading', { name: /Learning workspace/i })).toBeInTheDocument();
expect(screen.getByRole('button', { name: /Mark complete/i })).toBeInTheDocument();
expect(screen.getByText(/Lesson 1/i)).toBeInTheDocument();
```

- [ ] **Step 3: Run failing frontend test**

Run:

```bash
npm run test --workspace=frontend -- LearningPage.test.tsx
```

Expected: FAIL because `LearningPage` does not exist.

- [ ] **Step 4: Implement page and route**

Build `LearningPage` with:
- left lesson navigation on desktop, top segmented lesson selector on mobile.
- main lesson player surface with title, duration, resume position, progress bar, and icon-only complete/reset actions with tooltips.
- right rail reserved for notes, transcript, and quiz review panels added in later tasks.

Add route in `frontend/src/app/routes.tsx`:

```tsx
<Route
  path="/courses/:courseId/learn"
  element={
    <ProtectedRoute>
      <AppShell>
        <LearningPage />
      </AppShell>
    </ProtectedRoute>
  }
/>
```

- [ ] **Step 5: Add course CTA**

In `CourseDetailPage`, add a student-facing `Continue learning` action linking to `/courses/${courseId}/learn`. Keep instructor/admin management actions unchanged.

- [ ] **Step 6: Verify and commit**

Run:

```bash
npm run test --workspace=frontend -- LearningPage.test.tsx
npm run typecheck:frontend
npm run build:frontend
```

Expected: PASS.

Commit:

```bash
git add frontend/src/api/progress.ts frontend/src/app/routes.tsx frontend/src/features/learning frontend/src/features/courses/CourseDetailPage.tsx
git commit -m "feat(frontend): add learning workspace"
```

---

### Task 8: Frontend Notes and Transcript Panels

**Files:**
- Modify: `frontend/src/api/learning.ts`
- Create: `frontend/src/features/learning/LessonNotesPanel.tsx`
- Create: `frontend/src/features/learning/LessonTranscriptPanel.tsx`
- Create: `frontend/src/features/learning/LessonNotesPanel.test.tsx`
- Create: `frontend/src/features/learning/LessonTranscriptPanel.test.tsx`
- Modify: `frontend/src/features/learning/LearningPage.tsx`

**Interfaces:**
- Consumes:
  - `GET /api/me/lessons/:lessonId/notes`
  - `POST /api/me/lessons/:lessonId/notes`
  - `PATCH /api/me/lesson-notes/:noteId`
  - `DELETE /api/me/lesson-notes/:noteId`
  - `GET /api/lessons/:lessonId/transcript`
- Produces:
  - `listLessonNotes(lessonId: string): Promise<LessonNoteResponse[]>`
  - `createLessonNote(lessonId: string, input: CreateLessonNoteInput): Promise<LessonNoteResponse>`
  - `updateLessonNote(noteId: string, input: UpdateLessonNoteInput): Promise<LessonNoteResponse>`
  - `deleteLessonNote(noteId: string): Promise<void>`
  - `getLessonTranscript(lessonId: string): Promise<LessonTranscriptResponse>`

- [ ] **Step 1: Add API helpers**

Create `frontend/src/api/learning.ts`:

```ts
export async function listLessonNotes(lessonId: string): Promise<LessonNoteResponse[]> {
  const { data } = await http.get<LessonNoteResponse[]>(`/me/lessons/${lessonId}/notes`);
  return data;
}

export async function createLessonNote(
  lessonId: string,
  input: CreateLessonNoteInput,
): Promise<LessonNoteResponse> {
  const { data } = await http.post<LessonNoteResponse>(`/me/lessons/${lessonId}/notes`, input);
  return data;
}

export async function updateLessonNote(
  noteId: string,
  input: UpdateLessonNoteInput,
): Promise<LessonNoteResponse> {
  const { data } = await http.patch<LessonNoteResponse>(`/me/lesson-notes/${noteId}`, input);
  return data;
}

export async function deleteLessonNote(noteId: string): Promise<void> {
  await http.delete(`/me/lesson-notes/${noteId}`);
}

export async function getLessonTranscript(lessonId: string): Promise<LessonTranscriptResponse> {
  const { data } = await http.get<LessonTranscriptResponse>(`/lessons/${lessonId}/transcript`);
  return data;
}
```

- [ ] **Step 2: Write panel tests**

Assert that notes can render, enter edit mode, and call delete. Assert that transcript cues render as compact timestamp rows and clicking a cue calls `onSeek(startSeconds)`.

- [ ] **Step 3: Run failing frontend tests**

Run:

```bash
npm run test --workspace=frontend -- LessonNotesPanel.test.tsx LessonTranscriptPanel.test.tsx
```

Expected: FAIL because the panels do not exist.

- [ ] **Step 4: Implement notes panel**

`LessonNotesPanel` props:

```ts
interface LessonNotesPanelProps {
  lessonId: string;
  currentPositionSeconds: number;
}
```

Behavior:
- textarea for a new note, max 4000 characters.
- save button disabled while empty after trim.
- notes sorted newest first.
- note actions use icon buttons only with hover tooltips.

- [ ] **Step 5: Implement transcript panel**

`LessonTranscriptPanel` props:

```ts
interface LessonTranscriptPanelProps {
  lessonId: string;
  activeSecond: number;
  onSeek: (seconds: number) => void;
}
```

Behavior:
- timestamp chips fit content.
- active cue has a subtle shadcn accent border.
- empty transcript uses concise English copy: `No transcript available`.

- [ ] **Step 6: Wire panels into `LearningPage`**

Render notes and transcript in a tabbed right rail with labels `Notes` and `Transcript`. On mobile, render the same tabs below the player.

- [ ] **Step 7: Verify and commit**

Run:

```bash
npm run test --workspace=frontend -- LessonNotesPanel.test.tsx LessonTranscriptPanel.test.tsx
npm run typecheck:frontend
npm run build:frontend
```

Expected: PASS.

Commit:

```bash
git add frontend/src/api/learning.ts frontend/src/features/learning
git commit -m "feat(frontend): add notes and transcript panels"
```

---

### Task 9: Frontend Quiz Review Flow

**Files:**
- Modify: `frontend/src/api/quizzes.ts`
- Create: `frontend/src/features/learning/QuizReviewPanel.tsx`
- Create: `frontend/src/features/learning/QuizReviewPanel.test.tsx`
- Modify: `frontend/src/features/learning/LearningPage.tsx`

**Interfaces:**
- Consumes:
  - `GET /api/me/courses/:courseId/quiz-reviews`
- Produces:
  - `getMyCourseQuizReviews(courseId: string): Promise<CourseQuizReviewResponse>`
  - `QuizReviewPanel`

- [ ] **Step 1: Add quiz review API helper**

Add to `frontend/src/api/quizzes.ts`:

```ts
export async function getMyCourseQuizReviews(
  courseId: string,
): Promise<CourseQuizReviewResponse> {
  const { data } = await http.get<CourseQuizReviewResponse>(
    `/me/courses/${courseId}/quiz-reviews`,
  );
  return data;
}
```

- [ ] **Step 2: Write panel test**

Create `QuizReviewPanel.test.tsx` with assertions:

```tsx
expect(screen.getByText('Quiz review')).toBeInTheDocument();
expect(screen.getByText('2 / 3 correct')).toBeInTheDocument();
expect(screen.getByRole('button', { name: /Review lesson/i })).toBeInTheDocument();
expect(screen.getByText('Heartbeat events keep learner progress current')).toBeInTheDocument();
```

- [ ] **Step 3: Run failing frontend test**

Run:

```bash
npm run test --workspace=frontend -- QuizReviewPanel.test.tsx
```

Expected: FAIL because `QuizReviewPanel` does not exist.

- [ ] **Step 4: Implement `QuizReviewPanel`**

Props:

```ts
interface QuizReviewPanelProps {
  courseId: string;
  activeLessonId: string | null;
  onSelectLesson: (lessonId: string) => void;
}
```

Behavior:
- show finished reviews newest first.
- display compact result labels like `2 / 3 correct`.
- use check and cross icons for answers.
- `Review lesson` action calls `onSelectLesson(review.lessonId)`.
- empty state copy: `Completed quiz reviews will appear here.`

- [ ] **Step 5: Wire into `LearningPage`**

Add the third tab `Quiz review` to the learning right rail. Selecting `Review lesson` changes the active lesson and scrolls the player heading into view.

- [ ] **Step 6: Verify and commit**

Run:

```bash
npm run test --workspace=frontend -- QuizReviewPanel.test.tsx
npm run typecheck:frontend
npm run build:frontend
```

Expected: PASS.

Commit:

```bash
git add frontend/src/api/quizzes.ts frontend/src/features/learning
git commit -m "feat(frontend): add quiz review flow"
```

---

### Task 10: Learning UX Playwright Smoke Test and Documentation

**Files:**
- Create: `tests/e2e/p6-learning-ux.spec.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: completed backend and frontend from Tasks 1-9.
- Produces: repeatable smoke coverage for `/courses/:courseId/learn`.

- [ ] **Step 1: Write Playwright test**

Create `tests/e2e/p6-learning-ux.spec.ts`:

```ts
test('student can use the learning workspace', async ({ page }) => {
  await loginAs(page, 'student@example.com', 'Password123!');
  await page.goto('/courses');
  await page.getByRole('link', { name: /Realtime LMS Foundations/i }).click();
  await page.getByRole('link', { name: /Continue learning/i }).click();
  await expect(page.getByRole('heading', { name: /Learning workspace/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Mark complete/i })).toBeVisible();
  await page.getByRole('button', { name: /Mark complete/i }).click();
  await expect(page.getByText(/Completed/i)).toBeVisible();
  await page.getByRole('tab', { name: /Transcript/i }).click();
  await expect(page.getByText(/Welcome to the realtime LMS foundations course/i)).toBeVisible();
  await page.getByRole('tab', { name: /Notes/i }).click();
  await page.getByRole('textbox', { name: /New note/i }).fill('Review this section before the live quiz.');
  await page.getByRole('button', { name: /Save note/i }).click();
  await expect(page.getByText('Review this section before the live quiz.')).toBeVisible();
});
```

- [ ] **Step 2: Add README smoke steps**

Add:

```md
### P6 Learning UX Smoke Test

1. Run `npm run dev:backend` and `npm run dev:frontend` in separate terminals.
2. Seed without reset when preserving data: `npm run db:seed`.
3. Sign in as `student@example.com` with `Password123!`.
4. Open `/courses`, select `Realtime LMS Foundations`, then choose `Continue learning`.
5. Verify lesson progress, notes, transcript, and quiz review panels render.
```

- [ ] **Step 3: Verify and commit**

Run:

```bash
npm run test:e2e:ui -- tests/e2e/p6-learning-ux.spec.ts
npm run typecheck
npm run build
```

Expected: PASS.

Commit:

```bash
git add tests/e2e/p6-learning-ux.spec.ts README.md
git commit -m "test(e2e): cover learning workspace"
```

---

### Task 11: Final Verification and Branch Handoff

**Files:**
- Modify: `docs/superpowers/plans/2026-09-09-lms-realtime-p6-learning-ux.md`

**Interfaces:**
- Consumes: all previous tasks.
- Produces: checked plan boxes and a ready-to-review branch.

- [ ] **Step 1: Run full verification**

Run:

```bash
npm run typecheck
npm run build
npm run test:e2e --workspace=backend
npm run test:e2e:ui
```

Expected: PASS.

- [ ] **Step 2: Update the plan checklist**

Mark all completed task checkboxes in this file from `- [ ]` to `- [x]` for implemented steps only.

- [ ] **Step 3: Inspect git status**

Run:

```bash
git status --short --branch
```

Expected: only the plan checklist file is modified before the final commit.

- [ ] **Step 4: Commit plan checklist**

```bash
git add docs/superpowers/plans/2026-09-09-lms-realtime-p6-learning-ux.md
git commit -m "docs(plan): complete p6 learning ux checklist"
```

- [ ] **Step 5: Push branch**

```bash
git push -u github p6-learning-ux
```

Expected: branch is available for pull request creation.

---

## Self-Review

**Spec coverage:** This plan covers the next P5 recommendation for Learning UX: lesson completion controls, notes, captions/transcripts, and quiz-to-lesson review flows. It preserves the existing realtime session flow and keeps media playback through the current media asset/presigned URL path.

**Placeholder scan:** The plan avoids banned placeholder wording and vague implementation-only steps. Each task has concrete files, interfaces, test commands, verification commands, and commit commands.

**Type consistency:** Shared contracts are introduced before backend and frontend consumption. Backend route names match frontend API helper paths. Quiz review field names are consistent across shared, backend, frontend, and Playwright assertions.

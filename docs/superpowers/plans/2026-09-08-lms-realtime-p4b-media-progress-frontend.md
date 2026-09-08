# LMS Realtime P4b Media & Progress Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add frontend support for instructor video upload, student lesson playback, realtime watch heartbeats, and course progress visibility.

**Architecture:** Keep the existing Vite React app, React Query data layer, Zustand auth store, Socket.IO helper, and shadcn-owned component base. Add small API modules for media/progress, keep upload/playback logic in feature components, and reuse `/sessions` sockets for `progress:heartbeat` and `progress:updated`. The UI stays a dark shadcn product dashboard: compact, readable, no marketing hero, no decorative motion.

**Tech Stack:** Vite 5, React 18, TypeScript strict mode, React Router 7, TanStack Query 5, Zustand, Axios, Socket.IO client, Tailwind CSS 4, shadcn/ui owned components, lucide-react icons, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-26-lms-realtime-design.md`

**Backend Dependency:** P3b completed through `docs/superpowers/plans/2026-09-03-lms-realtime-p3b-media-progress-backend.md`.

**Design Read:** B2B learning operations dashboard for instructors and students, with a restrained shadcn dark product language, leaning toward shadcn dashboard blocks and dense app surfaces.

**Design Dials:** `DESIGN_VARIANCE: 4`, `MOTION_INTENSITY: 2`, `VISUAL_DENSITY: 7`.

## Global Constraints

- Frontend dev port is `5173`; backend dev port is `4000`.
- All visible product UI copy must be English.
- Keep the app dark theme locked with existing CSS variables.
- Use shadcn-owned primitives from `frontend/src/components/ui/*` for new reusable controls.
- Keep lucide-react as the only icon family because the project already depends on it.
- Do not add hero sections or marketing layouts inside the product UI.
- Cards use the existing radius scale, max `8px`.
- Forms use labels above inputs. Never use placeholders as the only label.
- Tables/lists must fit the page without horizontal scroll at desktop.
- New frontend features must have Vitest coverage before implementation.
- After each implementation task, run `npm.cmd run build:frontend`.

---

## File Structure

```text
frontend/
  src/
    api/
      media.ts
      progress.ts
    components/
      ui/
        progress.tsx
        tooltip.tsx
    features/
      courses/
        CourseDetailPage.tsx
        CourseDetailPage.test.tsx
      lessons/
        LessonMediaUpload.tsx
        LessonProgressList.tsx
        LessonsPanel.tsx
        LessonsPanel.test.tsx
      progress/
        InstructorProgressPanel.tsx
        ProgressSummary.tsx
      sessions/
        LiveSessionPage.tsx
        LiveSessionPage.test.tsx
        LessonPlaybackPanel.tsx
    lib/
      realtime.ts
shared/
  src/
    realtime.ts
```

---

### Task 1: Frontend API Clients And UI Primitives

**Files:**
- Create: `frontend/src/api/media.ts`
- Create: `frontend/src/api/progress.ts`
- Create: `frontend/src/components/ui/progress.tsx`
- Create: `frontend/src/components/ui/tooltip.tsx`
- Modify: `frontend/src/lib/realtime.ts`
- Modify: `frontend/src/api/client.test.ts`
- Modify: `frontend/src/lib/realtime.test.ts`

**Interfaces:**
- Produces: `createMediaUpload(input): Promise<CreateMediaUploadResponse>`.
- Produces: `completeMediaUpload(assetId): Promise<CompletedMediaAssetResponse>`.
- Produces: `getMediaPlayback(assetId): Promise<MediaPlaybackResponse>`.
- Produces: `getMyCourseProgress(courseId): Promise<CourseProgressResponse>`.
- Produces: `getCourseProgress(courseId): Promise<InstructorCourseProgressResponse>`.
- Produces: `emitProgressHeartbeat(socket, payload): void`.
- Consumes: `CreateMediaUploadResponse`, `MediaPlaybackResponse`, `CourseProgressResponse`, `InstructorCourseProgressResponse`, `ProgressHeartbeatPayload`.

- [x] **Step 1.1: Write API client tests**

Add tests that verify:

```ts
expect(createMediaUpload({ fileName: 'intro.mp4', contentType: 'video/mp4', sizeBytes: 123 })).resolves.toMatchObject({
  assetId: 'asset-1',
});
expect(getMediaPlayback('asset-1')).resolves.toMatchObject({ playbackUrl: 'http://localhost/video.mp4' });
expect(getMyCourseProgress('course-1')).resolves.toMatchObject({ percent: 50 });
expect(getCourseProgress('course-1')).resolves.toMatchObject({ totalLessons: 2 });
```

- [x] **Step 1.2: Write realtime helper test**

Add a test that creates a mock socket and verifies:

```ts
emitProgressHeartbeat(socket, { lessonId: 'lesson-1', positionSeconds: 42 });
expect(socket.emit).toHaveBeenCalledWith('progress:heartbeat', {
  lessonId: 'lesson-1',
  positionSeconds: 42,
});
```

- [x] **Step 1.3: Run tests to verify failure**

Run:

```bash
npm.cmd run test --workspace=frontend -- client.test.ts realtime.test.ts
```

Expected: fail because `media.ts`, `progress.ts`, and `emitProgressHeartbeat()` do not exist yet.

- [x] **Step 1.4: Implement media and progress API modules**

Use `postEnvelope`, `getEnvelope`, and existing shared contracts:

```ts
export async function createMediaUpload(input: CreateMediaUploadInput): Promise<CreateMediaUploadResponse>;
export async function completeMediaUpload(assetId: string): Promise<CompletedMediaAssetResponse>;
export async function getMediaPlayback(assetId: string): Promise<MediaPlaybackResponse>;
export async function getMyCourseProgress(courseId: string): Promise<CourseProgressResponse>;
export async function getCourseProgress(courseId: string): Promise<InstructorCourseProgressResponse>;
```

- [x] **Step 1.5: Add shadcn progress and tooltip primitives**

Create owned primitives compatible with the existing token system:

```tsx
<Progress value={percent} aria-label="Course progress" />
<TooltipProvider><Tooltip><TooltipTrigger /><TooltipContent /></Tooltip></TooltipProvider>
```

- [x] **Step 1.6: Add realtime heartbeat helper**

Add:

```ts
export function emitProgressHeartbeat(
  socket: { emit: (event: 'progress:heartbeat', payload: ProgressHeartbeatPayload) => unknown },
  payload: ProgressHeartbeatPayload,
): void {
  socket.emit('progress:heartbeat', payload);
}
```

- [x] **Step 1.7: Verify Task 1**

Run:

```bash
npm.cmd run test --workspace=frontend -- client.test.ts realtime.test.ts
npm.cmd run build:frontend
```

Expected: tests and frontend build pass.

- [x] **Step 1.8: Commit Task 1**

Run:

```bash
git add frontend/src/api/media.ts frontend/src/api/progress.ts frontend/src/components/ui/progress.tsx frontend/src/components/ui/tooltip.tsx frontend/src/lib/realtime.ts frontend/src/api/client.test.ts frontend/src/lib/realtime.test.ts
git commit -m "feat(frontend): add media progress clients"
git push
```

---

### Task 2: Instructor Lesson Video Upload UI

**Files:**
- Create: `frontend/src/features/lessons/LessonMediaUpload.tsx`
- Modify: `frontend/src/features/lessons/LessonsPanel.tsx`
- Create: `frontend/src/features/lessons/LessonsPanel.test.tsx`

**Interfaces:**
- Consumes: `createMediaUpload(input)`, `completeMediaUpload(assetId)`, `updateLesson(id, { mediaAssetId })`.
- Produces: instructor-only upload action per lesson.
- Produces: visible media state per lesson: `No video`, `Video attached`, `Upload pending`, `Upload failed`.

- [x] **Step 2.1: Write lesson upload tests**

Verify:
- Instructor sees an icon-only upload action on each lesson row.
- Student does not see upload actions.
- Selecting a `video/mp4` file calls `createMediaUpload()`, uploads to `uploadUrl` with `fetch(..., { method: 'PUT', body: file })`, calls `completeMediaUpload()`, then calls `updateLesson()`.
- Selecting `text/plain` shows `Only MP4 or WebM video files are supported.` and does not call the API.

- [x] **Step 2.2: Run tests to verify failure**

Run:

```bash
npm.cmd run test --workspace=frontend -- LessonsPanel.test.tsx
```

Expected: fail because upload controls do not exist.

- [x] **Step 2.3: Implement `LessonMediaUpload`**

Use an icon-only shadcn button with tooltip text `Upload video`. Keep file input visually hidden but accessible through the button label. Validate content type before API calls.

- [x] **Step 2.4: Integrate upload into lesson rows**

Pass `canManage` into `LessonRow`. Show:
- media badge `Video attached` when `lesson.mediaAssetId` exists.
- media badge `No video` when missing.
- upload action only for managers.

- [x] **Step 2.5: Handle loading and errors inline**

During upload, disable the row action and show `Upload pending`. On failure, show the API error under the row.

- [x] **Step 2.6: Verify Task 2**

Run:

```bash
npm.cmd run test --workspace=frontend -- LessonsPanel.test.tsx
npm.cmd run build:frontend
```

Expected: tests and frontend build pass.

- [x] **Step 2.7: Commit Task 2**

Run:

```bash
git add frontend/src/features/lessons/LessonMediaUpload.tsx frontend/src/features/lessons/LessonsPanel.tsx frontend/src/features/lessons/LessonsPanel.test.tsx
git commit -m "feat(frontend): add lesson video upload"
git push
```

---

### Task 3: Student Playback And Heartbeat UI

**Files:**
- Create: `frontend/src/features/sessions/LessonPlaybackPanel.tsx`
- Modify: `frontend/src/features/sessions/LiveSessionPage.tsx`
- Modify: `frontend/src/features/sessions/LiveSessionPage.test.tsx`

**Interfaces:**
- Consumes: `listLessons(courseId)` after resolving the active session's course context.
- Consumes: `getMediaPlayback(assetId)`.
- Consumes: `emitProgressHeartbeat(socket, { lessonId, positionSeconds })`.
- Produces: a lesson playback stage that replaces the current `No stream attached` empty state.

- [ ] **Step 3.1: Write playback tests**

Verify:
- Live room renders a lesson selector when lessons exist.
- Selecting a lesson with `mediaAssetId` calls `getMediaPlayback(assetId)` and renders `<video src="...">`.
- Selecting a lesson without media shows `No video attached`.
- Video `timeupdate` emits `progress:heartbeat` with current lesson id and floored seconds.
- Heartbeats are throttled to at most once every 10 seconds per lesson.

- [ ] **Step 3.2: Run tests to verify failure**

Run:

```bash
npm.cmd run test --workspace=frontend -- LiveSessionPage.test.tsx
```

Expected: fail because playback panel and heartbeat wiring do not exist.

- [ ] **Step 3.3: Add course context to live room**

Use session state data or add a lightweight API call if needed. The implementation must know `courseId` before calling `listLessons(courseId)`.

- [ ] **Step 3.4: Implement `LessonPlaybackPanel`**

Use a shadcn panel layout with:
- lesson select at top.
- stable video viewport with `aspect-ratio: 16 / 9`.
- playback loading skeleton.
- inline error banner.
- compact progress metadata below the player.

- [ ] **Step 3.5: Emit throttled heartbeats**

On video `timeupdate`, emit only when:
- socket exists and is connected.
- selected lesson id exists.
- `Math.floor(video.currentTime)` is at least 10 seconds beyond the last emitted position, or the lesson reaches duration.

- [ ] **Step 3.6: Verify Task 3**

Run:

```bash
npm.cmd run test --workspace=frontend -- LiveSessionPage.test.tsx
npm.cmd run build:frontend
```

Expected: tests and frontend build pass.

- [ ] **Step 3.7: Commit Task 3**

Run:

```bash
git add frontend/src/features/sessions/LessonPlaybackPanel.tsx frontend/src/features/sessions/LiveSessionPage.tsx frontend/src/features/sessions/LiveSessionPage.test.tsx
git commit -m "feat(frontend): add lesson playback heartbeat"
git push
```

---

### Task 4: Course Progress Surfaces

**Files:**
- Create: `frontend/src/features/progress/ProgressSummary.tsx`
- Create: `frontend/src/features/progress/InstructorProgressPanel.tsx`
- Modify: `frontend/src/features/courses/CourseDetailPage.tsx`
- Create: `frontend/src/features/courses/CourseDetailPage.test.tsx`

**Interfaces:**
- Consumes: `getMyCourseProgress(courseId)`.
- Consumes: `getCourseProgress(courseId)`.
- Consumes: `/sessions` event `progress:updated`.
- Produces: student course progress summary on course detail.
- Produces: instructor per-student progress table on course detail.

- [ ] **Step 4.1: Write progress surface tests**

Verify:
- Student detail page renders percent, completed lesson count, and lesson progress rows.
- Instructor detail page renders per-student progress rows.
- `progress:updated` invalidates instructor progress query for the matching course.
- Empty progress states use English copy and do not show raw JSON or IDs as primary text.

- [ ] **Step 4.2: Run tests to verify failure**

Run:

```bash
npm.cmd run test --workspace=frontend -- CourseDetailPage.test.tsx
```

Expected: fail because progress panels do not exist.

- [ ] **Step 4.3: Implement `ProgressSummary`**

Use the shadcn progress primitive, compact stats, and a lesson list with fit-content completion badges. Do not use large background progress tracks for every row.

- [ ] **Step 4.4: Implement `InstructorProgressPanel`**

Use a balanced table-like grid:
- Student
- Completed
- Progress
- Last watched

Keep labels fit-content and actions icon-only when actions are introduced later.

- [ ] **Step 4.5: Wire progress into course detail**

Render student progress for students. Render instructor progress for instructors/admins. Keep lesson/session panels in the existing two-column dashboard grid.

- [ ] **Step 4.6: Wire realtime invalidation**

When a `progress:updated` event arrives for the active course, invalidate:

```ts
['course-progress', courseId]
['my-course-progress', courseId]
```

- [ ] **Step 4.7: Verify Task 4**

Run:

```bash
npm.cmd run test --workspace=frontend -- CourseDetailPage.test.tsx
npm.cmd run build:frontend
```

Expected: tests and frontend build pass.

- [ ] **Step 4.8: Commit Task 4**

Run:

```bash
git add frontend/src/features/progress/ProgressSummary.tsx frontend/src/features/progress/InstructorProgressPanel.tsx frontend/src/features/courses/CourseDetailPage.tsx frontend/src/features/courses/CourseDetailPage.test.tsx
git commit -m "feat(frontend): show course progress"
git push
```

---

### Task 5: UI Polish, Local Smoke, And Final Verification

**Files:**
- Modify: `frontend/src/styles/global.css`
- Modify: `frontend/src/features/lessons/LessonsPanel.tsx`
- Modify: `frontend/src/features/sessions/LiveSessionPage.tsx`
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-09-08-lms-realtime-p4b-media-progress-frontend.md`

**Interfaces:**
- Consumes: all P4b UI pieces.
- Produces: visually consistent dark shadcn media/progress workflow.
- Produces: README smoke steps for upload, playback, and progress.

- [ ] **Step 5.1: Audit desktop and mobile layout**

Use local browser or screenshots at:
- `1440x900`
- `1024x768`
- `390x844`

Check:
- no text overlap.
- no desktop horizontal scroll.
- video panel keeps 16:9 aspect ratio.
- progress labels fit content.
- buttons are readable and do not wrap.

- [ ] **Step 5.2: Polish CSS only where needed**

Adjust spacing, grid widths, panel heights, tooltip layering, and empty/loading states. Keep dark theme tokens and radius scale consistent.

- [ ] **Step 5.3: Update README frontend smoke**

Add steps for:
- instructor uploads a lesson video.
- student plays lesson video.
- student progress updates after playback.
- instructor sees progress update.

- [ ] **Step 5.4: Run final verification**

Run:

```bash
npm.cmd run test:frontend
npm.cmd run build:frontend
npm.cmd run test:e2e --workspace=backend
npm.cmd run build:backend
```

Expected: frontend tests/build, backend e2e, and backend build pass.

- [ ] **Step 5.5: Mark plan complete**

Check off every completed task and acceptance item in this plan.

- [ ] **Step 5.6: Commit Task 5**

Run:

```bash
git add README.md frontend/src/styles/global.css frontend/src/features/lessons/LessonsPanel.tsx frontend/src/features/sessions/LiveSessionPage.tsx docs/superpowers/plans/2026-09-08-lms-realtime-p4b-media-progress-frontend.md
git commit -m "docs(frontend): document media progress smoke"
git push
```

---

## P4b Acceptance Checklist

- [x] Instructor/admin can create lesson video uploads from the lesson list.
- [x] Upload UI accepts only `video/mp4` and `video/webm`.
- [x] Upload UI attaches completed media asset to the lesson.
- [ ] Student can select a lesson and play private media through a backend playback URL.
- [ ] Student playback emits throttled `progress:heartbeat` events.
- [ ] Student course detail shows course percent and per-lesson progress.
- [ ] Instructor course detail shows per-student progress.
- [ ] Instructor progress refreshes after realtime `progress:updated`.
- [ ] All new visible UI copy is English.
- [ ] shadcn dark theme remains the only product UI theme.
- [ ] Desktop and mobile layouts have no incoherent overlap or desktop table scroll.
- [ ] `npm.cmd run test:frontend` passes.
- [ ] `npm.cmd run build:frontend` passes.
- [ ] `npm.cmd run test:e2e --workspace=backend` passes.
- [ ] `npm.cmd run build:backend` passes.

## Out of Scope for P4b

- HLS transcoding.
- Resumable multipart uploads.
- Admin media library.
- Video captions and transcript search.
- Fine-grained lesson playback authorization beyond P3b backend behavior.
- Playwright e2e automation for full upload with a real binary object.

## Suggested Next Plans

- **P5 Docker & CI:** production Dockerfiles, Nginx reverse proxy with WebSocket upgrade, GitHub Actions, and deployable environment docs.
- **P6 Learning UX:** lesson completion controls, notes, captions, transcripts, and quiz-to-lesson review flows.

## Self-Review

- [x] **Spec coverage:** Covers P3b frontend consumers for media upload/playback and progress heartbeat/read APIs.
- [x] **Scope control:** Does not add transcoding, media library, or production deployment work.
- [x] **Taste-skill fit:** Applies dashboard-relevant shadcn dark theme rules while avoiding landing-page-only patterns.
- [x] **Placeholder scan:** No TBD/TODO placeholders remain.
- [x] **Type consistency:** API names align with P3b shared contracts and backend routes.
- [x] **Verification discipline:** Each implementation task ends with focused tests and `npm.cmd run build:frontend`.


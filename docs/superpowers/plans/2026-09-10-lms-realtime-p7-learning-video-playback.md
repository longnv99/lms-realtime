# LMS Realtime P7 Learning Video Playback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder learner video surface with real lesson playback, resume positioning, and automatic progress saves.

**Architecture:** Keep P3b media playback as the source of truth by using `GET /api/media/assets/:assetId/playback` and the existing presigned URL response. Extract one small playback component that owns video loading, empty/error states, resume seek, and throttled progress events; use it in the learner workspace first, then preserve live session heartbeat behavior through the same component. Progress in `/courses/:courseId/learn` is saved through the P6 REST endpoint rather than the live-session socket.

**Tech Stack:** React, Vite, TypeScript, TanStack Query, shadcn-style UI components, NestJS media/progress APIs, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-26-lms-realtime-design.md`

## Global Constraints

- Do not clear or reset local/production data unless a task explicitly says to run the reset seed command.
- Frontend visible copy must be English.
- UI must use the existing shadcn-style dark theme and `frontend/src/components/ui/*` as the base component layer.
- Keep WebRTC/RTMP, HLS transcoding, and real A/V streaming out of scope; video is served through MinIO presigned URLs.
- Preserve existing live-session `progress:heartbeat` socket behavior.
- After each implementation task that touches code, run the listed typecheck/build command before committing.

---

## File Structure

**Frontend playback**
- Create `frontend/src/features/media/LessonVideoPlayer.tsx` for reusable lesson video playback.
- Create `frontend/src/features/media/LessonVideoPlayer.test.tsx` for playback, empty, error, resume, and throttling behavior.
- Modify `frontend/src/features/learning/LearningPlayer.tsx` to render real video.
- Modify `frontend/src/features/learning/LearningPage.tsx` to autosave watch progress.
- Modify `frontend/src/features/learning/LearningPage.test.tsx` to cover locked/enrolled playback behavior.
- Modify `frontend/src/features/sessions/LessonPlaybackPanel.tsx` to reuse the common player while preserving socket heartbeats.
- Modify `frontend/src/features/sessions/LiveSessionPage.test.tsx` to keep existing live playback coverage green.
- Modify `frontend/src/styles/global.css` for shared video player sizing and states.

**Docs**
- Modify `README.md` with learner playback smoke notes if the behavior changes manual verification.
- Modify this plan file as tasks complete.

---

### Task 1: Shared Lesson Video Player

**Files:**
- Create: `frontend/src/features/media/LessonVideoPlayer.tsx`
- Create: `frontend/src/features/media/LessonVideoPlayer.test.tsx`
- Modify: `frontend/src/styles/global.css`

**Interfaces:**
- Consumes:
  - `LessonResponse`
  - `getMediaPlayback(assetId: string): Promise<MediaPlaybackResponse>`
- Produces:
  - `LessonVideoPlayer`
  - `LessonVideoProgressPayload`

- [ ] **Step 1: Write failing playback tests**

Add tests asserting:

```tsx
expect(await screen.findByLabelText(/video player for intro lesson/i)).toHaveAttribute(
  'src',
  'http://localhost:9000/playback.mp4',
);
expect(mockedGetMediaPlayback).toHaveBeenCalledWith('asset-1');
```

Also assert:
- missing `mediaAssetId` shows `No video attached`;
- playback API failure shows the API error;
- `initialPositionSeconds={42}` seeks the video to 42 once metadata loads;
- `timeupdate` calls `onProgress` at 10-second intervals and on completion.

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm run test --workspace=frontend -- LessonVideoPlayer.test.tsx
```

Expected: FAIL because `LessonVideoPlayer` does not exist.

- [ ] **Step 3: Implement the component**

Create `LessonVideoPlayer` with this interface:

```ts
export type LessonVideoProgressPayload = {
  lessonId: string;
  positionSeconds: number;
  completed: boolean;
};

type LessonVideoPlayerProps = {
  lesson: LessonResponse | null;
  initialPositionSeconds?: number;
  onProgress?: (payload: LessonVideoProgressPayload) => void;
  progressIntervalSeconds?: number;
  showProgressHint?: boolean;
};
```

Behavior:
- stable `16 / 9` video frame;
- render `LoadingBlock` while loading playback URL;
- render `EmptyState` when selected lesson has no video;
- set `video.currentTime` once after metadata loads when `initialPositionSeconds > 0`;
- call `onProgress` from `timeupdate`, `pause`, `seeked`, `ended`, and unmount;
- throttle normal `timeupdate` events to `progressIntervalSeconds`, default `10`.

- [ ] **Step 4: Verify**

Run:

```bash
npm run test --workspace=frontend -- LessonVideoPlayer.test.tsx
npm run typecheck:frontend
npm run build:frontend
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/media frontend/src/styles/global.css
git commit -m "feat(frontend): add shared lesson video player"
```

---

### Task 2: Learner Playback and Autosave Progress

**Files:**
- Modify: `frontend/src/features/learning/LearningPlayer.tsx`
- Modify: `frontend/src/features/learning/LearningPage.tsx`
- Modify: `frontend/src/features/learning/LearningPage.test.tsx`

**Interfaces:**
- Consumes:
  - `LessonVideoPlayer`
  - `updateLessonProgress(lessonId: string, input: UpdateLessonProgressInput): Promise<LessonProgressResponse>`
- Produces:
  - real video playback in `/courses/:courseId/learn`
  - automatic REST progress saves while students watch lesson videos

- [ ] **Step 1: Write failing learner playback test**

Add a test that renders an enrolled learner, waits for the video player, sends `timeupdate`, and asserts `updateLessonProgress` receives:

```ts
expect(mockedUpdateLessonProgress).toHaveBeenCalledWith('lesson-1', {
  positionSeconds: 42,
});
```

Add a second assertion that `ended` marks the lesson complete:

```ts
expect(mockedUpdateLessonProgress).toHaveBeenCalledWith('lesson-1', {
  completed: true,
  positionSeconds: 600,
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm run test --workspace=frontend -- LearningPage.test.tsx
```

Expected: FAIL because `LearningPlayer` still renders a placeholder.

- [ ] **Step 3: Wire `LessonVideoPlayer` into `LearningPlayer`**

Replace the placeholder `learning-video-stage` content with `LessonVideoPlayer`, passing:
- `lesson`;
- `initialPositionSeconds={progress?.positionSeconds ?? 0}`;
- `onProgress={onVideoProgress}`.

- [ ] **Step 4: Save progress in `LearningPage`**

Add a `handleVideoProgress(payload)` callback that calls:

```ts
updateLessonProgress(payload.lessonId, {
  positionSeconds: payload.positionSeconds,
  ...(payload.completed ? { completed: true } : {}),
});
```

Invalidate `['my-course-progress', courseId]` after success.

- [ ] **Step 5: Verify**

Run:

```bash
npm run test --workspace=frontend -- LearningPage.test.tsx LessonVideoPlayer.test.tsx
npm run typecheck:frontend
npm run build:frontend
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/learning
git commit -m "feat(frontend): play lesson videos in learning workspace"
```

---

### Task 3: Reuse Player in Live Sessions

**Files:**
- Modify: `frontend/src/features/sessions/LessonPlaybackPanel.tsx`
- Modify: `frontend/src/features/sessions/LiveSessionPage.test.tsx`
- Modify: `frontend/src/styles/global.css`

**Interfaces:**
- Consumes:
  - `LessonVideoPlayer`
  - `emitProgressHeartbeat(socket, payload)`
- Produces:
  - live session video playback implemented through the shared player

- [ ] **Step 1: Update live session tests**

Keep existing tests asserting:
- attached media renders `<video src="...">`;
- a lesson without media shows `No video attached`;
- socket heartbeats emit at 10-second intervals.

- [ ] **Step 2: Refactor `LessonPlaybackPanel`**

Remove duplicated playback query and `handleTimeUpdate`. Keep the lesson selector and pass an `onProgress` callback to `LessonVideoPlayer`:

```ts
if (!socket || socketStatus !== 'connected') return;
emitProgressHeartbeat(socket, {
  lessonId: payload.lessonId,
  positionSeconds: payload.positionSeconds,
});
```

- [ ] **Step 3: Verify**

Run:

```bash
npm run test --workspace=frontend -- LiveSessionPage.test.tsx LessonVideoPlayer.test.tsx
npm run typecheck:frontend
npm run build:frontend
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/sessions frontend/src/features/media frontend/src/styles/global.css
git commit -m "refactor(frontend): share lesson playback player"
```

---

### Task 4: P7 Smoke Coverage and Handoff

**Files:**
- Modify: `tests/e2e/p6-learning-ux.spec.ts`
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-09-10-lms-realtime-p7-learning-video-playback.md`

**Interfaces:**
- Consumes: completed P7 playback and progress autosave.
- Produces: documented learner playback smoke path.

- [ ] **Step 1: Update Playwright smoke**

Add assertions that the learning workspace shows either:
- a `Video player for ...` element when seeded media exists; or
- the `No video attached` state when local MinIO has no uploaded object.

- [ ] **Step 2: Update README smoke notes**

Document that `/courses/:courseId/learn` now uses real lesson playback and saves progress from video events.

- [ ] **Step 3: Run full verification**

Run:

```bash
npm run test:frontend
npm run typecheck
npm run build
```

Expected: PASS.

- [ ] **Step 4: Mark plan complete and commit**

Mark completed boxes in this plan and commit:

```bash
git add docs/superpowers/plans/2026-09-10-lms-realtime-p7-learning-video-playback.md README.md tests/e2e/p6-learning-ux.spec.ts
git commit -m "docs(plan): complete p7 learning video playback"
```

---

## Self-Review

**Spec coverage:** This plan covers the roadmap requirement that uploaded lesson videos are playable through presigned URLs and that progress can be saved from video playback events. It intentionally keeps WebRTC/RTMP, HLS transcoding, and push notifications out of scope.

**Placeholder scan:** No placeholder steps are left; every task has concrete files, interfaces, tests, verification commands, and commit commands.

**Type consistency:** `LessonVideoProgressPayload` is introduced before both learner REST progress and live-session socket heartbeat consumers use it.
